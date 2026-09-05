import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, repoRoot } from "./common.mjs";
import { synchronizeCloseoutState } from "../task/closeout-state.mjs";

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

function verifyReadyToContinue(taskDir) {
  const sync = runNode([path.join(repoRoot, "tools", "task", "task-sync.mjs"), taskDir]);
  assertRunOk(sync, "task-sync ready fixture");
  const routeState = readJson(path.join(taskDir, "state", "route-state.json"));
  const task = readJson(path.join(taskDir, "task.json"));

  if (routeState.execution?.status !== "ready-to-continue") {
    findings.push(`expected ready-to-continue after task-sync, got ${routeState.execution?.status || "(missing)"}`);
  }
  if (routeState.execution?.nextEntrypointId !== "EP-001") {
    findings.push(`expected nextEntrypointId=EP-001 after task-sync, got ${routeState.execution?.nextEntrypointId || "(missing)"}`);
  }
  if (!String(routeState.execution?.nextExecutableAction || "").trim()) {
    findings.push("task-sync did not populate execution.nextExecutableAction");
  }
  if (routeState.execution?.discipline?.mustExecuteNow !== true) {
    findings.push("ready-to-continue execution must set discipline.mustExecuteNow=true");
  }
  if (routeState.execution?.discipline?.statusOnlyReplyForbidden !== true) {
    findings.push("ready-to-continue execution must forbid status-only reply");
  }
  if (routeState.execution?.discipline?.artifactClaimRequiresVerification !== true) {
    findings.push("execution discipline must require artifact verification before claim");
  }
  if (routeState.execution?.discipline?.successClaimRequiresVerification !== true) {
    findings.push("execution discipline must require success verification before claim");
  }
  if (!String(task.routeState?.executionDiscipline?.artifactTruthRoot || "").trim()) {
    findings.push("task-sync did not mirror execution discipline into task.json");
  }
  if (task.routeState?.executionStatus !== routeState.execution?.status) {
    findings.push("task-sync did not mirror execution.status into task.json");
  }
  if (!Array.isArray(task.taskPacks?.activatedTopics)) {
    findings.push("task-sync must preserve task.taskPacks.activatedTopics array");
  }
}

function verifyIntelEscalation(taskDir) {
  const taskJsonPath = path.join(taskDir, "task.json");
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const task = readJson(taskJsonPath);
  const routeState = readJson(routeStatePath);

  task.routeState.pauseCategory = "none";
  task.routeState.pauseReason = "";
  task.routeState.executionStatus = "ready-to-continue";
  task.taskPacks.selectedTopics = ["signature", "session", "storage"];
  task.taskPacks.activatedTopics = ["signature", "session"];
  task.validation.notes = ["baseline_ok_generated_rejected", "verify_check", "200 + 空体"];
  task.externalRefs = {
    ...(task.externalRefs || {}),
    searchStatus: "not-started",
    lastAppliedAt: ""
  };

  routeState.syncStatus = "restored-from-route-state";
  routeState.activeEntrypoints = ["EP-001"];
  routeState.execution.pauseCategory = "none";
  routeState.execution.pauseReason = "";
  routeState.execution.status = "ready-to-continue";
  routeState.entrypoints = routeState.entrypoints.map((entrypoint, index) => ({
    ...entrypoint,
    status: index === 0 ? "PROBING" : entrypoint.status
  }));

  writeJson(taskJsonPath, task);
  writeJson(routeStatePath, routeState);

  const advance = runNode([path.join(repoRoot, "tools", "task", "task-advance.mjs"), taskDir]);
  assertRunOk(advance, "task-advance escalation fixture");
  const updated = readJson(routeStatePath);
  if (!String(updated.execution?.nextExecutableAction || "").trim()) {
    findings.push("reject-signal fixture should produce a non-empty nextExecutableAction");
  }
}

function verifyUserPause(taskDir) {
  const advance = runNode([
    path.join(repoRoot, "tools", "task", "task-advance.mjs"),
    taskDir,
    "--pause-category=user",
    "--pause-reason=需要用户重新登录"
  ]);
  assertRunOk(advance, "task-advance user blocker fixture");
  const routeState = readJson(path.join(taskDir, "state", "route-state.json"));

  if (routeState.execution?.status !== "blocked-on-user") {
    findings.push(`expected blocked-on-user after pause override, got ${routeState.execution?.status || "(missing)"}`);
  }
  if (routeState.execution?.autoAdvanceEligible !== false) {
    findings.push("blocked-on-user must force autoAdvanceEligible=false");
  }
  if (routeState.execution?.pauseCategory !== "user") {
    findings.push(`expected pauseCategory=user after pause override, got ${routeState.execution?.pauseCategory || "(missing)"}`);
  }
  if (routeState.execution?.discipline?.mustExecuteNow !== false) {
    findings.push("blocked-on-user execution must set discipline.mustExecuteNow=false");
  }
}

