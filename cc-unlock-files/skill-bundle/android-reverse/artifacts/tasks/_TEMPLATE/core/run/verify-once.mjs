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
const skillRoot = path.resolve(task.roots?.skillRoot || path.resolve(scriptDir, "..", "..", "..", ".."));
const workspaceRoot = path.resolve(task.roots?.workspaceRoot || path.resolve(taskDir, "..", "..", ".."));

process.env.ANDROID_REVERSE_SKILL_ROOT = skillRoot;
process.env.ANDROID_REVERSE_WORKSPACE_ROOT = workspaceRoot;

const validationModule = await import(
  pathToFileURL(path.join(skillRoot, "tools", "task", "validation.mjs")).href
);
const { persistValidation, runFormalValidation } = validationModule;

const result = runFormalValidation(taskDir);
persistValidation(taskDir, result);

if (!result.ok) {
  console.error("verify-once: FAILED");
  for (const finding of result.findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("verify-once: passed");

if (!validateOnly) {
  const closeout = spawnSync(process.execPath, [closeoutScript], {
    cwd: scriptDir,
    env: {
      ...process.env,
      ANDROID_REVERSE_SKILL_ROOT: skillRoot,
      ANDROID_REVERSE_WORKSPACE_ROOT: workspaceRoot
    },
    stdio: "inherit"
  });
  if (closeout.status !== 0) {
    process.exit(closeout.status ?? 1);
  }
}

