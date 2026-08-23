import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTopicPresentPaths, readTopicRegistry } from "../topic-registry.mjs";

const defaultSkillRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const skillRoot = path.resolve(process.env.ANDROID_REVERSE_SKILL_ROOT || defaultSkillRoot);
export const repoRoot = skillRoot;
export const workspaceRoot = path.resolve(process.env.ANDROID_REVERSE_WORKSPACE_ROOT || process.cwd());
export const coreTaskTemplateFiles = [
  "task.json",
  "core-task.json",
  "report.md",
  "timeline.jsonl",
  "static-evidence.jsonl",
  "runtime-evidence.jsonl",
  "network.jsonl",
  "memory-evidence.jsonl",
  "logcat.jsonl",
  "state/route-state.json",
  "state/route-plan.md",
  "state/clues.md",
  "state/progress.md",
  "state/attempt-ledger.md",
  "run/verify-once.mjs",
  "run/closeout.mjs",
  "run/run-local.mjs",
  "run/fixtures.json",
  "run/validate-fixture.mjs"
];

export function getTasksRoot(root = workspaceRoot) {
  return path.join(path.resolve(root), "artifacts", "tasks");
}

export const tasksRoot = getTasksRoot();
export const templateTaskDir = path.join(skillRoot, "artifacts", "tasks", "_TEMPLATE");
export const templateTaskCoreDir = path.join(templateTaskDir, "core");
export const templateTaskPacksDir = path.join(templateTaskDir, "topic-packs");
export const compatibilityExtensionDir = path.join(templateTaskDir, "extensions");
export const coreTaskTemplatePath = path.join(templateTaskDir, "task.json");
export const defaultTaskTemplatePath = path.join(templateTaskDir, "task.json");
export const extensionDir = compatibilityExtensionDir;

export const phaseOrder = [
  "Observe",
  "Capture",
  "Rebuild",
  "Patch",
  "PureExtraction",
  "Port"
];

export const historyDataFileRelPaths = [
  "task.json",
  "state/route-state.json",
  "report.md",
  "run/fixtures.json"
];

export function exists(filePath) {
  return fs.existsSync(filePath);
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

export function readTextFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function writeTextFile(filePath, text) {
  fs.writeFileSync(filePath, text);
}

export function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, "\n").trim();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function pathInsideDir(targetPath, dirPath) {
  const rel = path.relative(path.resolve(dirPath), path.resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePhaseName(value) {
  const raw = cleanText(value);
  if (!raw) {
    return "";
  }
  const match = phaseOrder.find((phase) => phase.toLowerCase() === raw.toLowerCase());
  if (match) {
    return match;
  }
  const map = new Map([
    ["init", "Observe"],
    ["sync", "Observe"],
    ["observe", "Observe"],
    ["capture", "Capture"],
    ["rebuild", "Rebuild"],
    ["patch", "Patch"],
    ["pureextraction", "PureExtraction"],
    ["pure-extraction", "PureExtraction"],
    ["port", "Port"],
    ["close", "Port"],
    ["complete", "Port"],
    ["completed", "Port"],
    ["cleanupandhandoff", "Port"],
    ["cleanup-and-handoff", "Port"]
  ]);
  return map.get(raw.toLowerCase()) || raw;
}

function normalizeProtectionTierValue(value) {
  const match = cleanText(value).match(/^[at]?(\d+)$/i);
  return match ? `A${Number(match[1])}` : cleanText(value);
}

function getValueByPath(target, valuePath) {
  return String(valuePath || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), target);
}

function uniqTexts(values = []) {
  return Array.from(
    new Set(
      values
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  );
}

function normalizeCriteriaItems(...values) {
  const result = [];
  const seen = new Set();

  for (const value of values) {
    const entries = Array.isArray(value) ? value : (cleanText(value) ? [value] : []);
    for (const entry of entries) {
      let normalized = null;
      if (entry && typeof entry === "object") {
        const label = cleanText(entry.label || entry.title || entry.text || entry.criteria || entry.value);
        normalized = label ? { ...entry, label } : { ...entry };
      } else {
        const text = cleanText(entry);
        normalized = text || null;
      }
      if (!normalized) {
        continue;
      }
      const key = typeof normalized === "string"
        ? normalized
        : JSON.stringify(normalized);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

function normalizeDeliverableStatus(value) {
  const status = cleanText(value).toLowerCase();
  return ["in-progress", "blocked", "acceptance-ready", "delivered", "rejected"].includes(status)
    ? status
    : "in-progress";
}

function normalizeDeliverables(task) {
  if (!Array.isArray(task.deliverables)) {
    return [];
  }

  return task.deliverables
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => {
      const tier = cleanText(item.tier || item.deliverableTier || task.deliverableTier || "T1").toUpperCase();
      return {
        ...item,
        id: cleanText(item.id) || `deliverable-${index + 1}`,
        tier: /^T[1-5]$/.test(tier) ? tier : "T1",
        criteriaIds: uniqTexts(item.criteriaIds || []),
        status: normalizeDeliverableStatus(item.status),
        required: item.required !== false
      };
    });
}

function mergeDefaultsDeep(target, defaults) {
  if (defaults == null) {
    return target;
  }
  if (target == null) {
    return clone(defaults);
  }
  if (Array.isArray(defaults)) {
    return Array.isArray(target) ? target : clone(defaults);
  }
  if (typeof defaults !== "object") {
    return target === undefined ? defaults : target;
  }
  if (typeof target !== "object" || Array.isArray(target)) {
    return target;
  }

  const next = { ...target };
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in next) || next[key] == null) {
      next[key] = clone(value);
      continue;
    }
    next[key] = mergeDefaultsDeep(next[key], value);
  }
  return next;
}

function textHasToken(haystack, candidate) {
  const token = cleanText(candidate).toLowerCase();
  if (!token || token.length < 3) {
    return false;
  }
  if (/[^a-z0-9]/i.test(token)) {
    return haystack.includes(token);
  }
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, "i").test(haystack);
}

