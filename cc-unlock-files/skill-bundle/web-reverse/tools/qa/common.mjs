import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const allowedRootFiles = new Set([
  ".gitignore",
  "architecture-map.md",
  "CHANGELOG.md",
  "SKILL.md",
  "README.md",
  "改进清单.md",
  "问题清单.md",
  "PROMPTS.md",
  "package.json",
  "eval_set.json",
  "eval_set_deep_dive.json",
  "analysis_retrospective.md",
  "web-reverse-new-CCTV-decrypt-测试会话案例.md"
]);

export const allowedRootDirs = new Set([
  "agents",
  "artifacts",
  "docs",
  "evals",
  "hooks",
  "references",
  "scripts",
  "topics",
  "tools"
]);

export function walk(dir, options = {}) {
  const { includeFiles = true, includeDirs = true, skip = new Set() } = options;
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (includeDirs) results.push(fullPath);
      results.push(...walk(fullPath, options));
    } else if (includeFiles) {
      results.push(fullPath);
    }
  }
  return results;
}

export function rel(target) {
  return path.relative(repoRoot, target).replaceAll("\\", "/");
}

export function exists(relPath) {
  const target = path.isAbsolute(relPath)
    ? relPath
    : path.join(repoRoot, ...relPath.split("/"));
  return fs.existsSync(target);
}

export function readJson(relPath) {
  return JSON.parse(
    fs.readFileSync(
      path.isAbsolute(relPath)
        ? relPath
        : path.join(repoRoot, ...relPath.split("/")),
      "utf8"
    )
  );
}

export function readMergedEvalSet() {
  const evalFiles = fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^eval_set(?:_[a-z0-9_-]+)?\.json$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  return evalFiles.flatMap((fileName) => {
    const payload = readJson(fileName);
    return Array.isArray(payload) ? payload : [];
  });
}

export function readText(relPath) {
  return fs.readFileSync(
    path.isAbsolute(relPath)
      ? relPath
      : path.join(repoRoot, ...relPath.split("/")),
    "utf8"
  );
}

export function failWith(findings, title) {
  if (findings.length === 0) {
    console.log(`${title}: OK`);
    return;
  }
  console.error(`${title}: FAILED`);
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
}

export async function loadCaseModule(fullPath) {
  return import(pathToFileURL(fullPath).href);
}

export function isKebabStem(fileName) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*\.[a-z0-9]+$/.test(fileName);
}

export function isAllowedDirName(dirName) {
  return dirName === "_TEMPLATE" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dirName);
}

export function containsSuspiciousSecrets(text) {
  const patterns = [
    /https?:\/\/[^\s`)"']+/i,
    /\b(cookie|token|secret|authorization)\b\s*[:=]\s*["'][^"']{8,}/i
  ];
  return patterns.find((pattern) => pattern.test(text)) || null;
}
