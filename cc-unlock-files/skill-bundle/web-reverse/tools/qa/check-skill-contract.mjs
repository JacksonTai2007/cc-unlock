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

function parseOpenAiYaml(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines[0] !== "interface:") {
    throw new Error("agents/openai.yaml must start with interface:");
  }

  const values = new Map();
  for (const line of lines.slice(1)) {
    const match = line.match(/^ {2}([A-Za-z0-9_-]+):\s*"([^"]*)"$/);
    if (!match) {
      throw new Error(`invalid agents/openai.yaml line: ${line}`);
    }
    values.set(match[1], match[2]);
  }
  return values;
}

if (!frontmatterMatch) {
  findings.push("SKILL.md is missing YAML frontmatter");
} else {
  let values = new Map();
  try {
    values = parseSimpleFrontmatter(frontmatterMatch[1]);
  } catch (error) {
    findings.push(`failed to parse SKILL.md frontmatter: ${error.message}`);
  }

  const allowedKeys = new Set(["name", "description"]);
  for (const key of values.keys()) {
    if (!allowedKeys.has(key)) {
      findings.push(`SKILL.md frontmatter may only contain name/description, found: ${key}`);
    }
  }
  for (const key of allowedKeys) {
    if (!values.has(key)) {
      findings.push(`SKILL.md frontmatter is missing: ${key}`);
    }
  }

  const skillName = String(values.get("name") || "");
  const description = String(values.get("description") || "");
  if (skillName && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillName)) {
    findings.push(`SKILL.md name must be kebab-case, got: ${skillName}`);
  }
  if (description.length > 260) {
    findings.push(`SKILL.md description is too long: ${description.length}`);
  }
  for (const needle of ["普通前端开发", "漏洞利用", "Android 逆向"]) {
    if (description && !description.includes(needle)) {
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
  if (finding.startsWith("SKILL.md ")) {
    findings.push(`SKILL.md generated maturity summary is out of date: ${finding}`);
  }
}

if (!exists("agents/openai.yaml")) {
  findings.push("agents/openai.yaml is missing");
} else {
  try {
    const values = parseOpenAiYaml(readText("agents/openai.yaml"));
    for (const field of ["display_name", "short_description", "default_prompt"]) {
      if (!values.has(field)) {
        findings.push(`agents/openai.yaml is missing: ${field}`);
      }
    }

    const displayName = String(values.get("display_name") || "");
    const shortDescription = String(values.get("short_description") || "");
    const defaultPrompt = String(values.get("default_prompt") || "");

    if (displayName.length === 0 || displayName.length > 24) {
      findings.push(`agents/openai.yaml display_name must be 1-24 chars, got ${displayName.length}`);
    }
    if (shortDescription.length === 0 || shortDescription.length > 60) {
      findings.push(`agents/openai.yaml short_description must be 1-60 chars, got ${shortDescription.length}`);
    }
    if (defaultPrompt.length === 0 || defaultPrompt.length > 520) {
      findings.push(`agents/openai.yaml default_prompt must be 1-520 chars, got ${defaultPrompt.length}`);
    }
    if (displayName && !/逆向|reverse/i.test(displayName)) {
      findings.push("agents/openai.yaml display_name must mention reverse");
    }
    if (shortDescription && !/签名|补环境|协议|混淆|逆向/.test(shortDescription)) {
      findings.push("agents/openai.yaml short_description must mention core reverse capability");
    }
    for (const needle of [
      "bootstrap",
      "workflow",
      "task-local",
      "task-advance",
      "assert-can-reply",
      "task-start",
      "task-init",
      "history data files",
      "--force-new-task"
    ]) {
      if (defaultPrompt && !defaultPrompt.includes(needle)) {
        findings.push(`agents/openai.yaml default_prompt is missing: ${needle}`);
      }
    }
  } catch (error) {
    findings.push(`failed to parse agents/openai.yaml: ${error.message}`);
  }
}

if (exists("tools/build") || exists("dist/publishable-skill")) {
  findings.push("user delivery repo must not keep tools/build or dist/publishable-skill");
}

failWith(findings, "check-skill-contract");
