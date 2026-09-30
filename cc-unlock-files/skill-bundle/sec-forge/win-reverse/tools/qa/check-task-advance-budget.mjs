import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runWorkflowChecks } from "../task/task-advance.mjs";
import { defaultRouteStateDocument } from "../task/route-state.mjs";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const requestedRoot = process.argv.find((arg) => arg.startsWith("--workspace-root="))?.slice("--workspace-root=".length);
const base = requestedRoot ? path.resolve(requestedRoot) : os.tmpdir();
fs.mkdirSync(base, { recursive: true });
const workspace = fs.mkdtempSync(path.join(base, "win-advance-budget-"));
const sample = path.join(workspace, "sample.dat");
fs.writeFileSync(sample, "synthetic bytes, never executed\n");
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n"); }
function makeCase(id) {
  const dir = path.join(workspace, "artifacts", "tasks", id);
  fs.mkdirSync(path.join(dir, "run"), { recursive: true });
  const task = { taskId: id, phase: "Observe", objective: "Observe the synthetic sample without running it",
    targetContext: { targetBinaryPath: sample }, completionCriteria: ["The synthetic source remains unchanged"],
    routeState: { syncStatus: "structured", activeEntrypoints: ["EP-001"] } };
  writeJson(path.join(dir, "task.json"), task);
  writeJson(path.join(dir, "state", "route-state.json"), defaultRouteStateDocument(task));
  return { dir, task };
}
const ordinary = makeCase("ordinary");
test("default progression computes zero hashes even with mismatched named backups", () => {
  fs.writeFileSync(path.join(ordinary.dir, "run", "app.asar.clean.bak"), "not the sample");
  fs.writeFileSync(path.join(ordinary.dir, "run", "typora.exe.clean.bak"), "not the sample");
  assert.equal(runWorkflowChecks(ordinary.dir, ordinary.task).hashesComputed, 0);
});
test("unchanged progression reuses the contract without rewriting its cache", () => {
  const file = path.join(ordinary.dir, "state", "advance-check-cache.json");
  const before = fs.statSync(file).mtimeMs;
  assert.equal(runWorkflowChecks(ordinary.dir, ordinary.task).hashesComputed, 0);
  assert.equal(fs.statSync(file).mtimeMs, before);
});
test("changing TARGET is rejected without executing any sample", () => {
  assert.throws(() => runWorkflowChecks(ordinary.dir, { ...ordinary.task, TARGET: "other.exe" }), /TARGET\/objective changed/);
});
test("missing TARGET is rejected rather than inferring a product", () => {
  const { dir, task } = makeCase("missing-target");
  task.targetContext = {};
  assert.throws(() => runWorkflowChecks(dir, task), /TARGET is missing/);
  assert.equal(fs.existsSync(path.join(dir, "state", "advance-check-cache.json")), false);
});
test("missing success oracle is rejected", () => {
  const { dir, task } = makeCase("missing-oracle");
  task.completionCriteria = [];
  assert.throws(() => runWorkflowChecks(dir, task), /success oracle is missing/);
});
test("removing or replacing recorded oracle criteria is rejected", () => {
  assert.throws(() => runWorkflowChecks(ordinary.dir, { ...ordinary.task, completionCriteria: ["The file exists"] }), /weakened/);
});
test("additional oracle criteria do not shrink the original contract", () => {
  const result = runWorkflowChecks(ordinary.dir, { ...ordinary.task, completionCriteria: [...ordinary.task.completionCriteria, "The command output is captured"] });
  assert.equal(result.hashesComputed, 0);
});

const integrity = makeCase("explicit-integrity");
fs.copyFileSync(sample, path.join(integrity.dir, "run", "sample.clean.bak"));
integrity.task.integrityChecks = [{ targetPath: sample, baselinePath: "run/sample.clean.bak", expect: "unchanged", reason: "Test explicitly protects the synthetic original" }];
test("only explicit immutable TARGET/baseline pair is hashed", () => {
  assert.deepEqual(runWorkflowChecks(integrity.dir, integrity.task), { hashesComputed: 2, hashesReused: 0, diagnosticsReused: false });
});
test("unchanged explicit pair reuses both hashes", () => {
  assert.deepEqual(runWorkflowChecks(integrity.dir, integrity.task), { hashesComputed: 0, hashesReused: 2, diagnosticsReused: false });
});
test("a changed explicit baseline is detected; arbitrary exemption flag is ignored", () => {
  fs.writeFileSync(path.join(integrity.dir, "run", "sample.clean.bak"), "changed baseline\n");
  fs.writeFileSync(path.join(integrity.dir, "run", "hash_mismatch_authorized.flag"), "");
  assert.throws(() => runWorkflowChecks(integrity.dir, integrity.task), /differs from its baseline/);
});
test("integrity checks cannot name unrelated historical sources", () => {
  assert.throws(() => runWorkflowChecks(integrity.dir, { ...integrity.task, integrityChecks: [{ ...integrity.task.integrityChecks[0], targetPath: "unrelated.exe" }] }), /does not match TARGET/);
});