function verifyRetrospectiveBranch(taskDir) {
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const routeState = readJson(routeStatePath);
  routeState.syncStatus = "restored-from-route-state";
  routeState.activeEntrypoints = [];
  routeState.execution.pauseCategory = "none";
  routeState.execution.pauseReason = "";
  routeState.entrypoints = routeState.entrypoints.map((entrypoint) => ({
    ...entrypoint,
    status: "EXHAUSTED"
  }));
  routeState.retrospectives = [];
  writeJson(routeStatePath, routeState);

  const advance = runNode([path.join(repoRoot, "tools", "task", "task-advance.mjs"), taskDir]);
  assertRunOk(advance, "task-advance retrospective fixture");
  const updated = readJson(routeStatePath);

  if (updated.execution?.status !== "needs-retrospective") {
    findings.push(`expected needs-retrospective when all entrypoints exhausted, got ${updated.execution?.status || "(missing)"}`);
  }
}

function verifyLossyBranch(taskDir) {
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const routeState = readJson(routeStatePath);
  routeState.syncStatus = "backfilled-from-markdown-lossy";
  writeJson(routeStatePath, routeState);

  const advance = runNode([path.join(repoRoot, "tools", "task", "task-advance.mjs"), taskDir]);
  assertRunOk(advance, "task-advance lossy fixture");
  const updated = readJson(routeStatePath);

  if (updated.execution?.status !== "needs-route-rebuild") {
    findings.push(`expected needs-route-rebuild for lossy route-state, got ${updated.execution?.status || "(missing)"}`);
  }
}

function verifyCloseoutSync(taskDir) {
  const taskJsonPath = path.join(taskDir, "task.json");
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const reportPath = path.join(taskDir, "report.md");
  const task = readJson(taskJsonPath);
  const routeState = readJson(routeStatePath);

  task.taskId = `${task.taskId}-closeout`;
  task.phase = "Port";
  task.successCriteria = [{ label: "fixture", status: "hit" }];
  task.validation.status = "passed";
  task.routeState.executionStatus = "ready-to-continue";
  task.routeState.nextEntrypointId = "EP-001";
  task.routeState.nextExecutableAction = "run verify-once";

  routeState.phase = "Port";
  routeState.syncStatus = "synthetic-ready";
  routeState.activeTracks = ["A"];
  routeState.activeEntrypoints = ["EP-001"];
  routeState.execution.status = "ready-to-continue";
  routeState.execution.autoAdvanceEligible = true;
  routeState.execution.nextEntrypointId = "EP-001";
  routeState.execution.nextExecutableAction = "run verify-once";
  routeState.entrypoints = routeState.entrypoints.map((entrypoint, index) => ({
    ...entrypoint,
    status: index === 0 ? "PROBING" : entrypoint.status
  }));
  routeState.tracks = routeState.tracks.map((track, index) => ({
    ...track,
    status: index === 0 ? "IN_PROGRESS" : track.status
  }));

  writeJson(taskJsonPath, task);
  writeJson(routeStatePath, routeState);
  synchronizeCloseoutState(taskDir, readJson(taskJsonPath), {
    summary: "closeout 已完成，无需继续执行。"
  });

  const syncedTask = readJson(taskJsonPath);
  const syncedRouteState = readJson(routeStatePath);
  const report = fs.readFileSync(reportPath, "utf8");

  if (syncedTask.routeState?.executionStatus !== "completed") {
    findings.push(`expected task.json executionStatus=completed after closeout sync, got ${syncedTask.routeState?.executionStatus || "(missing)"}`);
  }
  if (syncedRouteState.execution?.status !== "completed") {
    findings.push(`expected route-state execution.status=completed after closeout sync, got ${syncedRouteState.execution?.status || "(missing)"}`);
  }
  if (String(syncedRouteState.execution?.nextExecutableAction || "").trim()) {
    findings.push("completed route-state must clear nextExecutableAction during closeout sync");
  }
  if ((syncedRouteState.activeEntrypoints || []).length !== 0) {
    findings.push("completed route-state must clear activeEntrypoints during closeout sync");
  }
  if (!/执行状态：`completed`/.test(report)) {
    findings.push("closeout sync must rewrite report.md 自动续跑决策 section to completed");
  }
  if (/ready-to-continue/.test(report) || /verify-once/.test(report)) {
    findings.push("closeout sync must remove stale ready-to-continue / verify-once instructions from report.md");
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-auto-advance-"));

try {
  const taskDir = path.join(tempRoot, `fixture-${Date.now()}`);
  buildFixtureTask(taskDir, path.basename(taskDir));
  verifyReadyToContinue(taskDir);
  verifyUserPause(taskDir);
  verifyRetrospectiveBranch(taskDir);
  verifyLossyBranch(taskDir);
  verifyIntelEscalation(taskDir);
  verifyCloseoutSync(taskDir);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-auto-advance-contract");
