import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const taskDir = path.resolve(scriptDir, "..");
const taskMeta = JSON.parse(fs.readFileSync(path.join(taskDir, "task.json"), "utf8"));
const skillRoot = path.resolve(taskMeta.roots?.skillRoot || path.resolve(scriptDir, "..", "..", "..", ".."));
const workspaceRoot = path.resolve(taskMeta.roots?.workspaceRoot || path.resolve(taskDir, "..", "..", ".."));
const taskCloseScript = path.join(skillRoot, "tools", "task", "task-close.mjs");

const result = spawnSync(process.execPath, [taskCloseScript, taskDir], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    WIN_REVERSE_SKILL_ROOT: skillRoot,
    WIN_REVERSE_WORKSPACE_ROOT: workspaceRoot
  },
  stdio: "inherit"
});

process.exit(result.status ?? 1);
