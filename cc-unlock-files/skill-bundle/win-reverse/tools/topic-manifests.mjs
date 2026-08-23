import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const topicManifestRoot = path.join(repoRoot, "topics");
export const generatedTopicRouteMatrixPath = path.join(
  repoRoot,
  "docs",
  "reference",
  "topic-route-matrix.json"
);
export const generatedCapabilityMatrixPath = path.join(
  repoRoot,
  "docs",
  "reference",
  "capability-matrix.md"
);

const maturityOrder = ["synthetic-e2e", "closed-loop", "guided", "reference-only"];
const maturityLabels = {
  "synthetic-e2e": "结构化任务模型、专题 QA、知识覆盖与 synthetic 回归全部已具备。",
  "closed-loop": "结构化任务模型与专题 QA 已具备，但 synthetic 回归尚未发布。",
  guided: "已具备 registry-backed 指导能力，但仍低于 closed-loop 与 synthetic 保证级别。",
  "reference-only": "已有参考资料，但尚无 registry-backed 的执行契约。"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function uniqStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function uniqObjects(values = []) {
  const seen = new Set();
  const results = [];
  for (const value of values) {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(value);
  }
  return results;
}

function normalizeTaskInit(taskInit = {}) {
  const aliases = uniqStrings(taskInit.aliases || []);
  const baseProtectionTier = String(taskInit.baseProtectionTier || "T0").trim() || "T0";
  const combinationProtectionTiers = Array.isArray(taskInit.combinationProtectionTiers)
    ? taskInit.combinationProtectionTiers
        .map((item) => ({
          withTopics: uniqStrings(item?.withTopics || []),
          tier: String(item?.tier || "").trim()
        }))
        .filter((item) => item.withTopics.length > 0 && item.tier)
    : [];

  return {
    aliases,
    baseProtectionTier,
    combinationProtectionTiers
  };
}

function collectCheckConditions(groups = []) {
  return groups.flatMap((group) => (group?.checks || []).filter(Boolean));
}

function normalizeTemplateTaskPath(filePath) {
  const marker = "artifacts/tasks/_TEMPLATE/";
  if (typeof filePath !== "string") {
    return null;
  }
  return filePath.startsWith(marker) ? filePath.slice(marker.length) : filePath;
}

function templateTaskFileExists(filePath) {
  const normalized = normalizeTemplateTaskPath(filePath);
  return (
    Boolean(normalized) &&
    fs.existsSync(path.join(repoRoot, "artifacts", "tasks", "_TEMPLATE", ...normalized.split("/")))
  );
}

function walkFiles(dirPath, baseDir = dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, baseDir));
    } else {
      results.push(path.relative(baseDir, fullPath).replaceAll("\\", "/"));
    }
  }
  return results.sort((left, right) => left.localeCompare(right));
}

function buildPackTemplateFiles(topic) {
  const packDir = String(topic?.taskPackDir || "").trim();
  if (!packDir) {
    return [];
  }

  return walkFiles(path.join(repoRoot, ...packDir.split("/")))
    .filter((relativePath) => relativePath !== "extension.json")
    .map((relativePath) => relativePath);
}

function normalizeTopic(topic) {
  const requiredArtifacts = uniqStrings([
    ...(topic?.requiredArtifacts || []),
    ...(topic?.formalValidation?.requiredArtifacts || [])
  ]);
  const requiredTaskFlags = uniqObjects([
    ...(topic?.requiredTaskFlags || []),
    topic?.taskSemantics?.presentPath
      ? {
          path: topic.taskSemantics.presentPath,
          equals: true
        }
      : null,
    ...(topic?.taskSemantics?.requiredValues || []),
    ...(topic?.formalValidation?.requirementsAll || []).filter((item) => item?.path),
    ...collectCheckConditions(topic?.formalValidation?.requirementsAny).filter((item) => item?.path),
    ...collectCheckConditions(topic?.formalValidation?.phaseGuards?.flatMap((guard) => guard?.requirementsAny || []))
      .filter((item) => item?.path),
    ...(topic?.formalValidation?.phaseGuards || [])
      .flatMap((guard) => guard?.requirementsAll || [])
      .filter((item) => item?.path)
  ].filter(Boolean));
  const taskPackFiles = uniqStrings([
    ...buildPackTemplateFiles(topic),
    ...(topic?.taskPackFiles || []).map((filePath) => normalizeTemplateTaskPath(filePath) || filePath),
    ...(topic?.templateArtifacts || []).map((filePath) => normalizeTemplateTaskPath(filePath) || filePath),
    ...requiredArtifacts.filter((filePath) => templateTaskFileExists(filePath)).map((filePath) => normalizeTemplateTaskPath(filePath) || filePath)
  ]);

  return {
    ...topic,
    taskInit: normalizeTaskInit(topic?.taskInit),
    requiredSignals: uniqStrings([...(topic?.requiredSignals || []), ...(topic?.signals || [])]),
    requiredArtifacts,
    requiredTaskFlags,
    taskPackFiles
  };
}

