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

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-reply-gate-"));

try {
  const taskDir = path.join(tempRoot, `fixture-${Date.now()}`);
  buildFixtureTask(taskDir, path.basename(taskDir));

  const sync = runNode([path.join(repoRoot, "tools", "task", "task-sync.mjs"), taskDir]);
  if (sync.status !== 0) {
    findings.push(`task-sync failed: ${(sync.stderr || sync.stdout || "").trim()}`);
  }

  const blocked = runNode([path.join(repoRoot, "tools", "task", "assert-can-reply.mjs"), taskDir]);
  if (blocked.status === 0) {
    findings.push("assert-can-reply should fail while execution is ready-to-continue");
  }
  const blockedOut = `${blocked.stdout || ""}\n${blocked.stderr || ""}`;
  for (const needle of [
    "assert-can-reply: BLOCKED",
    "execution.status=ready-to-continue",
    "rule=do-not-send-user-visible-reply",
    "rule=do-not-write-if-you-agree-i-will-continue",
    "rule=execute-nextExecutableAction-first"
  ]) {
    if (!blockedOut.includes(needle)) {
      findings.push(`blocked assert-can-reply output missing: ${needle}`);
    }
  }

  const pause = runNode([
    path.join(repoRoot, "tools", "task", "task-advance.mjs"),
    taskDir,
    "--pause-category=user",
    "--pause-reason=需要用户重新登录"
  ]);
  if (pause.status !== 0) {
    findings.push(`task-advance pause override failed: ${(pause.stderr || pause.stdout || "").trim()}`);
  }

  const allowed = runNode([path.join(repoRoot, "tools", "task", "assert-can-reply.mjs"), taskDir]);
  if (allowed.status !== 0) {
    findings.push(`assert-can-reply should pass for blocked-on-user, got: ${(allowed.stderr || allowed.stdout || "").trim()}`);
  }
  const allowedOut = `${allowed.stdout || ""}\n${allowed.stderr || ""}`;
  if (!allowedOut.includes("assert-can-reply: OK")) {
    findings.push("allowed assert-can-reply output should contain OK");
  }
  if (!allowedOut.includes("execution.status=blocked-on-user")) {
    findings.push("allowed assert-can-reply output should expose blocked-on-user status");
  }

  const requireValidated = runNode([
    path.join(repoRoot, "tools", "task", "assert-can-reply.mjs"),
    taskDir,
    "--require-validated-deliverable"
  ]);
  if (requireValidated.status === 0) {
    findings.push("assert-can-reply --require-validated-deliverable should fail when verify-once validation fails");
  }
  const requireValidatedOut = `${requireValidated.stdout || ""}\n${requireValidated.stderr || ""}`;
  for (const needle of [
    "deliveryStateFailure=",
    "rule=validated-deliverable-requires-completed-execution",
    "rule=final-summary-requires-verify-once-validate-only"
  ]) {
    if (needle === "rule=final-summary-requires-verify-once-validate-only") {
      continue;
    }
    if (!requireValidatedOut.includes(needle)) {
      findings.push(`validated assert-can-reply output missing: ${needle}`);
    }
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-reply-gate-contract");
