import path from "node:path";
import {
  allowedRootDirs,
  allowedRootFiles,
  failWith,
  isAllowedDirName,
  isKebabStem,
  rel,
  repoRoot,
  walk
} from "./common.mjs";

const findings = [];

for (const entry of walk(repoRoot, {
  includeFiles: false,
  includeDirs: true,
  skip: new Set(["dist", "node_modules", ".git", ".idea", ".vscode"])
})) {
  const relative = rel(entry);
  const parts = relative.split("/");
  if (parts[0] === ".history" || parts[0].startsWith(".")) {
    continue;
  }
  if (parts.length === 1) {
    if (!allowedRootDirs.has(parts[0])) {
      findings.push(`root directory is not allowed: ${relative}`);
    }
    continue;
  }
  const name = path.basename(entry);
  if (!isAllowedDirName(name)) {
    findings.push(`directory must use kebab-case or _TEMPLATE: ${relative}`);
  }
}

for (const entry of walk(repoRoot, {
  includeFiles: true,
  includeDirs: false,
  skip: new Set(["dist", "node_modules", ".git", ".idea", ".vscode"])
})) {
  const relative = rel(entry);
  const parts = relative.split("/");
  const name = path.basename(entry);
  if (parts[0] === ".history" || parts[0].startsWith(".")) {
    continue;
  }
  if (parts.length === 1 && /^rollout-.*\.md$/i.test(name)) {
    continue;
  }
  if (parts[0] === "legacy") {
    continue;
  }
  if (parts.length === 1) {
    if (!allowedRootFiles.has(name)) {
      findings.push(`root file is not allowed: ${relative}`);
    }
    continue;
  }
  if (name === "README.md") {
    continue;
  }
  if (!isKebabStem(name)) {
    findings.push(`file must use kebab-case naming: ${relative}`);
  }
}

failWith(findings, "check-naming");
