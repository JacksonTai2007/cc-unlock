import fs from "node:fs";
import path from "node:path";
import { failWith, repoRoot, walk, rel } from "./common.mjs";

const textExts = new Set([".md", ".json", ".jsonl", ".yaml", ".yml", ".mjs", ".js", ".txt"]);
const decoder = new TextDecoder("utf-8", { fatal: true });
const findings = [];

for (const entry of walk(repoRoot, {
  includeFiles: true,
  includeDirs: false,
  skip: new Set(["node_modules", "dist"])
})) {
  const ext = path.extname(entry).toLowerCase();
  if (!textExts.has(ext)) {
    continue;
  }

  const buffer = fs.readFileSync(entry);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    findings.push(`文件包含 UTF-8 BOM: ${rel(entry)}`);
    continue;
  }

  try {
    decoder.decode(buffer);
  } catch {
    findings.push(`文件不是有效 UTF-8: ${rel(entry)}`);
  }
}

failWith(findings, "check-utf8");
