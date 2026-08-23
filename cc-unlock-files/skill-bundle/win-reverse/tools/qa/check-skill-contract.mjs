import { exists, failWith, readText } from "./common.mjs";
import { collectDocFactSyncFindings } from "../docs/fact-sync.mjs";

const findings = [];
const raw = readText("SKILL.md");
const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

function parseSimpleFrontmatter(block) {
  const values = new Map();
  for (const line of String(block || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      throw new Error(`cannot parse frontmatter line: ${trimmed}`);
    }
    values.set(match[1], match[2]);
  }
  return values;
}

if (!frontmatterMatch) {
  findings.push("SKILL.md is missing YAML frontmatter");
} else {
  const values = parseSimpleFrontmatter(frontmatterMatch[1]);
  if (String(values.get("name") || "") !== "win-reverse") {
    findings.push("SKILL.md frontmatter name is out of sync");
  }
  const description = String(values.get("description") || "");
  for (const needle of ["普通 Windows 开发", "未授权漏洞利用", "非 Windows"]) {
    if (!description.includes(needle)) {
      findings.push(`SKILL.md description is missing boundary text: ${needle}`);
    }
  }
}

for (const marker of [
  "<!-- BEGIN GENERATED: topic-maturity-summary -->",
  "<!-- END GENERATED: topic-maturity-summary -->"
]) {
  if (!raw.includes(marker)) {
    findings.push(`SKILL.md is missing generated maturity marker: ${marker}`);
  }
}

for (const finding of collectDocFactSyncFindings()) {
  if (finding.startsWith("SKILL.md ") || finding.startsWith("README.md ")) {
    findings.push(`generated maturity summary is out of date: ${finding}`);
  }
}

if (!exists("agents/openai.yaml")) {
  findings.push("agents/openai.yaml is missing");
}

failWith(findings, "check-skill-contract");

