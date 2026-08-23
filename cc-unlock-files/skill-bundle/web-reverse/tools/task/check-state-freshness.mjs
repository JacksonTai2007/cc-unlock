import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ensureTaskRuntimeShape,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  taskFile,
  taskFileMatchesTemplate
} from "./common.mjs";

const defaultToleranceMs = 2_000;
const nonStateRunFiles = new Set([
  "run/verify-once.mjs",
  "run/closeout.mjs",
  "run/validate-fixture.mjs"
]);

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function fileMtime(filePath) {
  return fs.statSync(filePath).mtimeMs;
}

function describeStamp(filePath, taskDir) {
  return `${relFromRepo(filePath, taskDir)} @ ${new Date(fileMtime(filePath)).toISOString()}`;
}

function collectStateFiles(taskDir, task) {
  return [
    taskFile(taskDir, "task.json"),
    taskFile(taskDir, "report.md"),
    taskFile(taskDir, task.routeState?.statePath || "state/route-state.json"),
    taskFile(taskDir, task.routeState?.planPath || "state/route-plan.md"),
    taskFile(taskDir, task.routeState?.cluesPath || "state/clues.md"),
    taskFile(taskDir, task.routeState?.progressPath || "state/progress.md")
  ].filter((filePath) => fs.existsSync(filePath));
}

function shouldIgnoreArtifact(taskDir, filePath) {
  const relPath = relFromRepo(filePath, taskDir);
  if (nonStateRunFiles.has(relPath)) {
    return true;
  }
  if (relPath.startsWith("run/") && taskFileMatchesTemplate(taskDir, relPath)) {
    return true;
  }
  return false;
}

function collectArtifactFiles(taskDir) {
  const runDir = taskFile(taskDir, "run");
  const taskRootFiles = fs.existsSync(taskDir)
    ? fs.readdirSync(taskDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(taskDir, entry.name))
    : [];
  const rootPureFiles = taskRootFiles.filter((filePath) =>
    /^pure[_-].+\.(?:[cm]?js|py)$/i.test(path.basename(filePath))
  );
  const runFiles = walkFiles(runDir);

  return [...rootPureFiles, ...runFiles]
    .filter((filePath) => fs.existsSync(filePath))
    .filter((filePath) => !shouldIgnoreArtifact(taskDir, filePath));
}

export function evaluateStateFreshness(taskDir, taskInput = null, options = {}) {
  const toleranceMs = Number(options.toleranceMs || defaultToleranceMs);
  const task = taskInput ? ensureTaskRuntimeShape(structuredClone(taskInput)) : ensureTaskRuntimeShape(readTaskJson(taskDir));
  const findings = [];
  const stateFiles = collectStateFiles(taskDir, task);
  const artifactFiles = collectArtifactFiles(taskDir);

  if (stateFiles.length === 0 || artifactFiles.length === 0) {
    return { ok: true, findings, latestStateFile: "", latestArtifactFile: "" };
  }

  const latestStateFile = stateFiles.reduce((best, filePath) =>
    !best || fileMtime(filePath) > fileMtime(best) ? filePath : best, "");
  const latestArtifactFile = artifactFiles.reduce((best, filePath) =>
    !best || fileMtime(filePath) > fileMtime(best) ? filePath : best, "");

  if (fileMtime(latestArtifactFile) > fileMtime(latestStateFile) + toleranceMs) {
    findings.push(
      `task state is stale: newest artifact ${describeStamp(latestArtifactFile, taskDir)} is newer than newest state file ${describeStamp(latestStateFile, taskDir)}`
    );
  }

  return {
    ok: findings.length === 0,
    findings,
    latestStateFile,
    latestArtifactFile
  };
}

function main() {
  const args = process.argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) {
    console.error("usage: node tools/task/check-state-freshness.mjs <task-id|task-path> [--json]");
    process.exit(1);
  }

  const json = args.includes("--json");
  const taskDir = resolveTaskDir(taskRef);
  const result = evaluateStateFreshness(taskDir);
  const payload = {
    task: relFromRepo(taskDir),
    ok: result.ok,
    findings: result.findings,
    latestStateFile: result.latestStateFile ? relFromRepo(result.latestStateFile, taskDir) : "",
    latestArtifactFile: result.latestArtifactFile ? relFromRepo(result.latestArtifactFile, taskDir) : ""
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (!result.ok) {
    console.error(`check-state-freshness: FAILED ${payload.task}`);
    for (const finding of result.findings) {
      console.error(`- ${finding}`);
    }
  } else {
    console.log(`check-state-freshness: OK ${payload.task}`);
  }

  if (!result.ok) {
    process.exit(1);
  }
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  main();
}
