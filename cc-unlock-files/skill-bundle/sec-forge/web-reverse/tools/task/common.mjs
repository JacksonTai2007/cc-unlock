import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTopicPresentPaths, readTopicRegistry } from "../topic-registry.mjs";

const defaultSkillRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const skillRoot = path.resolve(process.env.WEB_REVERSE_SKILL_ROOT || defaultSkillRoot);
export const repoRoot = skillRoot;

function findWorkspaceRootFromPointer(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    const pointerPath = path.join(current, ".web-reverse-workspace-root");
    if (fs.existsSync(pointerPath)) {
      try {
        const stored = fs.readFileSync(pointerPath, "utf8").trim();
        if (stored && fs.existsSync(path.join(stored, "artifacts", "tasks"))) {
          return path.resolve(stored);
        }
      } catch {
        // ignore malformed pointer
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

// workspaceRoot 是「任务数据真源」的根，必须落在用户的当前工作目录（cwd），
// 而不是 SKILL 包目录（skillRoot）。当工具链通过 $TOOL_DIR 从独立的 SKILL 包被
// 调用时，若回退到 skillRoot，task-sync/advance 会去包目录里找任务并 ENOENT。
// 优先级：1) 显式 env（父进程传播）2) .web-reverse-workspace-root 文件（向上搜索）
// 3) process.cwd()。从包根运行时 cwd===skillRoot，行为与旧默认一致。
export const workspaceRoot = path.resolve(
  process.env.WEB_REVERSE_WORKSPACE_ROOT ||
  findWorkspaceRootFromPointer(process.cwd()) ||
  process.cwd()
);
export const coreTaskTemplateFiles = [
  "task.json",
  "core-task.json",
  "report.md",
  "state/route-state.json",
  "state/task-contract.md",
  "state/acceptance-checklist.md",
  "state/route-plan.md",
  "state/clues.md",
  "state/narrative.md",
  "state/progress.md",
  "state/fact-observations.json",
  "state/candidate-insights.json",
  "state/external-research.json",
  "state/external-research.md",
  "run/verify-once.mjs",
  "run/closeout.mjs",
  "run/run-local.mjs",
  "run/fixtures.json",
  "run/validate-fixture.mjs"
];

function readSkillNameFromFrontmatter(rootDir) {
  try {
    const skillPath = path.join(path.resolve(rootDir), "SKILL.md");
    const text = fs.readFileSync(skillPath, "utf8");
    const match = text.match(/^---\r?\n[\s\S]*?^name:\s*([^\r\n]+)\s*$/m);
    return String(match?.[1] || "").trim();
  } catch {
    return "";
  }
}

export function samePath(left, right) {
  return path.resolve(left || ".") === path.resolve(right || ".");
}

export function getInstalledSkillsRootCandidates() {
  const codexHome = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), ".codex");
  return Array.from(
    new Set([
      path.join(codexHome, "skills"),
      path.join(os.homedir(), ".codex", "skills"),
      path.join(os.homedir(), ".skillshub")
    ])
  );
}

export function getInstalledSkillsRoot() {
  return getInstalledSkillsRootCandidates()[0];
}

export function resolveInstalledSkillRoots(baseRoot = skillRoot) {
  const resolvedBaseRoot = path.resolve(baseRoot);
  const skillName = readSkillNameFromFrontmatter(resolvedBaseRoot);
  const candidates = [];

  for (const installedSkillsRoot of getInstalledSkillsRootCandidates()) {
    for (const value of [skillName, path.basename(resolvedBaseRoot)]) {
      const normalized = String(value || "").trim();
      if (!normalized) {
        continue;
      }
      candidates.push(path.join(installedSkillsRoot, normalized));
    }
  }

  return Array.from(new Set(candidates)).filter((candidate) => (
    fs.existsSync(path.join(candidate, "SKILL.md")) &&
    (
      fs.existsSync(path.join(candidate, "tools")) ||
      fs.existsSync(path.join(candidate, "artifacts"))
    )
  ));
}

export function resolveInstalledSkillRoot(baseRoot = skillRoot) {
  const resolvedBaseRoot = path.resolve(baseRoot);
  const installedRoots = resolveInstalledSkillRoots(resolvedBaseRoot);
  for (const candidate of installedRoots) {
    if (
      !samePath(candidate, resolvedBaseRoot)
    ) {
      return candidate;
    }
  }

  return resolvedBaseRoot;
}

export function getTasksRoot(root = workspaceRoot) {
  return path.join(path.resolve(root), "artifacts", "tasks");
}

// 红线2 机械门禁共用白名单：workspace 根目录顶层「合法非产物文件」。
// SKILL.md「产物纪律」与 collectStrayWorkspaceArtifacts 共用此常量，避免文档与门禁漂移。
// 注意：`artifacts/` 是产物落地目录（任务真源），白名单只针对**顶层文件**，目录另行放行。
// P2-2：追加常见 JS/TS/Python 项目配置文件，避免外部 workspace 里既有配置被误报为散落产物。
// 点文件（.eslintrc/.prettierrc 等）已通过 startsWith(".") 全量放行，无需单列。
export const WORKSPACE_ROOT_ALLOWLIST = new Set([
  "SKILL.md",
  "README.md",
  ".web-reverse-tool-dir",
  ".web-reverse-workspace-root",
  ".gitignore",
  "package.json",
  "package-lock.json",
  // JS/TS 构建 & 工具链配置
  "tsconfig.json",
  "tsconfig.base.json",
  "jsconfig.json",
  "jest.config.js",
  "jest.config.mjs",
  "jest.config.cjs",
  "jest.config.ts",
  "vitest.config.js",
  "vitest.config.mjs",
  "vitest.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "webpack.config.js",
  "webpack.config.mjs",
  "webpack.config.ts",
  "rollup.config.js",
  "rollup.config.mjs",
  "rollup.config.ts",
  "babel.config.js",
  "babel.config.mjs",
  "babel.config.json",
  "postcss.config.js",
  "postcss.config.mjs",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.ts",
  "eslint.config.js",
  "eslint.config.mjs",
  "next.config.js",
  "next.config.mjs",
  "nuxt.config.js",
  "nuxt.config.mjs",
  "nuxt.config.ts",
  // Python 项目配置
  "setup.py",
  "setup.cfg",
  "pyproject.toml",
  "requirements.txt",
  "requirements-dev.txt",
  "Pipfile",
  // 通用项目文件
  "Makefile",
  "Dockerfile",
  ".dockerignore",
  "yarn.lock",
  "pnpm-lock.yaml"
]);

// 命中即视为「散落产物」的扩展名（脚本 / 数据），逆向工作脚本与中间数据都在内。
const STRAY_ARTIFACT_EXT = /\.(?:mjs|cjs|js|ts|py|json|jsonl)$/i;

// 取本任务的「开机基线时间」（P1-T2 修复）：
// 优先级：1) task.json 中的 createdAt 字段（由 task-init 写入，不被 task-sync 刷新）；
//          2) workspace 根目录 .web-reverse-workspace-root 指针文件的 mtime（task-boot 写入，不被 sync 刷新）；
//          3) 退化为 task.json 的 mtime（续跑时 task-sync 会刷新此值，可能偏晚导致漏报）。
// 仅把「mtime 晚于该基线」的根目录文件判定为本任务新产物，避免误报外部 workspace
// 里用户原有的项目文件（架P0#1 / 技实战建议要求的误报防护）。
function getTaskBootBaselineMs(taskDir) {
  // 优先：task.json createdAt 字段（稳定，不被 sync 刷新）。
  try {
    const raw = JSON.parse(fs.readFileSync(taskFile(taskDir, "task.json"), "utf8"));
    const createdAt = String(raw?.createdAt || "").trim();
    if (createdAt) {
      const ts = Date.parse(createdAt);
      if (ts > 0) {
        return ts;
      }
    }
  } catch {
    // 继续尝试下一级
  }
  // 次选：.web-reverse-workspace-root 指针文件的 mtime（task-boot 首次写入后不再刷新）。
  try {
    const inferredRoot = inferWorkspaceRootFromTaskDir(taskDir);
    if (inferredRoot) {
      const pointerPath = path.join(inferredRoot, ".web-reverse-workspace-root");
      if (fs.existsSync(pointerPath)) {
        return fs.statSync(pointerPath).mtimeMs;
      }
    }
  } catch {
    // 继续尝试下一级
  }
  // 退化：task.json 的 mtime（续跑时可能被 task-sync 刷新，基线偏晚，但仍优于完全无基线）。
  try {
    return fs.statSync(taskFile(taskDir, "task.json")).mtimeMs;
  } catch {
    return 0;
  }
}

// 扫描 workspace 根目录顶层，找出「本任务 boot 之后新增 / 改动」且不在白名单内的脚本/数据文件。
// 这些应当落在 artifacts/tasks/<task-id>/run|state，散落根目录违反红线2。
// 返回 { stray: [相对路径], baselineMs }；stray 为空表示干净。
// 设计为纯读、无副作用，供 validation 门禁与 task-snapshot 告警 / task-cleanup 搬迁复用。
export function collectStrayWorkspaceArtifacts(taskDir, workspaceRootDir) {
  const rootDir = path.resolve(
    workspaceRootDir || inferWorkspaceRootFromTaskDir(taskDir)
  );
  const result = { stray: [], baselineMs: 0 };
  if (!rootDir || !exists(rootDir)) {
    return result;
  }
  const baselineMs = getTaskBootBaselineMs(taskDir);
  result.baselineMs = baselineMs;
  // 容差：文件系统 mtime 精度 + boot 期间写文件，允许略早于 baseline 1s 仍计入。
  const cutoffMs = baselineMs > 0 ? baselineMs - 1000 : 0;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      // 目录（含 artifacts/、node_modules/ 等）不在此门禁范围。
      continue;
    }
    if (WORKSPACE_ROOT_ALLOWLIST.has(entry.name)) {
      continue;
    }
    if (entry.name.startsWith(".")) {
      // 其它点文件（.env 等环境/配置）默认放行，不当作逆向产物。
      continue;
    }
    if (!STRAY_ARTIFACT_EXT.test(entry.name)) {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    if (cutoffMs > 0) {
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(fullPath).mtimeMs;
      } catch {
        continue;
      }
      // 早于基线 = 用户既有文件，不误报。
      if (mtimeMs < cutoffMs) {
        continue;
      }
    }
    result.stray.push(entry.name);
  }

  result.stray.sort((left, right) => left.localeCompare(right));
  return result;
}

