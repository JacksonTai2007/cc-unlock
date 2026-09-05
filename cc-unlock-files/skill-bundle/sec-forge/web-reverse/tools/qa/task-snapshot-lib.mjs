import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./common.mjs";
import { listTaskDirs, readTaskJson } from "../task/common.mjs";
import { artifactTouchedAgainstTemplate, readRouteStateDocument } from "../task/route-state.mjs";

const cacheVersion = 1;
const cacheRoot = path.join(
  os.tmpdir(),
  "web-reverse-qa-cache",
  crypto.createHash("sha1").update(path.resolve(repoRoot)).digest("hex")
);
const snapshotCachePath = path.join(cacheRoot, `task-snapshot-v${cacheVersion}.json`);

function ensureCacheDir() {
  fs.mkdirSync(cacheRoot, { recursive: true });
}

function walkFiles(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, baseDir));
      continue;
    }
    results.push(path.relative(baseDir, fullPath).replaceAll("\\", "/"));
  }
  return results.sort((left, right) => left.localeCompare(right));
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function buildTaskEntry(taskDir) {
  const task = readTaskJson(taskDir);
  task.__taskDir = taskDir;

  const routeStatePath = path.join(taskDir, task.routeState?.statePath || "state/route-state.json");
  const routePlanPath = path.join(taskDir, task.routeState?.planPath || "state/route-plan.md");
  const progressPath = path.join(taskDir, task.routeState?.progressPath || "state/progress.md");
  const cluesPath = path.join(taskDir, task.routeState?.cluesPath || "state/clues.md");
  const reportPath = path.join(taskDir, "report.md");
  const fixturesPath = path.join(taskDir, "run", "fixtures.json");
  const files = walkFiles(taskDir);
  const fileStats = [];
  const touchedArtifacts = {};

  for (const relPath of files) {
    const fullPath = path.join(taskDir, ...relPath.split("/"));
    const stat = fs.statSync(fullPath);
    fileStats.push({
      relPath,
      size: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs)
    });
    touchedArtifacts[relPath] = artifactTouchedAgainstTemplate(taskDir, relPath);
  }

  return {
    taskDir,
    relTaskDir: path.relative(repoRoot, taskDir).replaceAll("\\", "/"),
    files,
    fileStats,
    touchedArtifacts,
    task,
    routeState: readRouteStateDocument(taskDir, task),
    reportText: readTextIfExists(reportPath),
    routePlanText: readTextIfExists(routePlanPath),
    progressText: readTextIfExists(progressPath),
    cluesText: readTextIfExists(cluesPath),
    fixturesText: readTextIfExists(fixturesPath)
  };
}

function buildFingerprint(entries) {
  const hash = crypto.createHash("sha1");
  for (const entry of entries) {
    hash.update(entry.relTaskDir);
    hash.update("\n");
    for (const file of entry.fileStats) {
      hash.update(file.relPath);
      hash.update(":");
      hash.update(String(file.size));
      hash.update(":");
      hash.update(String(file.mtimeMs));
      hash.update("\n");
    }
  }
  return hash.digest("hex");
}

function serializeSnapshot(entries) {
  return {
    version: cacheVersion,
    repoRoot: path.resolve(repoRoot),
    generatedAt: new Date().toISOString(),
    fingerprint: buildFingerprint(entries),
    entries
  };
}

function buildSnapshot() {
  const entries = listTaskDirs()
    .map((taskDir) => buildTaskEntry(taskDir))
    .sort((left, right) => left.relTaskDir.localeCompare(right.relTaskDir));
  return serializeSnapshot(entries);
}

function readCacheFile() {
  if (!fs.existsSync(snapshotCachePath)) {
    return null;
  }
  try {
    const cached = JSON.parse(fs.readFileSync(snapshotCachePath, "utf8"));
    return cached?.version === cacheVersion ? cached : null;
  } catch {
    return null;
  }
}

function writeCacheFile(snapshot) {
  ensureCacheDir();
  fs.writeFileSync(snapshotCachePath, JSON.stringify(snapshot) + "\n");
}

function snapshotStillFresh(cached) {
  if (!cached || cached.version !== cacheVersion) {
    return false;
  }

  const currentTaskDirs = listTaskDirs()
    .map((taskDir) => path.relative(repoRoot, taskDir).replaceAll("\\", "/"))
    .sort((left, right) => left.localeCompare(right));
  const cachedTaskDirs = (cached.entries || [])
    .map((entry) => entry.relTaskDir)
    .sort((left, right) => left.localeCompare(right));

  if (JSON.stringify(currentTaskDirs) !== JSON.stringify(cachedTaskDirs)) {
    return false;
  }

  const currentEntries = currentTaskDirs.map((relTaskDir) => {
    const taskDir = path.join(repoRoot, ...relTaskDir.split("/"));
    const files = walkFiles(taskDir);
    return {
      relTaskDir,
      fileStats: files.map((relPath) => {
        const fullPath = path.join(taskDir, ...relPath.split("/"));
        const stat = fs.statSync(fullPath);
        return {
          relPath,
          size: stat.size,
          mtimeMs: Math.trunc(stat.mtimeMs)
        };
      })
    };
  });

  return buildFingerprint(currentEntries) === cached.fingerprint;
}

export function loadTaskSnapshots(options = {}) {
  const { useCache = true } = options;
  const cached = useCache ? readCacheFile() : null;
  if (cached && snapshotStillFresh(cached)) {
    return cached.entries || [];
  }

  const snapshot = buildSnapshot();
  writeCacheFile(snapshot);
  return snapshot.entries;
}

export function primeTaskSnapshotCache(options = {}) {
  return loadTaskSnapshots(options);
}

export function getTaskSnapshotCachePath() {
  return snapshotCachePath;
}
