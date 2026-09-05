import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listWorkspaceHistoryFiles,
  relFromRepo
} from "./common.mjs";

const taskInitScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "task-init.mjs");

function usage() {
  console.error("usage: node tools/task/task-start.mjs <task-id> [--force-new-task] [task-init flags]");
}

function printHistoryFiles(historyFiles, root) {
  const preview = historyFiles.slice(0, 8);
  for (const filePath of preview) {
    console.log(`- ${relFromRepo(filePath, root)}`);
  }
  if (historyFiles.length > preview.length) {
    console.log(`- ... (${historyFiles.length - preview.length} more)`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const forceNewTask = args.includes("--force-new-task");
  const forwardedArgs = args.filter((item) => item !== "--force-new-task");
  const taskId = forwardedArgs.find((item) => !item.startsWith("--"));
  const cwd = process.cwd();
  const historyFiles = listWorkspaceHistoryFiles(cwd);

  if (historyFiles.length === 0) {
    if (!taskId) {
      usage();
      console.error("[task-start] no history data files were found in the current workspace, so this run must begin with task-init.");
      process.exit(1);
    }

    console.log("[task-start] no history data files found; starting a new task-local via task-init.");
    const result = spawnSync(process.execPath, [taskInitScript, ...forwardedArgs], {
      cwd,
      env: {
        ...process.env,
        WEB_REVERSE_WORKSPACE_ROOT: cwd
      },
      stdio: "inherit"
    });
    process.exit(result.status ?? 1);
  }

  if (!taskId) {
    usage();
    console.error("[task-start] history data files already exist in this workspace. Resume an existing task with task-sync/task-advance, or pass a new <task-id> together with --force-new-task if you intentionally want another task-local.");
    printHistoryFiles(historyFiles, cwd);
    process.exit(1);
  }

  if (!forceNewTask) {
    usage();
    console.error("[task-start] history data files already exist in this workspace, so a new task-local is blocked by default.");
    console.error("[task-start] resume the existing task-local with task-sync/task-advance, or re-run with --force-new-task if you intentionally want another task id in the same workspace.");
    printHistoryFiles(historyFiles, cwd);
    process.exit(1);
  }

  console.log("[task-start] existing history data files detected in this workspace.");
  printHistoryFiles(historyFiles, cwd);
  console.log(`[task-start] --force-new-task accepted; initializing a new task-local for '${taskId}' via task-init.`);
  const result = spawnSync(process.execPath, [taskInitScript, ...forwardedArgs, "--force-new-task"], {
    cwd,
    env: {
      ...process.env,
      WEB_REVERSE_WORKSPACE_ROOT: cwd
    },
    stdio: "inherit"
  });
  process.exit(result.status ?? 1);
}

main();