export const tasksRoot = getTasksRoot();
export const templateTaskDir = path.join(skillRoot, "artifacts", "tasks", "_TEMPLATE");
export const templateTaskCoreDir = path.join(templateTaskDir, "core");
export const templateTaskPacksDir = path.join(templateTaskDir, "topic-packs");
export const compatibilityExtensionDir = path.join(templateTaskDir, "extensions");
export const coreTaskTemplatePath = path.join(templateTaskCoreDir, "core-task.json");
export const defaultTaskTemplatePath = path.join(templateTaskCoreDir, "task.json");
export const extensionDir = compatibilityExtensionDir;

export const phaseOrder = [
  "Observe",
  "Capture",
  "Rebuild",
  "Patch",
  "PureExtraction",
  "Port",
  "Close"
];

export const historyDataFileRelPaths = [
  "task.json",
  "state/route-state.json",
  "state/task-contract.md",
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

function defineHiddenValue(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: false,
    configurable: true,
    writable: true
  });
}

export function resolveReadablePath(filePath, options = {}) {
  const rawPath = String(filePath || "").trim();
  const tried = [];
  if (!rawPath) {
    return {
      resolvedPath: "",
      tried
    };
  }

  if (path.isAbsolute(rawPath)) {
    const resolvedPath = path.resolve(rawPath);
    return {
      resolvedPath,
      tried: [resolvedPath]
    };
  }

  const baseDirs = Array.from(
    new Set(
      [
        options.workspaceRoot || workspaceRoot,
        options.cwd || process.cwd(),
        options.skillRoot || skillRoot
      ]
        .filter(Boolean)
        .map((value) => path.resolve(value))
    )
  );

  for (const baseDir of baseDirs) {
    const candidate = path.resolve(baseDir, rawPath);
    tried.push(candidate);
    if (exists(candidate)) {
      return {
        resolvedPath: candidate,
        tried
      };
    }
  }

  return {
    resolvedPath: tried[0] || path.resolve(rawPath),
    tried
  };
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
    ["close", "Close"],
    ["completed", "Close"]
  ]);
  return map.get(raw.toLowerCase()) || raw;
}

