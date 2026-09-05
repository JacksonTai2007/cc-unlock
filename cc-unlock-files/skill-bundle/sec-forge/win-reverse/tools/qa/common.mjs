import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

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

export function containsSuspiciousSecrets(text) {
  const patterns = [
    /https?:\/\/[^\s`)"']+/i,
    /\b(cookie|token|secret|authorization|license|apikey)\b\s*[:=]\s*["'][^"']{8,}/i
  ];
  return patterns.find((pattern) => pattern.test(text)) || null;
}

