import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, repoRoot } from "./common.mjs";

const findings = [];
const templateDir = path.join(repoRoot, "artifacts", "tasks", "_TEMPLATE");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function runNode(args, cwd = repoRoot) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8"
  });
}

function assertRunOk(result, label) {
  if (result.status !== 0) {
    findings.push(`${label} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
}

function buildFixtureTask(taskDir, taskId) {
  fs.cpSync(templateDir, taskDir, { recursive: true });
  const taskJsonPath = path.join(taskDir, "task.json");
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const task = readJson(taskJsonPath);
  const routeState = readJson(routeStatePath);
  task.taskId = taskId;
  routeState.taskId = taskId;
  writeJson(taskJsonPath, task);
  writeJson(routeStatePath, routeState);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-task-tool-discipline-"));

try {
  const taskDir = path.join(tempRoot, `fixture-${Date.now()}`);
  buildFixtureTask(taskDir, path.basename(taskDir));

  const sync = runNode([path.join(repoRoot, "tools", "task", "task-sync.mjs"), taskDir]);
  assertRunOk(sync, "task-sync discipline fixture");
  const syncOut = `${sync.stdout || ""}\n${sync.stderr || ""}`;
  for (const needle of [
    "workspaceRoot=",
    "taskLocalRoot=",
    "artifactTruthRoot=",
    "workspaceMode=",
    "discipline.mustExecuteNow=true",
    "status-only response is forbidden",
    "before any user-visible reply run: node tools/task/assert-can-reply.mjs",
    "hook high-semantic boundary first",
    "switching cookie/script/DOM hook surfaces is not a real pivot",
    "same-family hook retry cap=2",
    "every hook must directly serve the acceptance boundary"
  ]) {
    if (!syncOut.includes(needle)) {
      findings.push(`task-sync output is missing discipline signal: ${needle}`);
    }
  }

  const advance = runNode([path.join(repoRoot, "tools", "task", "task-advance.mjs"), taskDir]);
  assertRunOk(advance, "task-advance discipline fixture");
  const advanceOut = `${advance.stdout || ""}\n${advance.stderr || ""}`;
  for (const needle of [
    "execution.discipline.workspaceRoot=",
    "execution.discipline.taskLocalRoot=",
    "execution.discipline.artifactTruthRoot=",
    "execution.discipline.workspaceMode=",
    "execution.discipline.mustExecuteNow=true",
    "execution.discipline.rule=status-only-response-forbidden",
    "execution.discipline.rule=reply-gate-assert-can-reply",
    "execution.discipline.rule=verify-artifacts-before-claim",
    "execution.discipline.rule=verify-success-before-claim",
    "execution.discipline.rule=high-semantic-hook-first",
    "execution.discipline.rule=same-family-hook-retry-cap-2",
    "execution.discipline.rule=low-level-hook-surface-switch-not-pivot",
    "execution.discipline.rule=acceptance-boundary-first"
  ]) {
    if (!advanceOut.includes(needle)) {
      findings.push(`task-advance output is missing discipline signal: ${needle}`);
    }
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-task-tool-discipline");
