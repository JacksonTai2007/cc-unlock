import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectStrayWorkspaceArtifacts,
  inferWorkspaceRootFromTaskDir,
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

// 红线2 配套：把散落 workspace 根目录的本任务产物搬进 run/，而不是静默删除——
// 避免丢失逆向成果（脚本/字体映射等）。返回 [{ from, to }]。
// workspaceRootOverride 优先使用（来自 task.roots?.workspaceRoot，比路径推导更可靠）；
// 缺省时退化为 inferWorkspaceRootFromTaskDir(taskDir)。
export function relocateStrayWorkspaceArtifacts(taskDir, workspaceRootOverride) {
  const workspaceRootDir = workspaceRootOverride || inferWorkspaceRootFromTaskDir(taskDir);
  if (!workspaceRootDir || path.resolve(workspaceRootDir) === path.resolve(taskDir)) {
    return [];
  }
  const { stray } = collectStrayWorkspaceArtifacts(taskDir, workspaceRootDir);
  if (stray.length === 0) {
    return [];
  }
  const runDir = taskFile(taskDir, "run");
  fs.mkdirSync(runDir, { recursive: true });
  const relocated = [];
  for (const name of stray) {
    const from = path.join(workspaceRootDir, name);
    if (!fs.existsSync(from) || fs.statSync(from).isDirectory()) {
      continue;
    }
    let target = path.join(runDir, name);
    // 目标已存在则加 .from-root 后缀，再冲突则追加循环计数后缀，避免覆盖 run/ 内同名文件。
    if (fs.existsSync(target)) {
      const ext = path.extname(name);
      const stem = path.basename(name, ext);
      target = path.join(runDir, `${stem}.from-root${ext}`);
      let counter = 1;
      while (fs.existsSync(target)) {
        target = path.join(runDir, `${stem}.from-root-${counter}${ext}`);
        counter += 1;
      }
    }
    try {
      fs.renameSync(from, target);
    } catch {
      // 跨设备等 rename 失败时退化为 copy+unlink。
      try {
        fs.copyFileSync(from, target);
        fs.rmSync(from, { force: true });
      } catch {
        continue;
      }
    }
    relocated.push({
      from: relFromRepo(from, workspaceRootDir),
      to: relFromRepo(target, taskDir)
    });
  }
  return relocated;
}

export function cleanupTaskArtifacts(taskDir) {
  const removed = [];
  const allPaths = walk(taskDir)
    .sort((left, right) => right.length - left.length);

  for (const fullPath of allPaths) {
    const relativePath = relFromRepo(fullPath, taskDir);
    const basename = path.basename(fullPath).toLowerCase();

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      if (
        basename === "node_modules" ||
        basename === "__pycache__" ||
        basename === "puppeteer-profile" ||
        basename === "playwright-profile" ||
        basename === "browser-profile" ||
        /(?:^|[-_])profile$/.test(basename)
      ) {
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

    if (/\.tmp$/i.test(fullPath) || /\.bak$/i.test(fullPath)) {
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
