import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, readJson, readText, repoRoot } from "./common.mjs";

const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-task-start-"));
const taskStartScript = path.join(repoRoot, "tools", "task", "task-start.mjs");

function runNode(args, cwd) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8"
  });
}

function requireText(relPath, needles) {
  const text = readText(relPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      findings.push(`${relPath} is missing required text: ${needle}`);
    }
  }
}

try {
  const packageJson = readJson("package.json");
  if (packageJson.scripts?.["task:start"] !== "node tools/task/task-start.mjs") {
    findings.push("package.json must expose scripts.task:start -> node tools/task/task-start.mjs");
  }
  if (packageJson.scripts?.["task:init"] !== "node tools/task/task-init.mjs") {
    findings.push("package.json must expose scripts.task:init -> node tools/task/task-init.mjs");
  }

  requireText("agents/openai.yaml", [
    "history data files",
    "task-start",
    "task-init",
    "--force-new-task"
  ]);
  // [阶段1·去焊接] 降级初始化入口（task-start/task-init/--force-new-task）的细则已下沉到
  // docs/reference/startup-gate-procedures.md，SKILL.md 只留 task-boot 一条红线指针。
  // 此处不再要求 SKILL.md 正文枚举这些工具名；contract 由 startup-gate-procedures.md 承载。
  requireText("docs/reference/startup-gate-procedures.md", [
    "history data files",
    "task-start.mjs",
    "task-init.mjs",
    "--force-new-task"
  ]);
  requireText("PROMPTS.md", [
    "history data files",
    "task-start.mjs",
    "task-init.mjs",
    "--force-new-task"
  ]);
  requireText("references/automation-entry.md", [
    "history data files",
    "task-start.mjs",
    "task-init.mjs",
    "--force-new-task"
  ]);

  const freshWorkspace = path.join(tempRoot, "fresh-workspace");
  fs.mkdirSync(freshWorkspace, { recursive: true });
  const initResult = runNode([taskStartScript, "fresh-task", "--topic=signature"], freshWorkspace);
  if (initResult.status !== 0) {
    findings.push(`task-start fresh workspace fixture failed: ${(initResult.stderr || initResult.stdout || "").trim()}`);
  }

  const taskDir = path.join(freshWorkspace, "artifacts", "tasks", "fresh-task");
  for (const relPath of ["task.json", "report.md", path.join("state", "route-state.json")]) {
    if (!fs.existsSync(path.join(taskDir, relPath))) {
      findings.push(`task-start fresh workspace fixture did not create ${path.join("artifacts", "tasks", "fresh-task", relPath).replaceAll("\\", "/")}`);
    }
  }

  const resumeOnlyResult = runNode([taskStartScript], freshWorkspace);
  if (resumeOnlyResult.status === 0) {
    findings.push("task-start without task-id should fail when history data files already exist");
  }
  const combinedOutput = `${resumeOnlyResult.stdout || ""}\n${resumeOnlyResult.stderr || ""}`;
  if (!combinedOutput.includes("history data files already exist")) {
    findings.push("task-start without task-id should explain that history data files already exist");
  }

  const blockedNewTaskResult = runNode([taskStartScript, "second-task"], freshWorkspace);
  if (blockedNewTaskResult.status === 0) {
    findings.push("task-start should block creating a second task by default when history data files already exist");
  }
  const blockedOutput = `${blockedNewTaskResult.stdout || ""}\n${blockedNewTaskResult.stderr || ""}`;
  if (!blockedOutput.includes("--force-new-task")) {
    findings.push("task-start should mention --force-new-task when blocking a second task in a workspace with history data files");
  }

  const forcedNewTaskResult = runNode([taskStartScript, "second-task", "--force-new-task"], freshWorkspace);
  if (forcedNewTaskResult.status !== 0) {
    findings.push(`task-start force-new-task fixture failed: ${(forcedNewTaskResult.stderr || forcedNewTaskResult.stdout || "").trim()}`);
  }
  const forcedTaskDir = path.join(freshWorkspace, "artifacts", "tasks", "second-task");
  if (!fs.existsSync(path.join(forcedTaskDir, "task.json"))) {
    findings.push("task-start --force-new-task did not create the requested second task-local");
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-task-start-contract");
