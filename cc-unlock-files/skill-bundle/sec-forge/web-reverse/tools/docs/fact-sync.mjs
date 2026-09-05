import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTopicRegistryFromSource } from "../topic-manifests.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const maturityOrder = ["synthetic-e2e", "guided", "closed-loop", "reference-only"];

const blockTargets = [
  {
    path: "SKILL.md",
    blockId: "topic-maturity-summary",
    render: renderSkillTopicMaturitySummary
  },
  {
    path: "README.md",
    blockId: "topic-maturity-summary",
    render: renderReadmeTopicMaturitySummary
  }
];

function normalizeEol(text) {
  return String(text).replace(/\r\n/g, "\n");
}

function sortTopics(topics) {
  return [...topics].sort((left, right) => String(left.key || "").localeCompare(String(right.key || "")));
}

function listTopicsByMaturity(topics, maturity) {
  return sortTopics(topics).filter((topic) => topic.maturity === maturity);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatTopicNames(topics) {
  return topics.length === 0 ? "none published yet" : topics.map((topic) => `\`${topic.key}\``).join(", ");
}

function renderReadmeTopicMaturitySummary(topics) {
  return maturityOrder.map((maturity) => {
    const group = listTopicsByMaturity(topics, maturity);
    return `- \`${maturity}\` (\`${group.length}\`): ${formatTopicNames(group)}`;
  }).join("\n");
}

function renderSkillTopicMaturitySummary(topics) {
  return renderReadmeTopicMaturitySummary(topics);
}

function replaceGeneratedBlock(text, blockId, replacement) {
  const startMarker = `<!-- BEGIN GENERATED: ${blockId} -->`;
  const endMarker = `<!-- END GENERATED: ${blockId} -->`;
  const pattern = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`);
  if (!pattern.test(text)) {
    throw new Error(`missing generated block markers for ${blockId}`);
  }
  return text.replace(pattern, `${startMarker}\n${replacement.trimEnd()}\n${endMarker}`);
}

function renderExpectedFile(relPath, topics) {
  const fullPath = path.join(repoRoot, ...relPath.split("/"));
  let text = fs.readFileSync(fullPath, "utf8");
  for (const target of blockTargets.filter((item) => item.path === relPath)) {
    text = replaceGeneratedBlock(text, target.blockId, target.render(topics));
  }
  return text;
}

export function collectDocFactSyncFindings(topics = readTopicRegistryFromSource()) {
  const findings = [];
  const relPaths = Array.from(new Set(blockTargets.map((target) => target.path)));
  for (const relPath of relPaths) {
    const fullPath = path.join(repoRoot, ...relPath.split("/"));
    const actual = normalizeEol(fs.readFileSync(fullPath, "utf8"));
    const expected = normalizeEol(renderExpectedFile(relPath, topics));
    if (actual !== expected) {
      findings.push(`${relPath} is out of date with topic manifests`);
    }
  }
  return findings;
}

export function syncDocFactFiles(topics = readTopicRegistryFromSource()) {
  const relPaths = Array.from(new Set(blockTargets.map((target) => target.path)));
  for (const relPath of relPaths) {
    const fullPath = path.join(repoRoot, ...relPath.split("/"));
    const next = renderExpectedFile(relPath, topics);
    if (fs.readFileSync(fullPath, "utf8") !== next) {
      fs.writeFileSync(fullPath, next, "utf8");
    }
  }
}