function normalizeProtectionTierValue(value) {
  const match = cleanText(value).match(/^t?(\d+)$/i);
  return match ? `T${Number(match[1])}` : cleanText(value);
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

// 合规 BL-08 / P1-5：已知商业保护 / 验证码 provider 名单（含中英文别名）。
// 命中即视为「高信号、首轮即应搜索」。这里刻意收录中文厂商名与拼音别名，
// 因为 triggerSignals 的英文正则（akamai/cloudflare…）漏掉了易盾/瑞数/数美/极验等高频国产 provider，
// 导致 search-gate「写了但不强制」——agent 只要不手动把 provider 填进 protectionHints 即可绕过。
export const KNOWN_COMMERCIAL_PROVIDER_PATTERNS = [
  /akamai|_abck|bm_sz|sensor_data/i,
  /perimeterx|perimeter\b|_px\b|px\d?[a-z]*captcha/i,
  /cloudflare|turnstile|__cf_|cf[-_]?chl/i,
  /datadome|datado(me)?/i,
  /incapsula|imperva/i,
  /kasada|kpsdk/i,
  /shape\s?security|shapesecurity/i,
  // 国产高频 provider：易盾(netease dun)、瑞数(riddler/blinking/CDN-sec)、数美(shumei/ishumei)、
  // 极验(geetest/gt)、阿里(aliyun captcha/sec)、腾讯(tencent captcha/TCaptcha)、网易、顶象(dingxiang/dx)、validate slider。
  /\b(?:yi\s?dun|yidun|dun163|163\s?dun)\b|易盾|网易盾|网易易盾/i,
  /\b(?:rui\s?shu|ruishu)\b|瑞数|\$_ts\b|_ts\b/i,
  /\b(?:shu\s?mei|shumei|ishumei)\b|数美/i,
  /\b(?:gee\s?test|geetest)\b|极验|\bgt[_-]?challenge\b/i,
  /\b(?:ding\s?xiang|dingxiang)\b|顶象|\bdx[_-]?captcha\b/i,
  /\b(?:tencent\s?captcha|tcaptcha)\b|腾讯防水墙|防水墙/i,
  /\b(?:aliyun\s?captcha|afs|nocaptcha)\b|阿里云验证码|阿里滑块/i,
  /\b(?:hcaptcha|recaptcha|funcaptcha|arkose)\b/i,
  // 通用验证码 / 风控特征词（中文）：滑块、点选、行为验证、风控、签名校验、人机校验。
  /滑块|点选验证|行为验证|人机校验|风控/i
];

// 从任意证据文本判定是否命中已知商业保护 provider，并返回命中片段（去重）。
export function detectCommercialProviderHits(text) {
  const haystack = String(text || "");
  const hits = [];
  for (const pattern of KNOWN_COMMERCIAL_PROVIDER_PATTERNS) {
    const match = haystack.match(pattern);
    if (match) {
      hits.push(cleanText(match[0]));
    }
  }
  return uniqTexts(hits);
}

// 合规 BL-08 / P1-5 核心反绕过：搜索门禁不再只看 agent 是否主动把 provider 填进 triggerSignals，
// 而是从**任务客观证据**（objective / clues.md / external-research / protectionHints / triggerSignals）
// 中机械提取商业保护信号。会话已证明：缺硬门禁的纪律项一律被绕过——agent 不填 triggerSignals
// 就让 commercial-signals-without-search 永不触发。这里把判定锚到 agent 真正会写的 objective+clues。
export function collectEvidenceCommercialSignals(taskDir, task) {
  const sources = [];
  const pushIf = (value) => {
    const text = cleanText(value);
    if (text) sources.push(text);
  };
  pushIf(task?.taskContract?.objective);
  for (const item of task?.taskContract?.nonNegotiables || []) pushIf(item);
  for (const hint of task?.targetContext?.protectionHints || []) pushIf(hint);
  pushIf(task?.targetContext?.host);
  pushIf(task?.targetContext?.targetName);
  for (const sig of task?.externalRefs?.triggerSignals || []) pushIf(sig);
  // 直接读 clues.md / external-research.md 原文：这两份是 agent 真正会落盘的证据真源。
  for (const rel of ["state/clues.md", "state/external-research.md", "state/narrative.md"]) {
    try {
      const filePath = taskFile(taskDir, rel);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        sources.push(fs.readFileSync(filePath, "utf8"));
      }
    } catch {
      // 读不到就跳过，不阻断门禁
    }
  }
  return detectCommercialProviderHits(sources.join("\n"));
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

export function readRawTaskJson(taskDir) {
  return readJsonFile(taskFile(taskDir, "task.json"));
}

function collectTypeMismatch(findings, value, expectedType, label) {
  if (value === undefined) {
    return;
  }

  if (expectedType === "array") {
    if (!Array.isArray(value)) {
      findings.push(`${label} must be an array in raw task.json`);
    }
    return;
  }

  if (expectedType === "object") {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      findings.push(`${label} must be an object in raw task.json`);
    }
    return;
  }

  if (typeof value !== expectedType) {
    findings.push(`${label} must be a ${expectedType} in raw task.json`);
  }
}

function collectStringArrayShape(findings, values, label) {
  if (values === undefined) {
    return;
  }
  if (!Array.isArray(values)) {
    findings.push(`${label} must be an array in raw task.json`);
    return;
  }
  for (const [index, value] of values.entries()) {
    if (typeof value !== "string") {
      findings.push(`${label}[${index}] must be a string in raw task.json`);
    }
  }
}

export function collectRawTaskShapeFindings(rawTask) {
  const findings = [];
  const model = rawTask?.executionModel;
  if (model === undefined) {
    return findings;
  }

  collectTypeMismatch(findings, model, "object", "executionModel");
  if (model == null || typeof model !== "object" || Array.isArray(model)) {
    return findings;
  }

  for (const field of [
    "system",
    "currentState",
    "taskMode",
    "fallbackMode",
    "primaryTopic",
    "primaryEntrypoint",
    "microRoute",
    "experimentClass",
    "highValueEvidenceGoal",
    "lastHighValueEvidence",
    "nextUpgradeGate",
    "stopLossCondition"
  ]) {
    collectTypeMismatch(findings, model[field], "string", `executionModel.${field}`);
  }

  collectStringArrayShape(findings, model.secondaryTopics, "executionModel.secondaryTopics");

  if (Object.prototype.hasOwnProperty.call(model, "roundBudget")) {
    if (!Number.isInteger(model.roundBudget) || model.roundBudget <= 0) {
      findings.push("executionModel.roundBudget must be a positive integer in raw task.json");
    }
  }

  if (Object.prototype.hasOwnProperty.call(model, "roundsConsumed")) {
    if (!Number.isInteger(model.roundsConsumed) || model.roundsConsumed < 0) {
      findings.push("executionModel.roundsConsumed must be a non-negative integer in raw task.json");
    }
  }

  const permit = model.deepDivePermit;
  if (permit !== undefined) {
    collectTypeMismatch(findings, permit, "object", "executionModel.deepDivePermit");
    if (permit && typeof permit === "object" && !Array.isArray(permit)) {
      if (Object.prototype.hasOwnProperty.call(permit, "active") && typeof permit.active !== "boolean") {
        findings.push("executionModel.deepDivePermit.active must be a boolean in raw task.json");
      }
      if (Object.prototype.hasOwnProperty.call(permit, "maxRounds")) {
        if (!Number.isInteger(permit.maxRounds) || permit.maxRounds < 0) {
          findings.push("executionModel.deepDivePermit.maxRounds must be a non-negative integer in raw task.json");
        }
      }
      for (const field of [
        "subgoal",
        "milestone",
        "exitCondition",
        "expectedHighValueEvidence",
        "currentMicroRoute",
        "permitReason",
        "reviewedAt"
      ]) {
        collectTypeMismatch(findings, permit[field], "string", `executionModel.deepDivePermit.${field}`);
      }
    }
  }

  return findings;
}

export function readTaskJson(taskDir) {
  const rawTask = readRawTaskJson(taskDir);
  return normalizeLoadedTask(taskDir, rawTask, { rawTask });
}

