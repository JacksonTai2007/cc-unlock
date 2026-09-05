import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  relFromRepo,
  taskFile,
  taskFileMatchesTemplate
} from "./common.mjs";

const preservedRunFiles = new Set([
  "run/verify-once.mjs",
  "run/closeout.mjs",
  "run/run-local.mjs",
  "run/fixtures.json",
  "run/validate-fixture.mjs"
]);

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(fullPath);
      results.push(...walk(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function isOneByteJsonl(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".jsonl") {
    return false;
  }
  const stat = fs.statSync(filePath);
  if (stat.size > 2) {
    return false;
  }
  const text = fs.readFileSync(filePath, "utf8");
  return text.trim() === "";
}

function removeFile(filePath, removed, taskDir) {
  fs.rmSync(filePath, { force: true });
  removed.push(relFromRepo(filePath, taskDir));
}

function removeDirectory(dirPath, removed, taskDir) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  removed.push(relFromRepo(dirPath, taskDir));
}

export function cleanupTaskArtifacts(taskDir) {
  const removed = [];
  const allPaths = walk(taskDir)
    .sort((left, right) => right.length - left.length);

  for (const fullPath of allPaths) {
    const relativePath = relFromRepo(fullPath, taskDir);
    const basename = path.basename(fullPath).toLowerCase();

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      if (basename === "node_modules" || basename === "__pycache__" || /_extracted$/i.test(basename)) {
        removeDirectory(fullPath, removed, taskDir);
      }
      continue;
    }

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    if (relativePath === "report.md" || relativePath === "task.json" || relativePath === "run/fixtures.json") {
      continue;
    }

    if (/\.tmp$/i.test(fullPath) || /\.bak$/i.test(fullPath) || /\.log$/i.test(fullPath)) {
      removeFile(fullPath, removed, taskDir);
      continue;
    }

    if (relativePath.startsWith("run/")) {
      if (preservedRunFiles.has(relativePath)) {
        continue;
      }
      if (taskFileMatchesTemplate(taskDir, relativePath)) {
        removeFile(fullPath, removed, taskDir);
        continue;
      }
    }

    if (isOneByteJsonl(fullPath)) {
      removeFile(fullPath, removed, taskDir);
    }
  }

  return removed;
}

function main() {
  const taskRef = process.argv[2];
  if (!taskRef) {
    console.error("usage: node tools/task/task-cleanup.mjs <task-path>");
    process.exit(1);
  }

  const taskDir = path.resolve(taskRef);
  if (!fs.existsSync(taskFile(taskDir, "task.json"))) {
    console.error(`task-cleanup: missing task.json under ${taskDir}`);
    process.exit(1);
  }

  const removed = cleanupTaskArtifacts(taskDir);
  for (const relPath of removed) {
    console.log(`removed ${relPath}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