function listRunCandidates(workspaceRootDir) {
  const runDir = path.join(workspaceRootDir, "run");
  if (!exists(runDir)) {
    return [];
  }
  return fs
    .readdirSync(runDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(runDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function relFromRepo(filePath, root = workspaceRoot) {
  return path.relative(path.resolve(root), filePath).replaceAll("\\", "/");
}

export function taskFile(taskDir, relPath) {
  return path.join(taskDir, ...relPath.split("/"));
}

export function fileExistsInTask(taskDir, relPath) {
  return exists(taskFile(taskDir, relPath));
}

export function inferWorkspaceRootFromTaskDir(taskDir) {
  let current = path.resolve(taskDir);
  while (true) {
    const parent = path.dirname(current);
    const maybeTasksDir = path.basename(parent);
    const maybeArtifactsDir = path.basename(path.dirname(parent));
    if (maybeTasksDir === "tasks" && maybeArtifactsDir === "artifacts") {
      return path.dirname(path.dirname(parent));
    }
    if (parent === current) {
      return path.dirname(path.resolve(taskDir));
    }
    current = parent;
  }
}

export function readTaskJson(taskDir, options = {}) {
  return normalizeLoadedTask(taskDir, readJsonFile(taskFile(taskDir, "task.json")), options);
}

export function writeTaskJson(taskDir, task) {
  const next = { ...task };
  delete next.__taskDir;
  writeJsonFile(taskFile(taskDir, "task.json"), next);
}

export function safeReadText(filePath) {
  try {
    return readTextFile(filePath);
  } catch {
    return "";
  }
}

export function safeReadTaskText(taskDir, relPath) {
  return safeReadText(taskFile(taskDir, relPath));
}

function bridgeLegacyTaskShape(task) {
  if (!cleanText(task.phase)) {
    task.phase = normalizePhaseName(task.currentStage || task.stage || task.currentPhase) || "Observe";
  } else {
    task.phase = normalizePhaseName(task.phase);
  }

  if (!cleanText(task.protectionTier)) {
    const legacyTier = normalizeProtectionTierValue(
      task.protectionLevel ||
      task.targetContext?.protectionTier ||
      task.targetContext?.protectionLevel
    );
    task.protectionTier = legacyTier || null;
  } else {
    task.protectionTier = normalizeProtectionTierValue(task.protectionTier) || null;
  }

  task.runtime ||= {};
  if (task.currentStage && !cleanText(task.runtime.lastCompletedStage)) {
    task.runtime.lastCompletedStage = normalizePhaseName(task.currentStage);
  }
  // Compatibility bridge for previously generated task-locals.
  task.executionContext ||= task.browserSession || {};

  task.targetContext ||= {};
  task.target ||= {};
  // Accept legacy web-style fields while normalizing onto Android-neutral targetSignals.
  const targetSignals = uniqTexts([
    ...(Array.isArray(task.targetContext.targetSignals) ? task.targetContext.targetSignals : []),
    ...(Array.isArray(task.targetContext.targetUrlPatterns) ? task.targetContext.targetUrlPatterns : []),
    task.target.packageName,
    task.target.componentName,
    task.target.entrypoint,
    task.target.endpoint,
    task.target.apiUrl,
    task.target.pageUrl
  ]);
  task.targetContext.targetSignals = targetSignals;
  task.targetContext.targetKeywords ||= [];
  task.targetContext.targetFunctionNames ||= [];
  if (!cleanText(task.targetContext.targetActionDescription)) {
    task.targetContext.targetActionDescription =
      cleanText(task.title) ||
      cleanText(task.objective) ||
      cleanText(task.targetContext.objective);
  }
  if (!cleanText(task.targetContext.inputTarget)) {
    task.targetContext.inputTarget = cleanText(
      task.target.packageName ||
      task.target.componentName ||
      task.target.entrypoint ||
      task.target.endpoint ||
      task.target.apiUrl ||
      task.target.pageUrl
    );
  }

  task.deliveryRequirements ||= {};
  if (cleanText(task.target.apiUrl || task.target.endpoint)) {
    task.deliveryRequirements.apiCallExampleRequired ||= true;
  }
  if (task.deliveryRequirements.apiCallExampleRequired === true) {
    task.deliveryRequirements.localReproductionRequested = true;
  }
  if (Number(task.schemaVersion || 1) >= 2) {
    task.patchBaseline ||= {
      status: "not-started",
      sourceArtifactSha256: "",
      resignedArtifactSha256: "",
      signatureVerified: false,
      installed: false,
      launched: false,
      usedUninstall: false,
      userApprovedDataReset: false,
      evidenceRefs: []
    };
    task.patchRegressionMatrix ||= [];
    task.userAcceptance ||= {
      status: "not-requested",
      evidenceRefs: [],
      confirmedAt: ""
    };
  }
}

function safeReadJson(filePath) {
  try {
    return readJsonFile(filePath);
  } catch {
    return null;
  }
}

function rootKeyForValuePath(valuePath) {
  return String(valuePath || "").split(".").filter(Boolean)[0] || "";
}

function isStrongFreeTextCandidate(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  const genericTokens = new Set([
    "api",
    "env",
    "focus",
    "hook",
    "memory",
    "nonce",
    "query",
    "rebuild",
    "runtime",
    "schema",
    "sign",
    "signature",
    "state",
    "storage",
    "stream",
    "token"
  ]);

  if (genericTokens.has(normalized)) {
    return false;
  }

  return normalized.length >= 6 || /[^a-z0-9]/i.test(normalized);
}

function collectRouteStateHints(taskDir) {
  if (taskFileMatchesTemplate(taskDir, "state/route-state.json")) {
    return [];
  }

  const routeState = safeReadJson(taskFile(taskDir, "state/route-state.json"));
  if (!routeState || typeof routeState !== "object") {
    return [];
  }

  return uniqTexts([
    ...(Array.isArray(routeState.activeTracks) ? routeState.activeTracks : []),
    ...(Array.isArray(routeState.activeEntrypoints) ? routeState.activeEntrypoints : []),
    ...(Array.isArray(routeState.tracks)
      ? routeState.tracks.flatMap((track) => [track?.id, track?.title, track?.name, track?.track])
      : []),
    ...(Array.isArray(routeState.entrypoints)
      ? routeState.entrypoints.flatMap((entrypoint) => [
          entrypoint?.id,
          entrypoint?.targetTrack,
          ...(Array.isArray(entrypoint?.boundTopics) ? entrypoint.boundTopics : [])
        ])
      : []),
    ...(Array.isArray(routeState.clues) ? routeState.clues.flatMap((clue) => [clue?.sourceTrack]) : [])
  ]);
}

function collectRoutePlanHints(taskDir) {
  if (taskFileMatchesTemplate(taskDir, "state/route-plan.md")) {
    return [];
  }
  return Array.from(safeReadTaskText(taskDir, "state/route-plan.md").matchAll(/^###\s+(.+)$/gm)).map((match) => match[1]);
}

function collectProgressHints(taskDir) {
  if (taskFileMatchesTemplate(taskDir, "state/progress.md")) {
    return [];
  }

  const rows = [];
  for (const line of safeReadTaskText(taskDir, "state/progress.md").split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cleanText(cell));
    if (cells.length < 1 || !cells[0] || cells[0] === "---" || /^(track|线路)$/i.test(cells[0])) {
      continue;
    }
    rows.push(cells[0]);
  }
  return rows;
}

function hasTouchedTopicArtifacts(taskDir, topic) {
  return getTopicPackFiles(topic).some((relPath) => exists(taskFile(taskDir, relPath)) && !taskFileMatchesTemplate(taskDir, relPath));
}

function hasPlaceholderTopicExtensionState(task, topic) {
  const extensionFile = getTopicExtensionFile(topic);
  if (!extensionFile) {
    return false;
  }

  const extensionTemplate = loadExtensionTemplate(extensionFile);
  const rootKeys = Object.keys(extensionTemplate || {});
  if (rootKeys.length === 0) {
    return false;
  }

  return rootKeys.every((key) => JSON.stringify(task?.[key]) === JSON.stringify(extensionTemplate?.[key]));
}

function collectTopicHintSources(taskDir, task) {
  const structured = uniqTexts([
    task.taskId,
    task.title,
    task.target?.packageName,
    task.target?.componentName,
    task.target?.entrypoint,
    task.target?.endpoint,
    task.target?.apiUrl,
    task.targetContext?.objective,
    task.targetContext?.inputTarget,
    task.targetContext?.targetActionDescription,
    ...(task.targetContext?.targetSignals || []),
    ...(task.targetContext?.targetKeywords || []),
    ...(task.targetContext?.targetFunctionNames || []),
    ...(task.routeState?.activeTracks || []),
    ...(task.routeState?.activeEntrypoints || [])
  ]);

  return {
    structuredText: structured.join("\n").toLowerCase(),
    routeText: [...collectRouteStateHints(taskDir), ...collectRoutePlanHints(taskDir), ...collectProgressHints(taskDir)]
      .join("\n")
      .toLowerCase(),
    reportText: taskFileMatchesTemplate(taskDir, "report.md") ? "" : safeReadTaskText(taskDir, "report.md").toLowerCase(),
    cluesText: taskFileMatchesTemplate(taskDir, "state/clues.md")
      ? ""
      : safeReadTaskText(taskDir, "state/clues.md").toLowerCase()
  };
}

function collectTopicEvidence(taskDir, task, topic, hintSources) {
  const explicitSelections = uniqTexts([
    ...(task.taskPacks?.selectedTopics || []),
    ...(task.taskPacks?.selectedExtensions || []),
    ...(task.taskPacks?.explicitTopics || []),
    ...(task.taskPacks?.explicitExtensions || [])
  ]);
  const selected = explicitSelections.some((value) => getTopicBySpecifier(value)?.key === topic.key);
  const touchedArtifacts = hasTouchedTopicArtifacts(taskDir, topic);
  const placeholderExtension = hasPlaceholderTopicExtensionState(task, topic);
  const presentPathHit = getTopicPresentPaths(topic).some((valuePath) => getValueByPath(task, valuePath) === true);
  const routeCandidates = uniqTexts([topic.key, topic.routeTrack, ...getTopicTaskInit(topic).aliases]);
  const routeHit = routeCandidates.some((candidate) => textHasToken(hintSources.routeText, candidate));
  const structuredHit = routeCandidates.some((candidate) => textHasToken(hintSources.structuredText, candidate));
  const freeTextCandidates = uniqTexts([
    topic.routeTrack,
    ...getTopicTaskInit(topic).aliases,
    ...(topic.signals || [])
  ]).filter(isStrongFreeTextCandidate);
  const reportHits = freeTextCandidates.filter((candidate) => textHasToken(hintSources.reportText, candidate));
  const clueHits = freeTextCandidates.filter((candidate) => textHasToken(hintSources.cluesText, candidate));
  const presentEvidence = presentPathHit && (!placeholderExtension || touchedArtifacts || routeHit || structuredHit);

  return {
    selected,
    touchedArtifacts,
    presentEvidence,
    routeHit,
    structuredHit,
    reportHits,
    clueHits
  };
}

export function inferTopicKeysForTask(taskDir, task) {
  const inferred = new Set(
    uniqTexts([
      ...(task.taskPacks?.selectedTopics || []),
      ...(task.taskPacks?.selectedExtensions || []),
      ...(task.taskPacks?.explicitTopics || []),
      ...(task.taskPacks?.explicitExtensions || [])
    ])
      .map((value) => getTopicBySpecifier(value)?.key)
      .filter(Boolean)
  );
  const hintSources = collectTopicHintSources(taskDir, task);

  for (const topic of listRegistryTopics()) {
    const evidence = collectTopicEvidence(taskDir, task, topic, hintSources);
    if (evidence.selected || evidence.presentEvidence) {
      inferred.add(topic.key);
      continue;
    }

    const corroboratedFreeText = evidence.reportHits.length > 0 && evidence.clueHits.length > 0;
    const multipleFreeTextHits = new Set([...evidence.reportHits, ...evidence.clueHits]).size >= 2;

    if (evidence.routeHit || (evidence.structuredHit && evidence.touchedArtifacts) || corroboratedFreeText || multipleFreeTextHits) {
      inferred.add(topic.key);
    }
  }

  return Array.from(inferred).sort();
}

function ensureTopicPackArtifacts(taskDir, topicKeys) {
  for (const topicKey of topicKeys) {
    const topic = getTopicBySpecifier(topicKey);
    const packDir = getTopicPackDir(topic);
    if (!topic || !packDir || !exists(packDir)) {
      continue;
    }
    for (const relPath of getTopicPackFiles(topic)) {
      const targetPath = taskFile(taskDir, relPath);
      if (exists(targetPath)) {
        continue;
      }
      const sourcePath = path.join(packDir, ...relPath.split("/"));
      if (!exists(sourcePath)) {
        continue;
      }
      ensureDir(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

export function ensureTaskDeliveryArtifacts(taskDir, task) {
  const requiresLocalReproduction =
    task?.deliveryRequirements?.localReproductionRequested === true ||
    task?.deliveryRequirements?.apiCallExampleRequired === true;

  if (requiresLocalReproduction) {
    ensureTaskFileFromTemplate(taskDir, "run/verification.spec.json");
  }
}

export function copyDirRecursive(srcDir, destDir, options = {}) {
  const { skip = new Set() } = options;
  ensureDir(destDir);

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (skip.has(entry.name)) {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, options);
    } else {
      ensureDir(path.dirname(destPath));
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyMissingDirRecursive(srcDir, destDir, options = {}) {
  const { skip = new Set() } = options;
  ensureDir(destDir);

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (skip.has(entry.name)) {
      continue;
    }
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyMissingDirRecursive(srcPath, destPath, options);
      continue;
    }
    if (exists(destPath)) {
      continue;
    }
    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
  }
}

export function copyCoreTaskScaffold(taskDir, options = {}) {
  const { skip = new Set() } = options;

  for (const relPath of coreTaskTemplateFiles) {
    if (skip.has(relPath)) {
      continue;
    }

    const sourcePath = taskFile(templateTaskDir, relPath);
    if (!exists(sourcePath)) {
      continue;
    }

    const targetPath = taskFile(taskDir, relPath);
    if (exists(targetPath)) {
      continue;
    }

    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function walkRelativeFiles(dirPath, baseDir = dirPath) {
  if (!exists(dirPath)) {
    return [];
  }

  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkRelativeFiles(fullPath, baseDir));
    } else {
      results.push(path.relative(baseDir, fullPath).replaceAll("\\", "/"));
    }
  }
  return results.sort((left, right) => left.localeCompare(right));
}

export function ensureTaskFileFromTemplate(taskDir, relPath) {
  const targetPath = taskFile(taskDir, relPath);
  if (exists(targetPath)) {
    return false;
  }
  const templateCandidates = [
    taskFile(templateTaskDir, relPath),
    taskFile(templateTaskCoreDir, relPath)
  ];
  const templatePath = templateCandidates.find((candidate) => exists(candidate));
  if (!templatePath) {
    return false;
  }
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(templatePath, targetPath);
  return true;
}

export function taskFileMatchesTemplate(taskDir, relPath) {
  const targetPath = taskFile(taskDir, relPath);
  if (!exists(targetPath)) {
    return false;
  }
  const templateCandidates = [
    taskFile(templateTaskDir, relPath),
    taskFile(templateTaskCoreDir, relPath)
  ];
  for (const candidate of templateCandidates) {
    if (!exists(candidate)) {
      continue;
    }
    if (safeReadText(candidate) === safeReadText(targetPath)) {
      return true;
    }
  }
  return false;
}

function writeProxyScript(targetPath, sourcePath, workspaceRootDir) {
  ensureDir(path.dirname(targetPath));
  const relativeSource = relFromRepo(sourcePath, workspaceRootDir);
  const useEsm = targetPath.endsWith(".mjs");
  const script = useEsm
    ? [
        'import { spawnSync } from "node:child_process";',
        'import path from "node:path";',
        'import { fileURLToPath } from "node:url";',
        "",
        "const here = path.dirname(fileURLToPath(import.meta.url));",
        `const target = path.resolve(here, ${JSON.stringify(path.relative(path.dirname(targetPath), sourcePath))});`,
        "const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {",
        "  stdio: 'inherit',",
        "  env: process.env",
        "});",
        "if (result.error) {",
        "  throw result.error;",
        "}",
        "process.exit(result.status ?? 1);",
        ""
      ].join("\n")
    : [
        "const { spawnSync } = require('node:child_process');",
        "const path = require('node:path');",
        "",
        `const target = path.resolve(__dirname, ${JSON.stringify(path.relative(path.dirname(targetPath), sourcePath))});`,
        "const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {",
        "  stdio: 'inherit',",
        "  env: process.env",
        "});",
        "if (result.error) {",
        "  throw result.error;",
        "}",
        "process.exit(result.status ?? 1);",
        ""
      ].join("\n");
  fs.writeFileSync(targetPath, script);
  return relativeSource;
}

function findWorkspaceScriptCandidate(workspaceRootDir, preferredNames = [], matcher = null) {
  const candidates = listRunCandidates(workspaceRootDir)
    .filter((filePath) => !pathInsideDir(filePath, getTasksRoot(workspaceRootDir)));
  for (const preferredName of preferredNames) {
    const match = candidates.find((filePath) => path.basename(filePath).toLowerCase() === preferredName.toLowerCase());
    if (match) {
      return match;
    }
  }
  if (typeof matcher === "function") {
    return candidates.find((filePath) => matcher(path.basename(filePath).toLowerCase(), filePath)) || null;
  }
  return null;
}

export function ensureTaskScaffold(taskDir, task) {
  copyCoreTaskScaffold(taskDir, {
    skip: new Set(["task.json", "core-task.json"])
  });
  const inferredTopics = syncTaskTopicCoverage(taskDir, task);
  ensureTopicPackArtifacts(taskDir, inferredTopics);
  ensureTaskDeliveryArtifacts(taskDir, task);
}

export function ensureTaskWorkspaceBridges(taskDir, task) {
  const workspaceRootDir = inferWorkspaceRootFromTaskDir(taskDir);
  const references = [];
  const bridgeSpecs = [
    {
      relPath: "run/verify-once.mjs",
      preferredNames: ["verify-once.mjs", "verify-once.js"],
      matcher: null
    },
    {
      relPath: "run/run-local.mjs",
      preferredNames: ["run-local.mjs", "verify-once.mjs", "verify-once.js"],
      matcher: null
    }
  ];

  if (task.deliveryRequirements?.localReproductionRequested === true) {
    bridgeSpecs.push({
      relPath: "run/local-repro-example.js",
      preferredNames: ["local-repro-example.js", "local-repro-example.mjs"],
      matcher: (name) => /^example[-_.].+\.(?:mjs|js)$/i.test(name) || /^example\.(?:mjs|js)$/i.test(name)
    });
  }

  if (task.deliveryRequirements?.apiCallExampleRequired === true) {
    bridgeSpecs.push({
      relPath: "run/api-call-example.js",
      preferredNames: ["api-call-example.js", "api-call-example.mjs", "web-replay.js", "web-replay.mjs"],
      matcher: (name) =>
        /^example[-_.].+\.(?:mjs|js)$/i.test(name) ||
        /(?:api|replay|search).+\.(?:mjs|js)$/i.test(name)
    });
  }

  for (const spec of bridgeSpecs) {
    const targetPath = taskFile(taskDir, spec.relPath);
    const shouldBackfill = !exists(targetPath) || taskFileMatchesTemplate(taskDir, spec.relPath);
    if (!shouldBackfill) {
      continue;
    }
    const candidate = findWorkspaceScriptCandidate(workspaceRootDir, spec.preferredNames, spec.matcher);
    if (!candidate || pathInsideDir(candidate, taskDir)) {
      continue;
    }
    const relativeSource = writeProxyScript(targetPath, candidate, workspaceRootDir);
    references.push({
      relPath: spec.relPath,
      source: relativeSource
    });
  }

  task.workspaceArtifacts ||= {};
  task.workspaceArtifacts.bridgedScripts = references;
}

export function listTaskDirs(options = {}) {
  const { includeTemplate = false, workspace = workspaceRoot } = options;
  const resolvedTasksRoot = getTasksRoot(workspace);
  if (!exists(resolvedTasksRoot)) {
    return [];
  }

  return fs
    .readdirSync(resolvedTasksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => includeTemplate || entry.name !== "_TEMPLATE")
    .map((entry) => path.join(resolvedTasksRoot, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export function listWorkspaceHistoryFiles(workspace = workspaceRoot) {
  const files = [];
  for (const taskDir of listTaskDirs({ workspace })) {
    for (const relPath of historyDataFileRelPaths) {
      const fullPath = taskFile(taskDir, relPath);
      if (exists(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export function workspaceHasHistoryFiles(workspace = workspaceRoot) {
  return listWorkspaceHistoryFiles(workspace).length > 0;
}

export function resolveTaskDir(taskRef, options = {}) {
  const resolvedWorkspaceRoot = path.resolve(options.workspaceRoot || workspaceRoot);
  if (!taskRef) {
    throw new Error("taskRef is required");
  }
  if (path.isAbsolute(taskRef)) {
    return taskRef;
  }
  if (taskRef.includes("/") || taskRef.includes("\\")) {
    return path.resolve(resolvedWorkspaceRoot, taskRef);
  }
  return path.join(getTasksRoot(resolvedWorkspaceRoot), taskRef);
}

export function normalizeFlag(flag) {
  return String(flag).toLowerCase().replace(/^--/, "").replace(/[^a-z0-9]+/g, "");
}

export function normalizeTopicKey(value) {
  return normalizeFlag(value);
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

export function getTopicTaskInit(topicOrKey) {
  const topic = typeof topicOrKey === "string" ? getTopicBySpecifier(topicOrKey) : topicOrKey;
  const raw = topic?.taskInit || {};
  return {
    aliases: uniqStrings(raw.aliases || []),
    baseProtectionTier: String(raw.baseProtectionTier || "A0").trim() || "A0",
    combinationProtectionTiers: Array.isArray(raw.combinationProtectionTiers)
      ? raw.combinationProtectionTiers
          .map((item) => ({
            withTopics: uniqStrings(item?.withTopics || []),
            tier: String(item?.tier || "").trim()
          }))
          .filter((item) => item.withTopics.length > 0 && item.tier)
      : []
  };
}

function getTopicSpecifiers(topic) {
  const extensionFile = getTopicExtensionFile(topic);
  const extensionStem = extensionFile ? path.basename(extensionFile, path.extname(extensionFile)) : "";
  const taskInit = getTopicTaskInit(topic);
  return uniqStrings([
    topic?.key,
    topic?.routeTrack,
    extensionFile,
    extensionStem,
    ...taskInit.aliases
  ]);
}

function normalizeSelectedTopics(specifiers = []) {
  const selected = [];
  const seen = new Set();

  for (const value of specifiers) {
    const topic = typeof value === "string" ? getTopicBySpecifier(value) : value;
    if (!topic || seen.has(topic.key)) {
      continue;
    }
    seen.add(topic.key);
    selected.push(topic);
  }

  return selected;
}

function parseProtectionTierRank(value) {
  const match = String(value || "").trim().match(/^[at]?(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function formatProtectionTier(rank) {
  return `A${Math.max(0, Number(rank) || 0)}`;
}

export function listRegistryTopics() {
  return readTopicRegistry();
}

export function getTopicBySpecifier(specifier) {
  const normalized = normalizeTopicKey(specifier);
  const topic =
    listRegistryTopics().find((topic) =>
      getTopicSpecifiers(topic).some((candidate) => normalizeTopicKey(candidate) === normalized)
    ) || null;

  return topic;
}

export function getTopicExtensionFile(topic) {
  return topic?.taskModelFile ? path.basename(topic.taskModelFile) : null;
}

export function getTopicPackDir(topicOrKey) {
  const topic = typeof topicOrKey === "string" ? getTopicBySpecifier(topicOrKey) : topicOrKey;
  if (!topic?.taskPackDir) {
    return null;
  }
  return path.join(skillRoot, ...String(topic.taskPackDir).split("/"));
}

export function getTopicExtensionSourcePath(topicOrKey) {
  const topic = typeof topicOrKey === "string" ? getTopicBySpecifier(topicOrKey) : topicOrKey;
  const packDir = getTopicPackDir(topic);
  if (!packDir) {
    return null;
  }
  const sourcePath = path.join(packDir, "extension.json");
  return exists(sourcePath) ? sourcePath : null;
}

export function getTopicByExtensionFile(extensionFile) {
  const normalized = String(extensionFile || "").toLowerCase();
  return (
    listRegistryTopics().find((topic) => String(getTopicExtensionFile(topic) || "").toLowerCase() === normalized) || null
  );
}

function normalizeTemplateTaskPath(filePath) {
  const marker = "artifacts/tasks/_TEMPLATE/";
  if (typeof filePath !== "string") {
    return null;
  }
  return filePath.startsWith(marker) ? filePath.slice(marker.length) : filePath;
}

export function getTopicPackFiles(topic) {
  const files = new Set();
  const packDir = getTopicPackDir(topic);

  for (const relPath of walkRelativeFiles(packDir)) {
    if (relPath === "extension.json") {
      continue;
    }
    files.add(relPath);
  }

  for (const filePath of topic?.taskPackFiles || []) {
    const normalized = normalizeTemplateTaskPath(filePath);
    if (normalized) {
      files.add(normalized);
    }
  }

  return Array.from(files).sort();
}

export function clone(value) {
  return structuredClone(value);
}

export function mergeDeep(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra)) {
    return clone(extra);
  }

  if (
    base &&
    extra &&
    typeof base === "object" &&
    typeof extra === "object"
  ) {
    const merged = { ...clone(base) };
    for (const [key, value] of Object.entries(extra)) {
      if (key in merged) {
        merged[key] = mergeDeep(merged[key], value);
      } else {
        merged[key] = clone(value);
      }
    }
    return merged;
  }

  return clone(extra);
}

export function loadCoreTaskTemplate() {
  return readJsonFile(coreTaskTemplatePath);
}

export function loadExtensionTemplate(fileName) {
  const topic = getTopicByExtensionFile(fileName);
  const sourcePath = getTopicExtensionSourcePath(topic);
  if (sourcePath) {
    return readJsonFile(sourcePath);
  }
  return readJsonFile(path.join(extensionDir, fileName));
}

export function buildTaskFromTemplates(options = {}) {
  const {
    taskId,
    protectionTier,
    extensionFiles = []
  } = options;

  let task = loadCoreTaskTemplate();
  for (const fileName of extensionFiles) {
    task = mergeDeep(task, loadExtensionTemplate(fileName));
  }

  if (taskId) {
    task.taskId = taskId;
  }
  if (protectionTier) {
    task.protectionTier = protectionTier;
  }

  return task;
}

export function inferProtectionTier(extensionFiles) {
  const topics = normalizeSelectedTopics(extensionFiles);
  const selectedKeys = new Set(topics.map((topic) => topic.key));
  let bestRank = 0;

  for (const topic of topics) {
    const taskInit = getTopicTaskInit(topic);
    bestRank = Math.max(bestRank, parseProtectionTierRank(taskInit.baseProtectionTier));

    for (const combo of taskInit.combinationProtectionTiers) {
      const requiredKeys = combo.withTopics
        .map((value) => getTopicBySpecifier(value)?.key || String(value || "").trim())
        .filter(Boolean);
      if (requiredKeys.every((key) => selectedKeys.has(key))) {
        bestRank = Math.max(bestRank, parseProtectionTierRank(combo.tier));
      }
    }
  }

  return formatProtectionTier(bestRank);
}

export function syncTaskTopicCoverage(taskDir, task) {
  let nextTask = task;
  const explicitTopicKeys = uniqTexts([
    ...(task.taskPacks?.explicitTopics || []),
    ...(task.taskPacks?.explicitExtensions || [])
  ])
    .map((value) => getTopicBySpecifier(value)?.key)
    .filter(Boolean);
  const baseTopicKeys = explicitTopicKeys.length > 0
    ? explicitTopicKeys
    : uniqTexts([...(task.taskPacks?.selectedTopics || []), ...(task.taskPacks?.selectedExtensions || [])])
        .map((value) => getTopicBySpecifier(value)?.key)
        .filter(Boolean);
  const inferredTopics = explicitTopicKeys.length > 0 ? [] : inferTopicKeysForTask(taskDir, task);
  const topicKeys = uniqTexts([...baseTopicKeys, ...inferredTopics])
    .map((value) => getTopicBySpecifier(value)?.key)
    .filter(Boolean);
  const extensionFiles = uniqTexts([
    ...(task.taskPacks?.explicitExtensions || []),
    ...topicKeys
      .map((topicKey) => getTopicExtensionFile(getTopicBySpecifier(topicKey)))
      .filter(Boolean)
  ]);

  for (const extensionFile of extensionFiles) {
    nextTask = mergeDefaultsDeep(nextTask, loadExtensionTemplate(extensionFile));
  }

  for (const key of Object.keys(task)) {
    if (!(key in nextTask)) {
      delete task[key];
    }
  }
  Object.assign(task, nextTask);

  task.taskPacks ||= {};
  task.taskPacks.mode = topicKeys.length > 0 ? "selected-topic-packs" : task.taskPacks.mode || "core-only";
  task.taskPacks.explicitTopics ||= [];
  task.taskPacks.explicitExtensions ||= [];
  task.taskPacks.selectedTopics = topicKeys;
  task.taskPacks.selectedExtensions = extensionFiles;

  return topicKeys;
}

function normalizeTaskRoots(task, taskDir) {
  const inferredWorkspaceRoot = inferWorkspaceRootFromTaskDir(taskDir);
  task.roots ||= {};
  task.roots.skillRoot = path.resolve(task.roots.skillRoot || skillRoot);
  const currentWorkspaceRoot = cleanText(task.roots.workspaceRoot);
  if (!currentWorkspaceRoot || !pathInsideDir(taskDir, currentWorkspaceRoot)) {
    task.roots.workspaceRoot = inferredWorkspaceRoot;
  } else {
    task.roots.workspaceRoot = path.resolve(currentWorkspaceRoot);
  }
}

function normalizeLoadedTask(taskDir, inputTask, options = {}) {
  const task = structuredClone(inputTask || {});
  normalizeTaskRoots(task, taskDir);
  bridgeLegacyTaskShape(task);
  ensureTaskRuntimeShape(task);
  if (options.syncTopicCoverage === true) {
    syncTaskTopicCoverage(taskDir, task);
  }
  task.__taskDir = taskDir;
  return task;
}

export function ensureTaskRuntimeShape(task) {
  task.roots ||= {};
  task.roots.skillRoot ||= skillRoot;
  task.roots.workspaceRoot ||= workspaceRoot;

  task.routeState ||= {};
  task.routeState.activeTracks ||= [];
  task.routeState.activeEntrypoints ||= [];
  task.routeState.syncStatus ||= "not-started";
  task.routeState.mode ||= "task-local";
  task.routeState.statePath ||= "state/route-state.json";
  task.routeState.planPath ||= "state/route-plan.md";
  task.routeState.cluesPath ||= "state/clues.md";
  task.routeState.progressPath ||= "state/progress.md";
  task.routeState.executionStatus ||= "not-evaluated";
  task.routeState.nextEntrypointId ||= "";
  task.routeState.nextExecutableAction ||= "";
  task.routeState.pauseCategory ||= "none";
  task.routeState.pauseReason ||= "";
  task.routeState.lastAdvancedAt ||= "";
  task.routeState.toolReadiness ||= { tools: {} };
  task.routeState.approachHistory ||= [];
  task.routeState.patchCandidates ||= [];
  task.routeState.validationRuns ||= [];
  task.routeState.completionGate ||= {
    status: "not-started",
    criteriaStatus: [],
    missingEvidence: [],
    updatedAt: ""
  };

  task.taskPacks ||= {};
  task.taskPacks.mode ||= "core-only";
  task.taskPacks.explicitTopics ||= [];
  task.taskPacks.explicitExtensions ||= [];
  task.taskPacks.selectedTopics ||= [];
  task.taskPacks.selectedExtensions ||= [];

  task.validation ||= {};
  task.validation.status ||= "not-started";
  task.validation.lastVerifiedAt ||= "";
  task.validation.notes ||= [];

  task.firstDivergence ||= {};
  task.firstDivergence.status ||= "not-recorded";
  task.firstDivergence.location ||= "";
  task.firstDivergence.notes ||= [];

  const canonicalCriteria = normalizeCriteriaItems(task.completionCriteria);
  const criteria = canonicalCriteria.length > 0
    ? canonicalCriteria
    : normalizeCriteriaItems(task.successCriteria);
  task.completionCriteria = criteria;
  task.objective = cleanText(task.objective || task.targetContext?.objective || task.targetContext?.targetActionDescription);
  task.deliverableTier = cleanText(task.deliverableTier || task.deliveryRequirements?.deliverableTier || "T1");
  const schemaVersion = Number(task.schemaVersion || 1);
  if (schemaVersion >= 2) {
    task.schemaVersion = schemaVersion;
    task.deliverables = normalizeDeliverables(task);
    if (task.deliverables.length === 0) {
      task.deliverables = [
        {
          id: "primary",
          tier: /^T[1-5]$/.test(task.deliverableTier.toUpperCase()) ? task.deliverableTier.toUpperCase() : "T1",
          criteriaIds: criteria
            .map((item) => (item && typeof item === "object" ? cleanText(item.id) : ""))
            .filter(Boolean),
          status: "in-progress",
          required: true
        }
      ];
    }
    task.currentDeliverableId = cleanText(task.currentDeliverableId) || task.deliverables[0].id;
    if (task.deliverables.length === 1) {
      task.deliverableTier = task.deliverables[0].tier;
    }
  }
  task.disallowedFallbacks = uniqTexts(task.disallowedFallbacks || []);
  task.userRejectedApproaches = uniqTexts(task.userRejectedApproaches || []);
  task.deliveryRequirements ||= {};
  task.deliveryRequirements.localReproductionRequested ||= false;
  task.deliveryRequirements.apiCallExampleRequired ||= false;
  if (task.deliveryRequirements.apiCallExampleRequired === true) {
    task.deliveryRequirements.localReproductionRequested = true;
  }
  task.workspaceArtifacts ||= {};
  task.workspaceArtifacts.bridgedScripts ||= [];
  task.toolchain ||= {};
  task.toolchain.declaredMcpTools ||= [];
  task.toolchain.preferredTools ||= [];
  task.toolchain.unavailableTools ||= [];
  task.toolchain.foregroundRequirements ||= [];
  task.runtime ||= {};
  task.executionContext ||= {};
  const normalizedDeviceMode = cleanText(task.executionContext.deviceMode).toLowerCase();
  task.executionContext.deviceMode = ["none", "emulator", "physical"].includes(normalizedDeviceMode)
    ? normalizedDeviceMode
    : "none";
  if (typeof task.executionContext.deviceReady !== "boolean") {
    task.executionContext.deviceReady = task.executionContext.deviceMode !== "none";
  }
  if (typeof task.executionContext.rooted !== "boolean") {
    task.executionContext.rooted = null;
  }
  task.targetContext ||= {};
  task.targetContext.targetSignals ||= [];
  task.targetContext.targetKeywords ||= [];
  task.targetContext.targetFunctionNames ||= [];
  task.boundaries ||= {};
  return task;
}

export function nowIso() {
  return new Date().toISOString();
}
