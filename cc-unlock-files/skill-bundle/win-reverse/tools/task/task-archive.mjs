import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  copyDirRecursive,
  ensureDir,
  ensureTaskRuntimeShape,
  readTaskJson,
  relFromRepo,
  resolveInstalledSkillRoot,
  resolveTaskDir,
  skillRoot,
  writeTaskJson
} from "./common.mjs";

export function archiveTaskSnapshot(taskDir, options = {}) {
  const resolvedTaskDir = path.resolve(taskDir);
  const task = ensureTaskRuntimeShape(readTaskJson(resolvedTaskDir));
  const taskSkillRoot = path.resolve(options.taskSkillRoot || task.roots?.skillRoot || skillRoot);
  const installedSkillRoot = path.resolve(options.installedSkillRoot || resolveInstalledSkillRoot(taskSkillRoot));
  const archiveRoot = path.join(installedSkillRoot, "artifacts", "tasks");
  const archiveTaskDir = path.join(archiveRoot, task.taskId);

  ensureDir(archiveRoot);
  fs.rmSync(archiveTaskDir, { recursive: true, force: true });
  copyDirRecursive(resolvedTaskDir, archiveTaskDir);

  const archivedTask = ensureTaskRuntimeShape(readTaskJson(archiveTaskDir));
  archivedTask.archiveStatus = "archived";
  archivedTask.archiveTargetTaskDir = archiveTaskDir;
  archivedTask.archiveCompletedAt = new Date().toISOString();
  writeTaskJson(archiveTaskDir, archivedTask);

  task.archiveStatus = "archived";
  task.archiveTargetTaskDir = archiveTaskDir;
  task.archiveCompletedAt = archivedTask.archiveCompletedAt;
  writeTaskJson(resolvedTaskDir, task);

  return {
    installedSkillRoot,
    archiveRoot,
    archiveTaskDir
  };
}

function main() {
  const taskRef = process.argv[2];
  const installedSkillRootArg = process.argv[3];
  if (!taskRef) {
    console.error("usage: node tools/task/task-archive.mjs <task-id|task-path> [installed-skill-root]");
    process.exit(1);
  }

  const taskDir = resolveTaskDir(taskRef);
  const result = archiveTaskSnapshot(taskDir, {
    installedSkillRoot: installedSkillRootArg || undefined
  });
  console.log(`archived ${relFromRepo(taskDir, taskDir)} -> ${result.archiveTaskDir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
