import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const taskDir = path.resolve(scriptDir, "..");
const taskMeta = JSON.parse(fs.readFileSync(path.join(taskDir, "task.json"), "utf8"));
const inferredSkillRoot = path.resolve(scriptDir, "..", "..", "..", "..");
const configuredSkillRoot = taskMeta.roots?.skillRoot;
const skillRoot = configuredSkillRoot && fs.existsSync(path.join(configuredSkillRoot, "tools", "task", "task-close.mjs"))
  ? path.resolve(configuredSkillRoot)
  : inferredSkillRoot;
const configuredWorkspaceRoot = taskMeta.roots?.workspaceRoot;
const workspaceRoot = configuredWorkspaceRoot && fs.existsSync(configuredWorkspaceRoot)
  ? path.resolve(configuredWorkspaceRoot)
  : path.resolve(taskDir, "..", "..", "..");
const taskCloseScript = path.join(skillRoot, "tools", "task", "task-close.mjs");

const result = spawnSync(process.execPath, [taskCloseScript, taskDir], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    WEB_REVERSE_SKILL_ROOT: skillRoot,
    WEB_REVERSE_WORKSPACE_ROOT: workspaceRoot
  },
  stdio: "inherit"
});

process.exit(result.status ?? 1);