export function listTopicKeys() {
  if (!fs.existsSync(topicManifestRoot)) {
    return [];
  }

  return fs
    .readdirSync(topicManifestRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function readTopicManifest(key) {
  return readJson(path.join(topicManifestRoot, key, "topic.json"));
}

export function readTopicRegistryFromSource() {
  return listTopicKeys().map((key) => normalizeTopic(readTopicManifest(key)));
}

function compareTopics(left, right) {
  const maturityDelta = maturityOrder.indexOf(String(left?.maturity || "")) - maturityOrder.indexOf(String(right?.maturity || ""));
  if (maturityDelta !== 0) {
    return maturityDelta;
  }
  return String(left?.key || "").localeCompare(String(right?.key || ""));
}

function sortTopics(topics) {
  return [...topics].sort(compareTopics);
}

function countTopicsByMaturity(topics) {
  const counts = Object.fromEntries(maturityOrder.map((level) => [level, 0]));
  for (const topic of topics) {
    const level = String(topic?.maturity || "").trim();
    if (!Object.hasOwn(counts, level)) {
      counts[level] = 0;
    }
    counts[level] += 1;
  }
  return counts;
}

function formatNames(topics) {
  return topics.length === 0 ? "none" : topics.map((topic) => `\`${topic.key}\``).join(", ");
}

function formatList(values = []) {
  return values.length === 0 ? "none" : values.map((value) => `\`${value}\``).join(", ");
}

function formatPathList(values = []) {
  return values.length === 0 ? "none" : values.map((value) => `\`${path.basename(value)}\``).join(", ");
}

function formatCombinationProtectionTiers(values = []) {
  if (values.length === 0) {
    return "none";
  }
  return values
    .map((item) => `\`${item.withTopics.join("+")} -> ${item.tier}\``)
    .join(", ");
}

function renderTopicTable(topics) {
  const lines = [
    "| Topic | Maturity | Owner | Risk | Route | Required Checks |",
    "|---|---|---|---|---|---|"
  ];

  for (const topic of sortTopics(topics)) {
    lines.push(
      `| \`${topic.key}\` | \`${topic.maturity}\` | \`${topic.owner}\` | \`${topic.riskLevel}\` | \`${topic.routeTrack}\` | ${formatList(topic.requiredChecks || [])} |`
    );
  }

  return lines.join("\n");
}

export function renderTopicRouteMatrix(topics = readTopicRegistryFromSource(), generatedAt = new Date().toISOString()) {
  return `${JSON.stringify(
    {
      schemaVersion: 2,
      generatedAt,
      source: "topics/*/topic.json",
      topics: sortTopics(topics)
    },
    null,
    2
  )}\n`;
}

export function renderCapabilityMatrix(topics = readTopicRegistryFromSource()) {
  const counts = countTopicsByMaturity(topics);
  const lines = [
    "<!-- publish: framework -->",
    "# Capability Matrix",
    "",
    "The canonical topic source now lives under `topics/<topic>/topic.json`.",
    "`docs/reference/topic-route-matrix.json` is a generated registry view for QA, publish, and review.",
    "",
    "## Maturity Summary",
    "",
    ...maturityOrder.map((level) => `- \`${level}\`: \`${counts[level] || 0}\` 个专题；${maturityLabels[level]}`),
    "",
    "## Topic Table",
    "",
    renderTopicTable(topics),
    "",
    "## Topic Detail",
    ""
  ];

  for (const topic of sortTopics(topics)) {
    lines.push(`### \`${topic.key}\``);
    lines.push("");
    lines.push(`- 名称: ${topic.label}`);
    lines.push(`- 成熟度: \`${topic.maturity}\``);
    lines.push(`- 维护方: \`${topic.owner}\``);
    lines.push(`- 风险等级: \`${topic.riskLevel}\``);
    lines.push(`- 路线轨道: \`${topic.routeTrack}\``);
    lines.push(`- 协议文档: \`${topic.protocol}\``);
    lines.push(`- taskPackDir: \`${topic.taskPackDir}\``);
    lines.push(`- taskModelFile: \`${topic.taskModelFile}\``);
    lines.push(
      `- taskInit: aliases=${formatList(topic.taskInit?.aliases || [])}, baseProtectionTier=\`${topic.taskInit?.baseProtectionTier || "T0"}\`, combinationProtectionTiers=${formatCombinationProtectionTiers(topic.taskInit?.combinationProtectionTiers || [])}`
    );
    lines.push(`- 必需 signals: ${formatList(topic.requiredSignals || [])}`);
    lines.push(`- 必需检查: ${formatList(topic.requiredChecks || [])}`);
    lines.push(`- caseFiles: ${formatPathList(topic.caseFiles || [])}`);
    lines.push(`- taskPackFiles: ${formatPathList(topic.taskPackFiles || [])}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function writeGeneratedTopicDocs() {
  const topics = readTopicRegistryFromSource();
  const generatedAt = new Date().toISOString();
  writeText(generatedTopicRouteMatrixPath, renderTopicRouteMatrix(topics, generatedAt));
  writeText(generatedCapabilityMatrixPath, renderCapabilityMatrix(topics));
}