export function writeTaskJson(taskDir, task) {
  const next = { ...task };
  delete next.__taskDir;
  delete next.__rawTask;
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
    task.protectionTier =
      normalizeProtectionTierValue(
        task.protectionLevel ||
        task.targetContext?.protectionTier ||
        task.targetContext?.protectionLevel
      ) || "T0";
  } else {
    task.protectionTier = normalizeProtectionTierValue(task.protectionTier) || "T0";
  }

  task.runtime ||= {};
  if (task.currentStage && !cleanText(task.runtime.lastCompletedStage)) {
    task.runtime.lastCompletedStage = normalizePhaseName(task.currentStage);
  }

  task.targetContext ||= {};
  task.target ||= {};
  const targetUrls = uniqTexts([
    ...(Array.isArray(task.targetContext.targetUrlPatterns) ? task.targetContext.targetUrlPatterns : []),
    task.target.pageUrl,
    task.target.apiUrl
  ]);
  task.targetContext.targetUrlPatterns = targetUrls;
  task.targetContext.targetKeywords ||= [];
  task.targetContext.targetFunctionNames ||= [];
  if (!cleanText(task.targetContext.targetActionDescription)) {
    task.targetContext.targetActionDescription =
      cleanText(task.title) ||
      cleanText(task.objective) ||
      cleanText(task.targetContext.objective);
  }
  if (!cleanText(task.targetContext.inputTarget)) {
    task.targetContext.inputTarget = cleanText(task.target.pageUrl || task.target.apiUrl);
  }

  task.deliveryRequirements ||= {};
  if (cleanText(task.target.apiUrl)) {
    task.deliveryRequirements.apiCallExampleRequired ||= true;
  }
  if (task.deliveryRequirements.apiCallExampleRequired === true) {
    task.deliveryRequirements.localReproductionRequested = true;
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
    "challenge",
    "cookie",
    "env",
    "focus",
    "frame",
    "graphql",
    "hook",
    "memory",
    "nonce",
    "preload",
    "query",
    "rebuild",
    "replay",
    "runtime",
    "schema",
    "session",
    "sign",
    "signature",
    "state",
    "storage",
    "stream",
    "token",
    "vm",
    "wasm",
    "worker"
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
    task.target?.pageUrl,
    task.target?.apiUrl,
    task.targetContext?.objective,
    task.targetContext?.inputTarget,
    task.targetContext?.targetActionDescription,
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

export function inferActivatedTopicKeysForTask(taskDir, task) {
  const activated = new Set(
    uniqTexts([
      ...(task.taskPacks?.activatedTopics || []),
      ...(task.taskPacks?.activatedExtensions || [])
    ])
      .map((value) => getTopicBySpecifier(value)?.key)
      .filter(Boolean)
  );
  const hintSources = collectTopicHintSources(taskDir, task);

  for (const topic of listRegistryTopics()) {
    const evidence = collectTopicEvidence(taskDir, task, topic, hintSources);
    const corroboratedFreeText = evidence.reportHits.length > 0 && evidence.clueHits.length > 0;
    const multipleFreeTextHits = new Set([...evidence.reportHits, ...evidence.clueHits]).size >= 2;
    if (
      evidence.presentEvidence ||
      (evidence.routeHit && evidence.touchedArtifacts) ||
      (evidence.structuredHit && evidence.touchedArtifacts) ||
      corroboratedFreeText ||
      multipleFreeTextHits
    ) {
      activated.add(topic.key);
    }
  }

  return Array.from(activated).sort();
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
    ensureTaskFileFromTemplate(taskDir, "run/local-repro-example.js");
  }
  if (task?.deliveryRequirements?.apiCallExampleRequired === true) {
    ensureTaskFileFromTemplate(taskDir, "run/web-replay.js");
  }
}

function localizeJsonStatePlaceholder(taskDir, relPath, task, mutator) {
  const filePath = taskFile(taskDir, relPath);
  if (!exists(filePath)) {
    return false;
  }

  let payload;
  try {
    payload = readJsonFile(filePath);
  } catch {
    return false;
  }

  const nextPayload = typeof mutator === "function"
    ? mutator(structuredClone(payload))
    : structuredClone(payload);

  if (JSON.stringify(payload) === JSON.stringify(nextPayload)) {
    return false;
  }

  writeJsonFile(filePath, nextPayload);
  return true;
}

