import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  ensureTaskRuntimeShape, readTaskJson, relFromRepo, resolveTaskDir, writeTaskJson,
  assertSafeWorkspaceRoot, inferWorkspaceRootFromTaskDir, isPathInsideDir
} from "./common.mjs";
import {
  applyRouteStateToTask, normalizeRouteStateDocument, readRouteStateDocument,
  resolveExecutionState, syncMarkdownViews, writeRouteStateDocument
} from "./route-state.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) throw new Error('usage: node tools/task/task-advance.mjs <task-id|task-path> [--pause-category=none|user|risk|internal] [--pause-reason="..."] [--json]');
  const pauseCategory = args.find((item) => item.startsWith("--pause-category="))?.split("=")[1] || "";
  if (pauseCategory && !["none", "user", "risk", "internal"].includes(pauseCategory)) throw new Error("pause-category must be none, user, risk, or internal");
  return { taskRef, pauseCategory, pauseReason: args.find((item) => item.startsWith("--pause-reason="))?.split("=").slice(1).join("=") || "", json: args.includes("--json") };
}
const text = (value) => typeof value === "string" ? value.trim() : "";
function nonPlaceholder(value) {
  return Boolean(text(value)) && !/^(replace-me|replace-with-.+|TARGET|INPUT_PATH|unknown)$/i.test(text(value));
}
function taskContract(taskDir, task) {
  const target = text(task.TARGET || task.targetContext?.targetBinaryPath || task.target?.binaryPath || task.target?.path || task.targetContext?.inputTarget || task.target?.value);
  const objective = text(task.objective || task.targetContext?.objective);
  const criteria = Array.isArray(task.completionCriteria) && task.completionCriteria.length ? task.completionCriteria : task.successCriteria;
  if (!nonPlaceholder(target)) throw new Error("[workflow-gate] TARGET is missing; bind the requested target, not a historical product path");
  if (!nonPlaceholder(objective)) throw new Error("[workflow-gate] objective is missing");
  if (!Array.isArray(criteria) || !criteria.length || criteria.some((item) => !nonPlaceholder(typeof item === "string" ? item : item?.description))) throw new Error("[workflow-gate] completionCriteria/success oracle is missing or contains placeholders");
  return { target: path.resolve(inferWorkspaceRootFromTaskDir(taskDir), target), objective, criteria };
}
function signature(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`[workflow-gate] expected a file: ${filePath}`);
  // Metadata invalidates a cache; it does not prove behavior or cryptographic integrity.
  return { realPath: fs.realpathSync(filePath), size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, birthtimeMs: stat.birthtimeMs };
}
function localEvidence(taskDir, value) {
  if (!text(value)) throw new Error("[workflow-gate] empty evidence path");
  const resolved = path.resolve(taskDir, value);
  if (!isPathInsideDir(resolved, taskDir)) throw new Error("[workflow-gate] evidence must be task-local");
  const stat = signature(resolved);
  if (!isPathInsideDir(stat.realPath, fs.realpathSync(taskDir))) throw new Error("[workflow-gate] evidence symlink leaves the task");
  if (!stat.size) throw new Error(`[workflow-gate] empty evidence: ${value}`);
  return stat;
}
function readObject(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`[workflow-gate] expected JSON object: ${filePath}`);
  return value;
}
export function runWorkflowChecks(taskDir, task) {
  const contract = taskContract(taskDir, task);
  const cachePath = path.join(taskDir, "state", "advance-check-cache.json");
  const previous = fs.existsSync(cachePath) ? readObject(cachePath) : {};
  if (previous.schemaVersion && previous.schemaVersion !== 1) throw new Error("[workflow-gate] unsupported check cache version");
  if (previous.contract) {
    if (previous.contract.target !== contract.target || previous.contract.objective !== contract.objective) throw new Error("[workflow-gate] bound TARGET/objective changed; use a new task contract for a redirected request");
    const current = contract.criteria.map((item) => JSON.stringify(item));
    if (previous.contract.criteria.some((item) => !current.includes(JSON.stringify(item)))) throw new Error("[workflow-gate] success oracle was removed or weakened; retain existing criteria");
  }
  const cache = { schemaVersion: 1, contract, files: { ...(previous.files || {}) } };
  const stats = { hashesComputed: 0, hashesReused: 0, diagnosticsReused: false };
  const activeCrash = task.crash?.status === "active" || fs.existsSync(path.join(taskDir, "run", "crash_state.flag"));
  if (activeCrash) {
    const diagnosticPath = path.join(taskDir, "run", "crash-diagnostics.json");
    if (!fs.existsSync(diagnosticPath)) throw new Error("[workflow-gate] crash observed; record run/crash-diagnostics.json with actual observation/evidence/nextAction (not prose length or keywords)");
    const diagnosticSignature = localEvidence(taskDir, "run/crash-diagnostics.json");
    const document = readObject(diagnosticPath);
    if (path.resolve(inferWorkspaceRootFromTaskDir(taskDir), text(document.target)) !== contract.target) throw new Error("[workflow-gate] crash evidence target does not match TARGET");
    const observation = document.observation;
    const commandObserved = observation?.kind === "process-exit" && Array.isArray(observation.command) && observation.command.length && observation.command.every((item) => typeof item === "string") && Number.isInteger(observation.exitCode);
    const eventObserved = observation?.kind === "event-log" && nonPlaceholder(observation.provider) && (typeof observation.eventId === "string" || Number.isInteger(observation.eventId)) && nonPlaceholder(observation.timestamp);
    if (!commandObserved && !eventObserved) throw new Error("[workflow-gate] crash observation needs recorded command + exitCode or provider + eventId + timestamp");
    if (!Array.isArray(document.evidencePaths) || !document.evidencePaths.length || !nonPlaceholder(document.nextAction)) throw new Error("[workflow-gate] crash diagnostics needs evidencePaths and a concrete nextAction");
    const snapshot = { diagnosticSignature, evidence: document.evidencePaths.map((item) => localEvidence(taskDir, item)) };
    stats.diagnosticsReused = JSON.stringify(previous.crash) === JSON.stringify(snapshot);
    cache.crash = snapshot;
  }
  // Only explicit immutable TARGET checks: no product paths, backup scans or flag exemptions.
  const integrity = task.integrityChecks || [];
  if (!Array.isArray(integrity)) throw new Error("[workflow-gate] integrityChecks must be an array");
  function digest(filePath) {
    const current = signature(filePath);
    const saved = cache.files[current.realPath];
    if (saved && JSON.stringify(saved.signature) === JSON.stringify(current)) { stats.hashesReused += 1; return saved.sha256; }
    stats.hashesComputed += 1;
    const sha256 = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    cache.files[current.realPath] = { signature: current, sha256 };
    return sha256;
  }
  for (const check of integrity) {
    if (check?.expect !== "unchanged" || !nonPlaceholder(check.reason)) throw new Error("[workflow-gate] integrity check needs expect=unchanged and an actual integrity/audit reason");
    const source = path.resolve(inferWorkspaceRootFromTaskDir(taskDir), text(check.targetPath));
    if (source !== contract.target) throw new Error("[workflow-gate] integrity target does not match TARGET; no historical or unrelated paths allowed");
    const expected = text(check.expectedSha256).toLowerCase();
    if (expected && !/^[a-f0-9]{64}$/.test(expected)) throw new Error("[workflow-gate] expectedSha256 must be a SHA256 hex value");
    if (Boolean(expected) === Boolean(text(check.baselinePath))) throw new Error("[workflow-gate] supply exactly one expectedSha256 or task-local baselinePath");
    const baseline = text(check.baselinePath) ? localEvidence(taskDir, check.baselinePath).realPath : null;
    if (digest(source) !== (expected || digest(baseline))) throw new Error("[workflow-gate] explicitly protected immutable TARGET differs from its baseline; inspect actual change (flag files are not exemptions)");
  }
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const serialized = `${JSON.stringify(cache, null, 2)}\n`;
  if (!fs.existsSync(cachePath) || fs.readFileSync(cachePath, "utf8") !== serialized) {
    const temporary = `${cachePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, serialized);
    fs.renameSync(temporary, cachePath);
  }
  return stats;
}
function main() {
  const { taskRef, pauseCategory, pauseReason, json } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);
  assertSafeWorkspaceRoot({ workspace: taskDir, commandName: "task-advance" });
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  let routeState = readRouteStateDocument(taskDir, task);
  if (!routeState) throw new Error("task-advance: route-state.json is missing or unreadable; run task-sync first");
  const checks = runWorkflowChecks(taskDir, task);
  routeState = normalizeRouteStateDocument(routeState, task);
  if (pauseCategory) routeState.execution = normalizeRouteStateDocument({ execution: { ...routeState.execution, pauseCategory, pauseReason } }, task).execution;
  routeState.execution = resolveExecutionState(task, routeState);
  routeState = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, routeState);
  applyRouteStateToTask(task, routeState);
  writeTaskJson(taskDir, task);
  const payload = { task: relFromRepo(taskDir), phase: routeState.phase, syncStatus: routeState.syncStatus, execution: routeState.execution, checks };
  if (json) return console.log(JSON.stringify(payload, null, 2));
  console.log(`task-advance: ${payload.task}\nphase=${payload.phase}\nsyncStatus=${payload.syncStatus}`);
  for (const key of ["status", "autoAdvanceEligible", "nextEntrypointId", "nextExecutableAction", "pauseCategory", "pauseReason"]) console.log(`execution.${key}=${payload.execution[key] || "(none)"}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(String(error?.message || error)); process.exitCode = 1; }
}
