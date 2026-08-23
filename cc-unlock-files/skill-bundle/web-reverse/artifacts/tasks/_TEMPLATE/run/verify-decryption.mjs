import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const taskDir = path.resolve(scriptDir, "..");
const taskJsonPath = path.join(taskDir, "task.json");
const closeoutScript = path.join(scriptDir, "closeout.mjs");
const validateOnly = process.argv.includes("--validate-only");
const task = JSON.parse(fs.readFileSync(taskJsonPath, "utf8"));
const inferredSkillRoot = path.resolve(scriptDir, "..", "..", "..", "..");
const configuredSkillRoot = task.roots?.skillRoot;
const skillRoot = configuredSkillRoot && fs.existsSync(path.join(configuredSkillRoot, "tools", "task", "validation.mjs"))
  ? path.resolve(configuredSkillRoot)
  : inferredSkillRoot;
const configuredWorkspaceRoot = task.roots?.workspaceRoot;
const workspaceRoot = configuredWorkspaceRoot && fs.existsSync(configuredWorkspaceRoot)
  ? path.resolve(configuredWorkspaceRoot)
  : path.resolve(taskDir, "..", "..", "..");

process.env.WEB_REVERSE_SKILL_ROOT = skillRoot;
process.env.WEB_REVERSE_WORKSPACE_ROOT = workspaceRoot;

const validationModule = await import(
  pathToFileURL(path.join(skillRoot, "tools", "task", "validation.mjs")).href
);
const { persistValidation, runFormalValidation } = validationModule;

const result = runFormalValidation(taskDir);
persistValidation(taskDir, result);

if (!result.ok) {
  console.error("verify-decryption: FAILED");
  for (const finding of result.findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("verify-decryption: passed");

if (!validateOnly) {
  const closeout = spawnSync(process.execPath, [closeoutScript], {
    cwd: scriptDir,
    env: {
      ...process.env,
      WEB_REVERSE_SKILL_ROOT: skillRoot,
      WEB_REVERSE_WORKSPACE_ROOT: workspaceRoot
    },
    stdio: "inherit"
  });
  if (closeout.status !== 0) {
    process.exit(closeout.status ?? 1);
  }
}