export function localizeTaskStateArtifacts(taskDir, task) {
  const taskId = cleanText(task?.taskId);
  if (!taskId) {
    return;
  }

  localizeJsonStatePlaceholder(taskDir, "state/fact-observations.json", task, (payload) => {
    if (cleanText(payload?.taskId) !== "replace-me") {
      return payload;
    }
    return {
      ...payload,
      taskId
    };
  });

  localizeJsonStatePlaceholder(taskDir, "state/candidate-insights.json", task, (payload) => {
    if (cleanText(payload?.taskId) !== "replace-me") {
      return payload;
    }
    return {
      ...payload,
      taskId
    };
  });
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

    const sourcePath = taskFile(templateTaskCoreDir, relPath);
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
    taskFile(templateTaskCoreDir, relPath),
    taskFile(templateTaskDir, relPath)
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
    taskFile(templateTaskCoreDir, relPath),
    taskFile(templateTaskDir, relPath)
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
  localizeTaskStateArtifacts(taskDir, task);
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
      relPath: "run/web-replay.js",
      preferredNames: ["web-replay.js", "web-replay.mjs"],
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

function searchTaskDirFallback(taskRef) {
  // 当标准 workspaceRoot 下找不到任务时，尝试从 skillRoot 或 cwd 的子目录回退搜索。
  // 这解决「cwd 是 SKILL 包目录但任务在外部工作区」的定位问题。
  const candidates = [];
  const skillTasksRoot = getTasksRoot(skillRoot);
  if (exists(skillTasksRoot)) {
    candidates.push(path.join(skillTasksRoot, taskRef));
  }
  const cwdTasksRoot = getTasksRoot(process.cwd());
  if (exists(cwdTasksRoot)) {
    candidates.push(path.join(cwdTasksRoot, taskRef));
  }
  for (const candidate of candidates) {
    if (exists(path.join(candidate, "task.json"))) {
      return candidate;
    }
  }
  return null;
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
  const primary = path.join(getTasksRoot(resolvedWorkspaceRoot), taskRef);
  if (exists(path.join(primary, "task.json"))) {
    return primary;
  }
  const fallback = searchTaskDirFallback(taskRef);
  if (fallback) {
    return fallback;
  }
  return primary;
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
    baseProtectionTier: String(raw.baseProtectionTier || "T0").trim() || "T0",
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
  const match = String(value || "").trim().match(/^t?(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function formatProtectionTier(rank) {
  return `T${Math.max(0, Number(rank) || 0)}`;
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
  const inferredTopics = inferTopicKeysForTask(taskDir, task);
  const inferredActivatedTopics = inferActivatedTopicKeysForTask(taskDir, task);
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
  task.taskPacks.activatedTopics = uniqTexts([
    ...(task.taskPacks.activatedTopics || []),
    ...inferredActivatedTopics
  ])
    .map((value) => getTopicBySpecifier(value)?.key || String(value || "").trim())
    .filter(Boolean)
    .filter((value) => topicKeys.includes(value));
  task.taskPacks.activatedExtensions = uniqTexts([
    ...(task.taskPacks.activatedExtensions || []),
    ...task.taskPacks.activatedTopics
  ])
    .map((value) => {
      const topic = getTopicBySpecifier(value);
      return topic ? getTopicExtensionFile(topic) : String(value || "").trim();
    })
    .filter(Boolean)
    .filter((value) => extensionFiles.includes(value));

  const inferredTier = inferProtectionTier(extensionFiles);
  if (!cleanText(task.protectionTier) || cleanText(task.protectionTier) === "T0") {
    task.protectionTier = inferredTier;
  }

  return topicKeys;
}

function normalizeTaskRoots(task, taskDir) {
  const inferredWorkspaceRoot = inferWorkspaceRootFromTaskDir(taskDir);
  task.roots ||= {};
  task.roots.skillRoot = path.resolve(task.roots.skillRoot || skillRoot);
  task.roots.taskLocalRoot = path.resolve(taskDir);
  const currentWorkspaceRoot = cleanText(task.roots.workspaceRoot);
  if (!currentWorkspaceRoot || !pathInsideDir(taskDir, currentWorkspaceRoot)) {
    task.roots.workspaceRoot = inferredWorkspaceRoot;
  } else {
    task.roots.workspaceRoot = path.resolve(currentWorkspaceRoot);
  }
}

function normalizeLoadedTask(taskDir, inputTask, options = {}) {
  const rawTask = structuredClone(options.rawTask || inputTask || {});
  const task = structuredClone(inputTask || {});
  normalizeTaskRoots(task, taskDir);
  bridgeLegacyTaskShape(task);
  ensureTaskRuntimeShape(task);
  syncTaskTopicCoverage(taskDir, task);
  defineHiddenValue(task, "__taskDir", taskDir);
  defineHiddenValue(task, "__rawTask", rawTask);
  return task;
}

export function ensureTaskRuntimeShape(task) {
  task.roots ||= {};
  task.roots.skillRoot ||= skillRoot;
  task.roots.workspaceRoot ||= workspaceRoot;
  task.roots.taskLocalRoot ||= "";

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
  task.routeState.executionDiscipline ||= {};

  task.externalRefs ||= {};
  task.externalRefs.searchStatus ||= "not-started";
  task.externalRefs.searchProvider ||= "";
  task.externalRefs.lastQueries ||= [];
  task.externalRefs.queryStats ||= [];
  task.externalRefs.featureBundle ||= {};
  task.externalRefs.matchedRefs ||= [];
  task.externalRefs.decisions ||= [];
  task.externalRefs.policy ||= {};
  task.externalRefs.policy.policyPath ||= "";
  task.externalRefs.policy.policyVersion ||= "";
  task.externalRefs.policy.lastEvaluatedAt ||= "";
  task.externalRefs.policy.mode ||= "auto";
  task.externalRefs.policy.decision ||= "not-evaluated";
  task.externalRefs.policy.reasons ||= [];
  task.externalRefs.policy.searchabilityScore ||= 0;
  task.externalRefs.policy.metrics ||= {};
  task.externalRefs.entrypointDrafts ||= [];
  task.externalRefs.probeDrafts ||= [];
  task.externalRefs.reconciliation ||= {};
  task.externalRefs.reconciliation.generatedAt ||= "";
  task.externalRefs.reconciliation.summary ||= {};
  task.externalRefs.reconciliation.summary.merge ||= 0;
  task.externalRefs.reconciliation.summary.review ||= 0;
  task.externalRefs.reconciliation.summary.reject ||= 0;
  task.externalRefs.reconciliation.suggestions ||= [];
  task.externalRefs.lastAppliedAt ||= "";
  task.externalRefs.notes ||= [];
  task.externalRefs.searchMode ||= "auto";
  task.externalRefs.searchRounds ||= 0;
  task.externalRefs.lastSearchRound = Math.max(0, Number(task.externalRefs.lastSearchRound) || 0);
  // Auto-detect triggerSignals from task context (merge with any manually-set signals)
  const autoSignals = [];
  if (task.runtime?.wasmPresent === true) autoSignals.push("wasm");
  const allTopics = uniqTexts([...(task.taskPacks?.selectedTopics || []), ...(task.taskPacks?.activatedTopics || [])]);
  for (const topic of allTopics) {
    if (/wasm|jsvmp|media-drm|signature|protocol/i.test(topic)) autoSignals.push(topic);
  }
  const protectionHints = uniqTexts(task.targetContext?.protectionHints || []);
  for (const hint of protectionHints) {
    if (/wasm|jsvmp|\bvmp\b|commercial|drm|_cn|_ak|_bm|sensor|turnstile|perimeter|akamai|cloudflare/i.test(hint)) {
      autoSignals.push(hint);
    }
  }
  // 合规 BL-08 / P1-5：从 objective / nonNegotiables / protectionHints / host 文本机械提取已知商业 provider。
  // 不依赖 agent 主动把 provider 填进 triggerSignals——把易盾/瑞数/数美/极验等国产高频 provider 也纳入信号面。
  const inlineEvidence = [
    cleanText(task.taskContract?.objective),
    ...(task.taskContract?.nonNegotiables || []).map((item) => cleanText(item)),
    ...protectionHints,
    cleanText(task.targetContext?.host),
    cleanText(task.targetContext?.targetName)
  ].filter(Boolean).join("\n");
  for (const hit of detectCommercialProviderHits(inlineEvidence)) {
    autoSignals.push(`provider:${hit}`);
  }
  task.externalRefs.triggerSignals = uniqTexts([
    ...(Array.isArray(task.externalRefs.triggerSignals) ? task.externalRefs.triggerSignals : []),
    ...autoSignals
  ]);
  task.externalRefs.sourceTypesPreferred ||= ["official-docs", "github", "issue", "public-analysis"];
  task.externalRefs.sourceTypesUsed ||= [];
  task.externalRefs.resultDigest ||= [];
  task.externalRefs.openQuestions ||= [];
  task.externalRefs.adoptedFindings ||= [];
  task.externalRefs.rejectedFindings ||= [];
  task.externalRefs.confidence ||= 0;
  task.externalRefs.lastDecisionSummary ||= "";

  task.taskPacks ||= {};
  task.taskPacks.mode ||= "core-only";
  task.taskPacks.explicitTopics ||= [];
  task.taskPacks.explicitExtensions ||= [];
  task.taskPacks.selectedTopics ||= [];
  task.taskPacks.selectedExtensions ||= [];
  task.taskPacks.activatedTopics ||= [];
  task.taskPacks.activatedExtensions ||= [];

  task.validation ||= {};
  task.validation.status ||= "not-started";
  task.validation.lastVerifiedAt ||= "";
  task.validation.notes ||= [];

  task.taskContract ||= {};
  task.taskContract.objective ||= cleanText(task.targetContext?.objective) || cleanText(task.title);
  task.taskContract.nonNegotiables = uniqTexts(task.taskContract.nonNegotiables || []);
  task.taskContract.deliverableTier ||= deriveDeliverableTier(task);
  task.taskContract.completionCriteria = uniqTexts(
    task.taskContract.completionCriteria || task.successCriteria || []
  );
  task.taskContract.disallowedFallbacks = uniqTexts(task.taskContract.disallowedFallbacks || []);
  task.taskContract.intermediateStatesNotDelivery = uniqTexts(
    task.taskContract.intermediateStatesNotDelivery || deriveIntermediateStates(task)
  );
  task.taskContract.knowledgeGap = task.taskContract.knowledgeGap === true;
  task.taskContract.status ||= task.taskContract.objective ? "ready" : "draft";

  task.executionModel ||= {};
  const rawModel = task.executionModel && typeof task.executionModel === "object" && !Array.isArray(task.executionModel)
    ? structuredClone(task.executionModel)
    : {};
  task.executionModel.system ||= "task-contract-driven";
  task.executionModel.currentState ||= cleanText(task.phase) || "Observe";
  task.executionModel.primaryEntrypoint ||= cleanText(task.routeState?.nextEntrypointId);
  task.executionModel.taskMode ||= "";
  task.executionModel.fallbackMode ||= "";
  task.executionModel.primaryTopic ||= "";
  task.executionModel.secondaryTopics = uniqTexts(task.executionModel.secondaryTopics || []);
  task.executionModel.microRoute ||= "";
  task.executionModel.experimentClass ||= "";
  task.executionModel.roundBudget = Math.max(1, Number(task.executionModel.roundBudget) || 2);
  task.executionModel.roundsConsumed = Math.max(0, Number(task.executionModel.roundsConsumed) || 0);
  task.executionModel.lastProgressRound = Math.max(0, Number(task.executionModel.lastProgressRound) || 0);
  // progressionRounds：全局单调「回复轮次」计数，由 task-snapshot --round 在每个回复边界推进。
  // 与 roundsConsumed 分离——后者对照 roundBudget 校验（局部 probe 预算），前者只服务停滞/搜索闸，
  // 不参与任何 budget 校验，故每轮 +1 不会误触 verify-once / close 的预算门禁。
  task.executionModel.progressionRounds = Math.max(0, Number(task.executionModel.progressionRounds) || 0);
  // progressClueBaseline：上一次 --round 推进时 clues.md 的线索条数；用于判定「本轮是否有新增线索」。
  task.executionModel.progressClueBaseline = Math.max(0, Number(task.executionModel.progressClueBaseline) || 0);
  // searchProgressBaseline：上一次 --round 推进时 external-research.json 的搜索活动量；用于判定「本轮是否有新增搜索」。
  task.executionModel.searchProgressBaseline = Math.max(0, Number(task.executionModel.searchProgressBaseline) || 0);
  task.executionModel.highValueEvidenceGoal ||= "";
  task.executionModel.lastHighValueEvidence ||= "";
  task.executionModel.nextUpgradeGate ||= "";
  task.executionModel.stopLossCondition ||= "同类路线连续两轮无新增高价值证据时必须 retrospective / pivot。";
  task.executionModel.deepDivePermit ||= {};
  task.executionModel.deepDivePermit.active = task.executionModel.deepDivePermit.active === true;
  task.executionModel.deepDivePermit.subgoal ||= "";
  task.executionModel.deepDivePermit.milestone ||= "";
  task.executionModel.deepDivePermit.maxRounds = Math.max(0, Number(task.executionModel.deepDivePermit.maxRounds) || 0);
  task.executionModel.deepDivePermit.exitCondition ||= "";
  task.executionModel.deepDivePermit.expectedHighValueEvidence ||= "";
  task.executionModel.deepDivePermit.currentMicroRoute ||= "";
  task.executionModel.deepDivePermit.permitReason ||= "";
  task.executionModel.deepDivePermit.reviewedAt ||= "";
  task.executionModel.controlSources ||= {};

  task.acceptanceModel ||= {};
  task.acceptanceModel.claimLevel ||= "provisional";
  task.acceptanceModel.acceptanceGap ||= "";
  task.acceptanceModel.acceptanceGapDefined = task.acceptanceModel.acceptanceGapDefined === true;
  task.acceptanceModel.claimLevelHistory = Array.isArray(task.acceptanceModel.claimLevelHistory)
    ? task.acceptanceModel.claimLevelHistory
    : [];
  task.acceptanceModel.nextEvidenceGate ||= "";
  task.acceptanceModel.acceptancePath ||= "";
  task.acceptanceModel.validators = uniqTexts(
    task.acceptanceModel.validators || deriveDefaultValidators(task)
  );
  task.acceptanceModel.userRejectedApproaches = uniqTexts(
    task.acceptanceModel.userRejectedApproaches || []
  );
  task.acceptanceModel.prohibitedIntermediateSignals = uniqTexts(
    task.acceptanceModel.prohibitedIntermediateSignals || deriveProhibitedIntermediateSignals(task)
  );
  task.acceptanceModel.canClaimDelivered = task.acceptanceModel.claimLevel === "delivered";
  task.acceptanceModel.completionBlockedBy = uniqTexts(task.acceptanceModel.completionBlockedBy || []);

  task.firstDivergence ||= {};
  task.firstDivergence.status ||= "not-recorded";
  task.firstDivergence.location ||= "";
  task.firstDivergence.notes ||= [];

  task.successCriteria ||= [];
  task.deliveryRequirements ||= {};
  task.deliveryRequirements.localReproductionRequested ||= false;
  task.deliveryRequirements.apiCallExampleRequired ||= false;
  if (task.deliveryRequirements.apiCallExampleRequired === true) {
    task.deliveryRequirements.localReproductionRequested = true;
  }
  // reportDepth：与 deliverableTier 正交的「报告叙事详实度」轴（brief|standard|deep）。
  //   deep   研究型 / 用户要详细报告 → 四类叙事段（逆向分析过程 / 主要算法说明 / 难点与对抗 / 调用示例）必须非空（硬门槛）
  //   brief  纯请求验收 → 可省（仅软告警）
  //   standard 默认。
  // NL 兜底：从 objective/title 关键词推断置位 deep（保留现有 flag 触发不变，只加兜底，不降级已显式置位的值）。
  if (!["brief", "standard", "deep"].includes(task.deliveryRequirements.reportDepth)) {
    task.deliveryRequirements.reportDepth = "standard";
  }
  if (task.deliveryRequirements.reportDepth !== "deep" && inferReportDepthDeepFromSemantics(task)) {
    task.deliveryRequirements.reportDepth = "deep";
  }
  // 同一批关键词（怎么实现 / 算法原理 / 调用示例 …）同时是「想要可跑成品」的强信号 → 兜底置位 localReproductionRequested。
  if (task.deliveryRequirements.localReproductionRequested !== true && inferLocalReproFromSemantics(task)) {
    task.deliveryRequirements.localReproductionRequested = true;
  }
  task.workspaceArtifacts ||= {};
  task.workspaceArtifacts.bridgedScripts ||= [];
  task.runtime ||= {};
  task.browserSession ||= {};
  // 浏览器 MCP 锁定（防目标漂移）：记录用户显式选定的浏览器 MCP server。
  // 语义与 userRejectedApproaches 同级——一旦锁定只增不可静默清空，避免跨轮上下文衰减后
  // 模型按能力表「调试 API 更全」自行漂移到别的浏览器 MCP。解锁须显式经 task-init/task-input。
  task.browserSession.pinnedMcp ||= "";
  task.browserSession.pinnedMcpSource ||= "";
  task.browserSession.pinnedMcpLockedAt ||= "";
  task.targetContext ||= {};
  task.targetContext.objective ||= "";
  task.targetContext.targetActionDescription ||= "";
  task.targetContext.targetUrlPatterns ||= [];
  task.targetContext.targetKeywords ||= [];
  task.targetContext.targetFunctionNames ||= [];
  task.targetContext.targetTimeWindow ||= "";
  task.targetContext.targetBundleHints ||= [];
  task.targetContext.protectionHints ||= [];
  task.targetContext.loginRequirements ||= [];
  task.targetContext.timeoutPolicy ||= "";
  task.targetContext.retryPolicy ||= "";
  task.boundaries ||= {};
  task.boundaries.activeTriggerAllowed ||= false;
  task.boundaries.breakpointAllowed ||= false;
  task.boundaries.forbiddenActions ||= [];
  const semanticTaskMode = deriveTaskModeFromSemantics(task);
  const semanticTopicFocus = deriveTopicFocusFromSemantics(task);
  task.executionModel.taskMode ||= semanticTaskMode;
  const topicFocus = deriveTopicFocus(task);
  task.executionModel.primaryTopic ||= topicFocus.primaryTopic;
  task.executionModel.secondaryTopics = uniqTexts(
    (task.executionModel.secondaryTopics || []).length > 0
      ? task.executionModel.secondaryTopics
      : topicFocus.secondaryTopics
  );

  const rawTaskMode = cleanText(rawModel.taskMode);
  const rawPrimaryTopic = cleanText(rawModel.primaryTopic);
  const rawSecondaryTopics = Array.isArray(rawModel.secondaryTopics)
    ? uniqTexts(rawModel.secondaryTopics)
    : [];
  const rawCurrentState = cleanText(rawModel.currentState);
  const rawPrimaryEntrypoint = cleanText(rawModel.primaryEntrypoint);
  const rawMicroRoute = cleanText(rawModel.microRoute);
  const rawExperimentClass = cleanText(rawModel.experimentClass);
  const rawRoundBudget = rawModel.roundBudget;
  const rawRoundsConsumed = rawModel.roundsConsumed;
  const rawPermit = rawModel.deepDivePermit && typeof rawModel.deepDivePermit === "object" && !Array.isArray(rawModel.deepDivePermit)
    ? rawModel.deepDivePermit
    : {};

  const hasExistingSource = (field) => cleanText(task.executionModel.controlSources?.[field]);
  const assignSource = (field, fallback) => {
    const existing = hasExistingSource(field);
    task.executionModel.controlSources[field] = existing || fallback;
  };

  const secondaryMatchesSemantic =
    rawSecondaryTopics.length > 0 &&
    rawSecondaryTopics.length === semanticTopicFocus.secondaryTopics.length &&
    rawSecondaryTopics.every((topic, index) => topic === semanticTopicFocus.secondaryTopics[index]);

  assignSource(
    "currentState",
    rawCurrentState ? "legacy-untrusted" : "mirrored-phase"
  );
  assignSource(
    "primaryEntrypoint",
    rawPrimaryEntrypoint
      ? "legacy-untrusted"
      : (cleanText(task.routeState?.nextEntrypointId) ? "mirrored-route-state" : "unset")
  );
  assignSource(
    "taskMode",
    rawTaskMode
      ? (rawTaskMode === semanticTaskMode ? "legacy-untrusted" : "explicit")
      : (semanticTaskMode ? "derived" : "unset")
  );
  assignSource(
    "fallbackMode",
    cleanText(rawModel.fallbackMode) ? "legacy-untrusted" : "unset"
  );
  assignSource(
    "primaryTopic",
    rawPrimaryTopic
      ? (rawPrimaryTopic === semanticTopicFocus.primaryTopic ? "legacy-untrusted" : "explicit")
      : (semanticTopicFocus.primaryTopic ? "derived" : "unset")
  );
  assignSource(
    "secondaryTopics",
    rawSecondaryTopics.length > 0
      ? (secondaryMatchesSemantic ? "legacy-untrusted" : "explicit")
      : ((semanticTopicFocus.secondaryTopics || []).length > 0 ? "derived" : "unset")
  );
  assignSource("microRoute", rawMicroRoute ? "legacy-untrusted" : "unset");
  assignSource("experimentClass", rawExperimentClass ? "legacy-untrusted" : "unset");
  assignSource(
    "roundBudget",
    Number.isInteger(rawRoundBudget) ? "explicit" : (rawRoundBudget === undefined ? "defaulted" : "normalized-invalid")
  );
  assignSource(
    "roundsConsumed",
    Number.isInteger(rawRoundsConsumed) ? "explicit" : (rawRoundsConsumed === undefined ? "defaulted" : "normalized-invalid")
  );
  assignSource(
    "deepDivePermit.active",
    typeof rawPermit.active === "boolean" ? "explicit" : (rawPermit.active === undefined ? "defaulted" : "normalized-invalid")
  );
  assignSource(
    "deepDivePermit.maxRounds",
    Number.isInteger(rawPermit.maxRounds) ? "explicit" : (rawPermit.maxRounds === undefined ? "defaulted" : "normalized-invalid")
  );
  return task;
}

export function collectRouteTopics(routeState = null) {
  const entrypoints = Array.isArray(routeState?.entrypoints) ? routeState.entrypoints : [];
  const orderedEntrypoints = [];
  const activeIds = Array.isArray(routeState?.activeEntrypoints) ? routeState.activeEntrypoints : [];
  const nextId = cleanText(routeState?.execution?.nextEntrypointId);

  for (const entrypointId of [nextId, ...activeIds]) {
    const match = entrypoints.find((entrypoint) => cleanText(entrypoint?.id) === cleanText(entrypointId));
    if (match && !orderedEntrypoints.includes(match)) {
      orderedEntrypoints.push(match);
    }
  }

  for (const entrypoint of entrypoints) {
    if (!orderedEntrypoints.includes(entrypoint)) {
      orderedEntrypoints.push(entrypoint);
    }
  }

  return uniqTexts(
    orderedEntrypoints.flatMap((entrypoint) => Array.isArray(entrypoint?.boundTopics) ? entrypoint.boundTopics : [])
  );
}

// 把任务的自由文本意图字段拼成一段小写文本，供关键词兜底推断使用。
function collectIntentText(task = {}) {
  return cleanText([
    task.taskContract?.objective,
    task.objective,
    task.title,
    task.targetContext?.objective,
    task.targetContext?.targetActionDescription
  ].filter(Boolean).join(" ")).toLowerCase();
}

// NL 兜底：用户在 objective/title 里要「详细报告 / 调用示例 / 怎么实现 / 算法原理 / 难点」时，
// 即便没带 flag 也置位 reportDepth=deep，逼出四类叙事段。只加兜底，不覆盖已显式 deep 的值。
export function inferReportDepthDeepFromSemantics(task = {}) {
  const text = collectIntentText(task);
  if (!text) {
    return false;
  }
  return /详细报告|详尽报告|完整报告|详细(?:的)?(?:分析|说明|文档)|调用示例|使用示例|怎么实现|如何实现|实现原理|算法原理|算法说明|算法还原|难点|逆向(?:分析)?过程|还原(?:链路|过程)|deep[\s-]?report|detailed report/.test(text);
}

// 同批意图关键词通常意味着「想要可跑成品 / 怎么跑」，作为 localReproductionRequested 的兜底。
export function inferLocalReproFromSemantics(task = {}) {
  const text = collectIntentText(task);
  if (!text) {
    return false;
  }
  return /调用示例|使用示例|怎么(?:调用|跑|运行|实现)|如何(?:调用|运行|实现)|本地(?:复现|运行|调用)|纯\s*(?:python|node|js)|可(?:运行|复现)|跑通|run locally|call example|usage example/.test(text);
}

export function deriveTaskModeFromSemantics(task = {}, routeState = null) {
  const tier = cleanText(task.taskContract?.deliverableTier).toLowerCase();
  if (
    task.deliveryRequirements?.apiCallExampleRequired === true ||
    task.deliveryRequirements?.localReproductionRequested === true ||
    /local|pure|port/.test(tier)
  ) {
    return "本地复现 / Port";
  }
  if (/browser/.test(tier)) {
    return "浏览器内可控复用";
  }
  if (/content|boundary|clear|decrypt|frame/.test(tier)) {
    return "内容 / 明文边界恢复";
  }
  if (/accepted-request|request|signature|protocol/.test(tier)) {
    return "请求验收";
  }

  const selectedTopics = new Set(uniqTexts([
    ...(task.taskPacks?.selectedTopics || []),
    ...(task.taskPacks?.activatedTopics || []),
    ...collectRouteTopics(routeState)
  ]));
  if (selectedTopics.has("signature") || selectedTopics.has("protocol") || selectedTopics.has("graphql-rpc") || selectedTopics.has("grpc-web")) {
    return "请求验收";
  }
  if (selectedTopics.has("media-drm") || selectedTopics.has("frame") || selectedTopics.has("streaming-runtime")) {
    return "内容 / 明文边界恢复";
  }
  if (selectedTopics.has("wasm") || selectedTopics.has("worker") || selectedTopics.has("jsvmp")) {
    return "浏览器内可控复用";
  }
  return "pending-mode-selection";
}

export function deriveTaskMode(task = {}, routeState = null) {
  const explicit = cleanText(
    task.executionModel?.taskMode ||
    task.taskContract?.taskMode ||
    task.taskMode
  );
  if (explicit) {
    return explicit;
  }
  return deriveTaskModeFromSemantics(task, routeState);
}

export function deriveTopicFocusFromSemantics(task = {}, routeState = null) {
  const selected = uniqTexts([
    ...(task.taskPacks?.selectedTopics || []),
    ...(task.taskPacks?.activatedTopics || []),
    ...collectRouteTopics(routeState)
  ]);
  const primaryTopic = selected[0] || "pending-topic-selection";
  const secondaryTopics = selected.slice(1, 3);
  return {
    primaryTopic,
    secondaryTopics
  };
}

export function deriveTopicFocus(task = {}, routeState = null) {
  const explicitPrimary = cleanText(
    task.executionModel?.primaryTopic ||
    task.primaryTopic
  );
  const explicitSecondary = uniqTexts(
    task.executionModel?.secondaryTopics ||
    task.secondaryTopics ||
    []
  );
  if (explicitPrimary || explicitSecondary.length > 0) {
    return {
      primaryTopic: explicitPrimary || "pending-topic-selection",
      secondaryTopics: explicitSecondary.slice(0, 2)
    };
  }
  return deriveTopicFocusFromSemantics(task, routeState);
}

export function deriveEvidenceStatus(task = {}) {
  const acceptance = task.acceptanceModel || {};
  const claimLevel = cleanText(acceptance.claimLevel || "provisional");
  if (claimLevel === "delivered") {
    return "validated-delivery";
  }
  if (cleanText(acceptance.acceptancePath)) {
    return "acceptance-path-present";
  }
  if (cleanText(acceptance.nextEvidenceGate)) {
    return "awaiting-next-evidence-gate";
  }
  return "provisional-only";
}

export function deriveWhyNotDeliveredYet(task = {}) {
  const acceptance = task.acceptanceModel || {};
  if (cleanText(acceptance.claimLevel) === "delivered") {
    return "n/a";
  }
  if ((acceptance.completionBlockedBy || []).length > 0) {
    return (acceptance.completionBlockedBy || []).join(" | ");
  }
  if (cleanText(acceptance.acceptanceGap)) {
    return cleanText(acceptance.acceptanceGap);
  }
  return "仍缺最终验收闭环";
}

function deriveDeliverableTier(task) {
  if (cleanText(task.taskContract?.deliverableTier)) {
    return cleanText(task.taskContract.deliverableTier);
  }
  if (task.deliveryRequirements?.apiCallExampleRequired === true) {
    return "local-api-reproduction";
  }
  if (task.deliveryRequirements?.localReproductionRequested === true) {
    return "local-reproduction";
  }
  const selectedTopics = new Set(uniqTexts(task.taskPacks?.selectedTopics || task.taskPacks?.activatedTopics || []));
  if (selectedTopics.has("media-drm") || selectedTopics.has("frame") || selectedTopics.has("streaming-runtime")) {
    return "content-boundary-recovery";
  }
  if (selectedTopics.has("signature") || selectedTopics.has("protocol") || selectedTopics.has("graphql-rpc") || selectedTopics.has("grpc-web")) {
    return "accepted-request";
  }
  if (selectedTopics.has("wasm") || selectedTopics.has("jsvmp") || selectedTopics.has("worker")) {
    return "browser-or-local-runtime-rebuild";
  }
  return "generic-acceptance";
}

function deriveIntermediateStates(task) {
  const states = [
    "阶段性汇报",
    "局部样本命中",
    "单点成功",
    "搜索命中",
    "容器可读",
    "浏览器 PoC"
  ];
  if (task.deliveryRequirements?.localReproductionRequested === true) {
    states.push("browser harness 仅作中间证据");
  }
  return states;
}

function deriveDefaultValidators(task) {
  const validators = ["generic-contract"];
  if (task.deliveryRequirements?.localReproductionRequested === true) {
    validators.push("local-reproduction");
  }
  if (task.deliveryRequirements?.apiCallExampleRequired === true) {
    validators.push("api-call-example");
  }
  const selectedTopics = new Set(uniqTexts(task.taskPacks?.selectedTopics || task.taskPacks?.activatedTopics || []));
  if (selectedTopics.has("media-drm") || selectedTopics.has("frame") || selectedTopics.has("streaming-runtime")) {
    validators.push("content-boundary");
  }
  if (selectedTopics.has("signature") || selectedTopics.has("protocol") || selectedTopics.has("graphql-rpc") || selectedTopics.has("grpc-web")) {
    validators.push("request-accepted");
  }
  if (selectedTopics.has("wasm") || selectedTopics.has("jsvmp") || selectedTopics.has("worker")) {
    validators.push("runtime-rebuild");
  }
  return validators;
}

function deriveProhibitedIntermediateSignals(task) {
  const signals = [
    "局部样本替代整体完成",
    "单条请求偶发成功",
    "容器可读替代内容验证",
    "未验证就宣称已交付"
  ];
  if (task.deliveryRequirements?.localReproductionRequested === true) {
    signals.push("浏览器 PoC 替代本地复现");
  }
  return signals;
}

export function nowIso() {
  return new Date().toISOString();
}