const crash = makeCase("crash-record");
crash.task.crash = { status: "active" };
test("a long keyword-filled narrative is not diagnostic evidence", () => {
  fs.writeFileSync(path.join(crash.dir, "run", "crash_diagnostics.md"), "windbg exception 0x1234 ".repeat(50));
  assert.throws(() => runWorkflowChecks(crash.dir, crash.task), /crash-diagnostics.json/);
});
const observed = spawnSync(process.execPath, ["-e", "process.stderr.write('boom\\n'); process.exit(7)"], { encoding: "utf8" });
assert.equal(observed.status, 7);
fs.writeFileSync(path.join(crash.dir, "run", "observed.stderr.txt"), observed.stderr);
const diagnostic = { target: sample,
  observation: { kind: "process-exit", command: [process.execPath, "-e", "process.stderr.write('boom\\n'); process.exit(7)"], exitCode: observed.status },
  evidencePaths: ["run/observed.stderr.txt"], nextAction: "Inspect the recorded synthetic stderr" };
writeJson(path.join(crash.dir, "run", "crash-diagnostics.json"), diagnostic);
test("short real captured stderr is accepted without keyword/wordcount gate", () => {
  assert.equal(runWorkflowChecks(crash.dir, crash.task).diagnosticsReused, false);
});
test("unchanged crash evidence is reused", () => {
  assert.equal(runWorkflowChecks(crash.dir, crash.task).diagnosticsReused, true);
});
test("changed dependency invalidates only the corresponding diagnostic cache", () => {
  fs.appendFileSync(path.join(crash.dir, "run", "observed.stderr.txt"), "additional observed test note\n");
  const result = runWorkflowChecks(crash.dir, crash.task);
  assert.equal(result.diagnosticsReused, false);
  assert.equal(result.hashesComputed, 0);
});
test("diagnostic evidence cannot escape the task-local directory", () => {
  writeJson(path.join(crash.dir, "run", "crash-diagnostics.json"), { ...diagnostic, evidencePaths: [sample] });
  assert.throws(() => runWorkflowChecks(crash.dir, crash.task), /task-local/);
});

const cli = makeCase("cli-progression");
const env = { ...process.env, WIN_REVERSE_SKILL_ROOT: skill, WIN_REVERSE_WORKSPACE_ROOT: workspace };
const command = [path.join(skill, "tools", "task", "task-advance.mjs"), cli.dir, "--json"];
test("actual runner starts and updates a bound task with zero hashes", () => {
  const result = spawnSync(process.execPath, command, { cwd: workspace, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.checks.hashesComputed, 0);
  assert.equal(payload.execution.status, "ready-to-continue");
  assert.equal(payload.execution.autoAdvanceEligible, true);
  assert.ok(payload.execution.nextExecutableAction);
  assert.equal(fs.readFileSync(sample, "utf8"), "synthetic bytes, never executed\n");
});
test("runner contract failure does not mutate route-state or task payload", () => {
  const task = JSON.parse(fs.readFileSync(path.join(cli.dir, "task.json"), "utf8"));
  task.completionCriteria = ["weaker condition"];
  writeJson(path.join(cli.dir, "task.json"), task);
  const beforeTask = fs.readFileSync(path.join(cli.dir, "task.json"));
  const beforeRoute = fs.readFileSync(path.join(cli.dir, "state", "route-state.json"));
  const result = spawnSync(process.execPath, command, { cwd: workspace, env, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /weakened/);
  assert.deepEqual(fs.readFileSync(path.join(cli.dir, "task.json")), beforeTask);
  assert.deepEqual(fs.readFileSync(path.join(cli.dir, "state", "route-state.json")), beforeRoute);
});
console.log(`check-task-advance-budget: ${passed} passed; evidence=${workspace}`);
