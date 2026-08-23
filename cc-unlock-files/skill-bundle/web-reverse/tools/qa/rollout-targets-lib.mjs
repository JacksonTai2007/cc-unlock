import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./common.mjs";

function rolloutIsArchivedKnownBad(markdown) {
  return /<!--\s*rollout-governance:\s*archived-known-bad\s*-->/i.test(String(markdown || ""));
}

export function listRepoRolloutFiles() {
  return fs.readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^rollout-.+\.md$/i.test(name))
    .map((name) => path.join(repoRoot, name))
    .sort((left, right) => left.localeCompare(right));
}

export function resolveRolloutPath(target) {
  if (path.isAbsolute(target)) {
    return target;
  }
  return path.join(repoRoot, target);
}

export function extractSessionPathFromRolloutMarkdown(markdown, rolloutPath) {
  const match = String(markdown || "").match(/^- File:\s*`([^`]+)`\s*$/m);
  if (!match) {
    return "";
  }
  const raw = String(match[1] || "").trim();
  if (!raw) {
    return "";
  }
  return path.isAbsolute(raw) ? raw : path.resolve(path.dirname(rolloutPath), raw);
}

function normalizeTaskDirCandidate(rawPath, baseDir) {
  const normalized = String(rawPath || "").trim().replaceAll("/", path.sep).replaceAll("\\", path.sep);
  if (!normalized) {
    return "";
  }
  const absolute = path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(baseDir, normalized);
  const match = absolute.match(/^(.*?[\\/]+artifacts[\\/]+tasks[\\/]+[^\\/]+)(?:[\\/].*)?$/i);
  return match ? path.resolve(match[1]) : "";
}

function extractTaskDirsFromText(text, baseDir) {
  const findings = new Set();
  const source = String(text || "");
  const patterns = [
    /[A-Za-z]:[\\/][^`"\r\n]*?artifacts[\\/]+tasks[\\/]+[^\\/\r\n`"]+(?:[\\/][^`"\r\n]*)?/g,
    /(?:^|[^A-Za-z0-9_.-])((?:\.{1,2}[\\/])?artifacts[\\/]+tasks[\\/]+[^\\/\s`"]+(?:[\\/][^`"\r\n]*)?)/gm
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const raw = match[1] || match[0];
      const taskDir = normalizeTaskDirCandidate(raw, baseDir);
      if (taskDir) {
        findings.add(taskDir);
      }
    }
  }

  return Array.from(findings);
}

export function discoverRolloutTaskTargets() {
  const targets = new Set();

  for (const rolloutPath of listRepoRolloutFiles()) {
    const rolloutText = fs.readFileSync(rolloutPath, "utf8");
    if (rolloutIsArchivedKnownBad(rolloutText)) {
      continue;
    }
    for (const taskDir of extractTaskDirsFromText(rolloutText, path.dirname(rolloutPath))) {
      if (fs.existsSync(path.join(taskDir, "task.json"))) {
        targets.add(taskDir);
      }
    }

    const sessionPath = extractSessionPathFromRolloutMarkdown(rolloutText, rolloutPath);
    if (!sessionPath || !fs.existsSync(sessionPath)) {
      continue;
    }
    const sessionText = fs.readFileSync(sessionPath, "utf8");
    for (const taskDir of extractTaskDirsFromText(sessionText, path.dirname(sessionPath))) {
      if (fs.existsSync(path.join(taskDir, "task.json"))) {
        targets.add(taskDir);
      }
    }
  }

  return Array.from(targets).sort((left, right) => left.localeCompare(right));
}
