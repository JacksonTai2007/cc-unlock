import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readTopicRegistry } from "../topic-registry.mjs";
import {
  collectRawTaskShapeFindings,
  collectStrayWorkspaceArtifacts,
  deriveTaskMode,
  deriveTaskModeFromSemantics,
  deriveTopicFocus,
  deriveTopicFocusFromSemantics,
  ensureTaskRuntimeShape,
  fileExistsInTask,
  normalizeNewlines,
  nowIso,
  phaseOrder,
  readRawTaskJson,
  readTaskJson,
  relFromRepo,
  taskFile,
  templateTaskDir,
  writeTaskJson
} from "./common.mjs";
import {
  applyRouteStateToTask,
  artifactTouchedAgainstTemplate,
  parseCluesMarkdown,
  parseProgress,
  parseRoutePlan,
  renderProgressMarkdown,
  renderRoutePlanMarkdown,
  readRouteStateDocument
} from "./route-state.mjs";
import { evaluateStateFreshness } from "./check-state-freshness.mjs";

const progressStatuses = new Set(["PENDING", "IN_PROGRESS", "BLOCKED", "DONE"]);
const reportCurrentHeadingPatterns = [/^##\s*(?:当前阶段|当前进度|当前状态)\s*[：:]?\s*$/gim];
const reportCurrentHeadingCanonical = /^##\s*当前阶段\s*$/gim;
const reportSummaryHeadingPatterns = [/^##\s*(?:任务摘要|Summary)\s*[：:]?\s*$/gim];
const reportNextHeadingPatterns = [/^##\s*(?:下一步|后续动作|next step)\s*[：:]?\s*$/gim];
const reportNextHeadingCanonical = /^##\s*下一步\s*$/gim;
const reportExecutionHeadingPatterns = [/^##\s*(?:自动续跑决策|续跑决策|Continuation Decision)\s*[：:]?\s*$/gim];
const reportExecutionHeadingCanonical = /^##\s*自动续跑决策\s*$/gim;
const reportContractHeadingPatterns = [/^##\s*(?:任务契约|Task Contract)\s*[：:]?\s*$/gim];
const reportExecutionModelHeadingPatterns = [/^##\s*(?:执行状态机|Execution Model)\s*[：:]?\s*$/gim];
const reportAcceptanceHeadingPatterns = [/^##\s*(?:验收闭环|Acceptance Closure)\s*[：:]?\s*$/gim];
const reportExecutionStatus = /(?:^|\n)-\s*(?:执行状态|execution status)\s*[：:]/i;
const reportNextExecutableAction = /(?:^|\n)-\s*(?:下一可执行动作|下一动作|next executable action|next action)\s*[：:]/i;
const reportPauseCategory = /(?:^|\n)-\s*(?:暂停类别|pause category)\s*[：:]/i;
const reportPauseReason = /(?:^|\n)-\s*(?:暂停原因|pause reason)\s*[：:]/i;
const reportWorkspaceRoot = /(?:^|\n)-\s*workspaceRoot\s*[：:]\s*\S+/i;
const reportTaskLocalRoot = /(?:^|\n)-\s*taskLocalRoot\s*[：:]\s*\S+/i;
const reportArtifactTruthRoot = /(?:^|\n)-\s*artifactTruthRoot\s*[：:]\s*\S+/i;
const reportWorkspaceKind = /(?:^|\n)-\s*workspaceKind\s*[：:]\s*\S+/i;
const reportTaskMode = /(?:^|\n)-\s*taskMode\s*[：:]\s*\S+/i;
const reportFallbackMode = /(?:^|\n)-\s*fallbackMode\s*[：:]\s*\S+/i;
const reportPrimaryTopic = /(?:^|\n)-\s*primaryTopic\s*[：:]\s*\S+/i;
const reportSecondaryTopics = /(?:^|\n)-\s*secondaryTopics\s*[：:]\s*\S+/i;
const reportEvidenceStatus = /(?:^|\n)-\s*evidenceStatus\s*[：:]\s*\S+/i;
const reportWhyNotDeliveredYet = /(?:^|\n)-\s*whyNotDeliveredYet\s*[：:]\s*\S+/i;
const reportContractObjective = /(?:^|\n)-\s*(?:目标|objective)\s*[：:]\s*\S+/i;
const reportContractTier = /(?:^|\n)-\s*(?:当前交付层级|deliverable tier)\s*[：:]\s*\S+/i;
const reportAcceptanceClaimLevel = /(?:^|\n)-\s*(?:claimlevel|claim level)\s*[：:]\s*\S+/i;
const reportAcceptancePathEntry = /(?:^|\n)-\s*(?:acceptancepath|acceptance path)\s*[：:]\s*\S+/i;
const reportExecutionPrimaryMode = /(?:^|\n)-\s*(?:主模式|primary mode)\s*[：:]\s*\S+/i;
const reportExecutionPrimaryTopic = /(?:^|\n)-\s*(?:主专题|primary topic)\s*[：:]\s*\S+/i;
const reportExecutionSecondaryTopics = /(?:^|\n)-\s*(?:辅助专题|secondary topics)\s*[：:]\s*\S+/i;
const reportExecutionCurrentState = /(?:^|\n)-\s*(?:当前执行状态|current execution state)\s*[：:]\s*\S+/i;
const reportExecutionPrimaryEntrypoint = /(?:^|\n)-\s*(?:主切入点|primary entrypoint)\s*[：:]\s*\S+/i;
const reportExecutionMicroRoute = /(?:^|\n)-\s*(?:当前微路线|micro route)\s*[：:]\s*\S+/i;
const reportExecutionExperimentClass = /(?:^|\n)-\s*(?:当前实验类别|experiment class)\s*[：:]\s*\S+/i;
const reportExecutionStopLoss = /(?:^|\n)-\s*(?:当前停损条件|停损条件|stop loss condition)\s*[：:]\s*\S+/i;
const reportExecutionRoundBudget = /(?:^|\n)-\s*(?:当前轮次预算|round budget)\s*[：:]\s*\S+/i;
const reportExecutionRoundsConsumed = /(?:^|\n)-\s*(?:当前已消耗轮次|rounds consumed)\s*[：:]\s*\S+/i;
const reportExecutionDeepDiveActive = /(?:^|\n)-\s*deepDivePermit\.active\s*[：:]\s*\S+/i;
const reportExecutionDeepDiveMaxRounds = /(?:^|\n)-\s*deepDivePermit\.maxRounds\s*[：:]\s*\S+/i;
const reportExecutionDeepDiveCurrentMicroRoute = /(?:^|\n)-\s*deepDivePermit\.currentMicroRoute\s*[：:]\s*\S+/i;
const reportExecutionDeepDiveSubgoal = /(?:^|\n)-\s*deepDivePermit\.subgoal\s*[：:]\s*\S+/i;
const reportExecutionDeepDiveMilestone = /(?:^|\n)-\s*deepDivePermit\.milestone\s*[：:]\s*\S+/i;
const reportExecutionDeepDiveExitCondition = /(?:^|\n)-\s*deepDivePermit\.exitCondition\s*[：:]\s*\S+/i;
const reportExecutionDeepDiveExpectedEvidence = /(?:^|\n)-\s*deepDivePermit\.expectedHighValueEvidence\s*[：:]\s*\S+/i;
const reportLocalReproHeading = /##\s+(本地复现交付|Local Reproduction Deliverables)/i;
const reportLocalAlgoEntry = /-\s*(本地算法实现|local algorithm)\s*[：:]\s*\S+/i;
const reportLocalExampleEntry = /-\s*(调用示例|local repro example)\s*[：:]\s*\S+/i;
const reportApiExampleEntry = /-\s*(API 调用示例|api call example)\s*[：:]\s*\S+/i;
const reportRunCommandEntry = /-\s*(运行命令|run command)\s*[：:]\s*\S+/i;
const reportOutputSummaryEntry =
  /-\s*(输出\s*\/\s*响应摘要|输出摘要|响应摘要|打印展示|response summary|printed response)\s*[：:]\s*\S+/i;
const reportEntrypointHeading = /##\s+(切入点循环|Entrypoint Loop)/i;
const reportActiveEntrypoints = /(?:^|\n)-\s*activeEntrypoints\s*[：:]\s*\S+/i;
const reportEntrypointStatuses = /(?:^|\n)-\s*entrypointStatuses\s*[：:]\s*\S+/i;
const reportEntrypointNextId = /(?:^|\n)-\s*execution\.nextEntrypointId\s*[：:]\s*\S+/i;
const reportEntrypointNextAction = /(?:^|\n)-\s*execution\.nextExecutableAction\s*[：:]\s*\S+/i;
const reportCandidateEntrypoints = /(候选切入点|candidate entrypoints?)/i;
const reportChosenEntrypoint = /(本轮实际验证的切入点|实际验证的切入点|chosen entrypoint|activeEntrypoint)/i;
const reportEntrypointRationale = /(为什么先试它|选择理由|优先理由|rationale)/i;
const reportEntrypointCriteria = /(成功或失败的判据|成功判据|失败判据|success criteria|failure criteria)/i;
const reportEntrypointPivot = /(切换理由|复盘|retrospective|pivot)/i;
const maxEntrypointsInWorkingSet = 5;
const maxRetrospectivesInWorkingSet = 5;
const topicValidationRules = readTopicRegistry().filter(
  (topic) => topic.formalValidation?.presentPath
);
const suspiciousReplayFallbackPatterns = [
  /live-browser-response-body\.txt/i,
  /saved successful json/i,
  /fallback to saved/i,
  /verify_check/i,
  /unsigned fallback/i,
  /fallback to unsigned/i,
  /unsigned request/i,
  /without signature fallback/i,
  /without signer fallback/i
];
const genericTemplatePlaceholderPatterns = [
  /replace-me/i,
  /\bTODO\b/i,
  /\bTBD\b/i,
  /待补充|待填写|待完善|默认内容/i
];
const emptyLikeTextValues = new Set([
  "",
  "(none)",
  "none",
  "(empty)",
  "empty",
  "(null)",
  "null",
  "(n/a)",
  "n/a",
  "na",
  "(not-applicable)",
  "not-applicable",
  "无",
  "暂无",
  "未填写",
  "待补充",
  "待填写",
  "not-started"
]);
const emptyMarkdownHeadingPattern = /^(#{1,6})\s*$/m;
const notStartedPlaceholderArtifacts = new Set([
  "report.md",
  "state/candidate-insights.json",
  "run/signature-input-map.md",
  "run/signer-state-map.md",
  "run/session-notes.md",
  "run/storage-notes.md"
]);
const allowedTaskModes = new Set([
  "请求验收",
  "内容 / 明文边界恢复",
  "浏览器内可控复用",
  "本地复现 / Port",
  "纯算法提取"
]);
const placeholderControlValues = new Set([
  "pending-mode-selection",
  "pending-topic-selection",
  "pending-route-selection",
  "pending-entrypoint-selection"
]);

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const validTopicKeys = new Set(readTopicRegistry().map((topic) => cleanText(topic.key)).filter(Boolean));

function hasMeaningfulText(value) {
  const normalized = cleanText(value);
  return Boolean(normalized) && !emptyLikeTextValues.has(normalized.toLowerCase());
}

function normalizeEmptyLike(value) {
  const normalized = cleanText(value);
  return emptyLikeTextValues.has(normalized.toLowerCase()) ? "" : normalized;
}

function extractBulletValue(text, rawKey) {
  const key = escapeRegExp(rawKey);
  // 用 [^\S\n]* 只吃冒号两侧的水平空白，禁止跨行：否则当某条 bullet 值为空
  // （形如 `- key: \n`）时，\s* 会连同换行一起吃掉，把下一行内容误当成本行的值。
  const match = String(text || "").match(
    new RegExp(`(?:^|\\n)-[^\\S\\n]*${key}[^\\S\\n]*[：:][^\\S\\n]*(.*)$`, "im")
  );
  return match ? String(match[1] || "").trim() : null;
}

function parseCsvLike(value) {
  const normalized = normalizeEmptyLike(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(",")
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function parsePipeLike(value) {
  const normalized = normalizeEmptyLike(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split("|")
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function canonicalListText(values = []) {
  const normalized = Array.from(new Set((values || []).map((item) => cleanText(item)).filter(Boolean)));
  return normalized.length > 0 ? normalized.join(", ") : "";
}

function canonicalPipeText(values = []) {
  const normalized = Array.from(new Set((values || []).map((item) => cleanText(item)).filter(Boolean)));
  return normalized.length > 0 ? normalized.join(" | ") : "";
}

function isPlaceholderControlValue(value) {
  const normalized = cleanText(value).toLowerCase();
  return placeholderControlValues.has(normalized);
}

function parseBooleanLike(value) {
  const normalized = cleanText(value).toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
}

function parseIntegerLike(value) {
  const normalized = cleanText(value);
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }
  return Number(normalized);
}

function normalizeComparableText(value) {
  if (value == null) {
    return "";
  }
  return normalizeEmptyLike(String(value));
}

function validateReportScalarTruth(reportText, rawKey, expectedValue, findings, message) {
  const actualValue = extractBulletValue(reportText, rawKey);
  if (actualValue == null) {
    return;
  }
  const actual = normalizeComparableText(actualValue);
  const expected = normalizeComparableText(expectedValue);
  if (actual !== expected) {
    findings.push(`${message}: expected=${expected || "(empty)"} actual=${actual || "(empty)"}`);
  }
}

function validateReportIntegerTruth(reportText, rawKey, expectedValue, findings, message) {
  const actualValue = extractBulletValue(reportText, rawKey);
  if (actualValue == null) {
    return;
  }
  const actual = parseIntegerLike(actualValue);
  const expected = Number(expectedValue);
  if (!Number.isInteger(actual) || actual !== expected) {
    findings.push(`${message}: expected=${expected} actual=${actualValue}`);
  }
}

function validateReportBooleanTruth(reportText, rawKey, expectedValue, findings, message) {
  const actualValue = extractBulletValue(reportText, rawKey);
  if (actualValue == null) {
    return;
  }
  const actual = parseBooleanLike(actualValue);
  if (actual == null || actual !== Boolean(expectedValue)) {
    findings.push(`${message}: expected=${expectedValue ? "true" : "false"} actual=${actualValue}`);
  }
}

function validateReportCsvTruth(reportText, rawKey, expectedValues, findings, message) {
  const actualValue = extractBulletValue(reportText, rawKey);
  if (actualValue == null) {
    return;
  }
  const actual = canonicalListText(parseCsvLike(actualValue));
  const expected = canonicalListText(expectedValues);
  if (actual !== expected) {
    findings.push(`${message}: expected=${expected || "(empty)"} actual=${actual || "(empty)"}`);
  }
}

function validateReportPipeTruth(reportText, rawKey, expectedValues, findings, message) {
  const actualValue = extractBulletValue(reportText, rawKey);
  if (actualValue == null) {
    return;
  }
  const actual = canonicalPipeText(parsePipeLike(actualValue));
  const expected = canonicalPipeText(expectedValues);
  if (actual !== expected) {
    findings.push(`${message}: expected=${expected || "(empty)"} actual=${actual || "(empty)"}`);
  }
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textHasPolicyToken(text, token) {
  const normalizedToken = cleanText(token);
  const haystack = String(text || "");
  if (!normalizedToken) {
    return false;
  }
  if (/[^a-z0-9]/i.test(normalizedToken)) {
    return haystack.toLowerCase().includes(normalizedToken.toLowerCase());
  }
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedToken)}([^a-z0-9]|$)`, "i").test(haystack);
}

function collectPolicyTokens(values = []) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => cleanText(value))
        .filter(Boolean)
    )
  );
}

function normalizeTrackName(value) {
  const text = String(value || "")
    .replace(/[`*#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return "";
  return text.replace(/^(route|line|track|\u7ebf\u8def)\s+/i, "").trim();
}

function sameTrack(a, b) {
  const left = normalizeTrackName(a);
  const right = normalizeTrackName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTail = left.match(/([a-z0-9_-]+)$/)?.[1];
  const rightTail = right.match(/([a-z0-9_-]+)$/)?.[1];
  return Boolean(leftTail && rightTail && leftTail === rightTail);
}

function sameEntrypointId(a, b) {
  return String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
}

function taskLooksComposite(task, routeState) {
  return (
    (routeState?.entrypoints || []).length > 1 ||
    (routeState?.retrospectives || []).length > 0
  );
}

function textMatchesAny(text, patterns) {
  return patterns.some((pattern) => new RegExp(pattern.source, pattern.flags).test(text));
}

function usesCanonicalHeading(text, pattern) {
  return new RegExp(pattern.source, pattern.flags).test(text);
}

function vmTriageResult(task, routeState = null) {
  return String(routeState?.vmTriage?.triageResult || task?.vm?.triageResult || "").trim();
}

function isVmBlackboxRoute(task, routeState = null) {
  return vmTriageResult(task, routeState) === "blackbox";
}

function validateCompositeEntrypointReporting(reportText, routeState, warnings) {
  if (!reportEntrypointHeading.test(reportText)) {
    warnings.push("composite task report.md should contain a 切入点循环 / Entrypoint Loop section");
  }

  if (!reportActiveEntrypoints.test(reportText)) {
    warnings.push("report.md should record activeEntrypoints");
  }

  if (!reportEntrypointStatuses.test(reportText)) {
    warnings.push("report.md should record entrypointStatuses");
  }

  if (!reportEntrypointNextId.test(reportText)) {
    warnings.push("report.md should record execution.nextEntrypointId");
  }

  if (!reportEntrypointNextAction.test(reportText)) {
    warnings.push("report.md should record execution.nextExecutableAction");
  }

  if (!reportCandidateEntrypoints.test(reportText)) {
    warnings.push("composite task report.md should record candidate entrypoints");
  }

  if (!reportChosenEntrypoint.test(reportText)) {
    warnings.push("composite task report.md should record the chosen entrypoint for this round");
  }

  if (!reportEntrypointRationale.test(reportText)) {
    warnings.push("composite task report.md should explain why this entrypoint was attempted first");
  }

  if (!reportEntrypointCriteria.test(reportText)) {
    warnings.push("composite task report.md should record success/failure criteria for the current entrypoint");
  }

  if (routeState.entrypoints.length > 0 && !routeState.entrypoints.some((entrypoint) => reportText.includes(entrypoint.id))) {
    warnings.push("composite task report.md should mention at least one concrete entrypoint id");
  }

  const hasParkedOrExhausted = routeState.entrypoints.some((entrypoint) =>
    ["PARKED", "EXHAUSTED"].includes(String(entrypoint.status || ""))
  );
  if ((hasParkedOrExhausted || routeState.retrospectives.length > 0) && !reportEntrypointPivot.test(reportText)) {
    warnings.push("composite task report.md should explain the pivot / retrospective when entrypoints fail or are parked");
  }
}

// 抽取 report.md 中某个 `## 段` 的正文文本（到下一个 `## ` 或文件尾）。
export function extractReportSectionBody(reportText, headingPattern) {
  const source = String(reportText || "");
  const headings = Array.from(source.matchAll(/^##\s+.+$/gm));
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    if (!new RegExp(headingPattern.source, headingPattern.flags).test(match[0].trim())) {
      continue;
    }
    const bodyStart = match.index + match[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : source.length;
    return source.slice(bodyStart, end);
  }
  return null;
}

// 段是否「已被真实填充」：去掉 HTML 注释占位后，存在非空且非告警（不以 > ⚠ / > ⚠️ 开头）的实质行，
// 且这些实质行不全是「⚠|待补」占位行（renderCallExampleBody 等渲染器在未填充时输出
// `- 字段: ⚠ 待补：…`，这类 bullet 不以 `>` 开头，若不过滤会被误判为已填充）。
export function reportSectionIsFilled(body) {
  if (body == null) {
    return false;
  }
  const lines = String(body)
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return false;
  }
  // 渲染器在未填充时输出告警标记行（> ⚠ …）。只要还存在该告警行，无论后面是否带骨架占位 bullet，
  // 都判定为「未填充」——避免「算法说明骨架占位 bullet」被误当成已填充内容。
  if (lines.some((line) => /^>\s*⚠/.test(line))) {
    return false;
  }
  // 过滤出非引用块（不以 > 开头）的「实质行」。
  const contentLines = lines.filter((line) => !/^>/.test(line));
  if (contentLines.length === 0) {
    return false;
  }
  // 若所有实质行均包含「⚠」或「待补」，说明段内容仍为渲染器产出的占位 bullet（P1-T1）：
  // 例如 `- 完整运行命令: ⚠ 待补：run/ 下有成品脚本时此项必填`，此类行视为未填充。
  const allPlaceholder = contentLines.every((line) => /⚠|待补/.test(line));
  if (allPlaceholder) {
    return false;
  }
  return true;
}

// 报告详实度四段门禁（架P1#8 / 技P2#5/D）：
//   - reportDepth=deep → 四段必须非空=硬门槛(error)，否则软门槛(warning)。
//   - run/ 下存在可执行成品脚本(pure-*)时，`## 调用示例` 的「运行命令 + 预期输出」非空=硬门槛。
const reportReverseProcessHeading = /^##\s*(?:逆向分析过程|还原链路|Reverse(?:\s+Engineering)?\s+Process)\s*[：:]?\s*$/i;
const reportAlgorithmHeading = /^##\s*(?:主要算法说明|算法还原说明|Algorithm(?:\s+Explanation)?)\s*[：:]?\s*$/i;
const reportDifficultyHeading = /^##\s*(?:难点与对抗|难点分析|Difficulties?(?:\s+and\s+Countermeasures)?)\s*[：:]?\s*$/i;
const reportCallExampleHeading = /^##\s*(?:调用示例|Call Example|Usage Example)\s*[：:]?\s*$/i;

function validateReportDepthSections(task, reportText, taskDir, errors, warnings) {
  const depth = String(task.deliveryRequirements?.reportDepth || "standard").trim();
  const isDeep = depth === "deep";
  // 只要 run/ 下有可执行成品脚本（已还原算法），四段就升 error（技实战建议 validation.mjs:476）：
  // 「逆向已产出成品脚本却报告四段空壳」是本次事故的核心形态，必须硬拦而非仅 warning。
  const pureFiles = collectPureFiles(taskDir);
  // 合规 P1-4：把「被 verify/fixtures 引用、或 run/ 下非脚手架的成品脚本」也纳入四段强制触发条件，
  // 堵住「成品脚本不叫 pure- 即让四段强制静默失效」的命名规避。被引用的更强，未引用的也按成品对待。
  const solverFiles = collectSolverArtifacts(taskDir);
  const hasProductionScript = pureFiles.length > 0 || solverFiles.length > 0;
  const treatAsDeep = isDeep || hasProductionScript;
  const sink = treatAsDeep ? errors : warnings;
  const verb = treatAsDeep ? "must" : "should";
  const productionScriptRef = pureFiles[0] || solverFiles[0]?.rel || "";
  const depthReason = isDeep
    ? `reportDepth=${depth}`
    : hasProductionScript
      ? `run/ 下存在成品脚本 ${productionScriptRef}`
      : `reportDepth=${depth}`;

  const narrativeSections = [
    ["逆向分析过程 / Reverse Process", reportReverseProcessHeading],
    ["主要算法说明 / Algorithm Explanation", reportAlgorithmHeading],
    ["难点与对抗 / Difficulties", reportDifficultyHeading],
    ["调用示例 / Call Example", reportCallExampleHeading]
  ];
  for (const [label, heading] of narrativeSections) {
    if (!reportSectionIsFilled(extractReportSectionBody(reportText, heading))) {
      sink.push(`report.md ${label} section ${verb} be filled (${depthReason}); 在 state/narrative.md 对应小节补全后由 task-close 渲染`);
    }
  }

  // 存在可执行成品脚本，或声明要本地复现（localReproductionRequested）时，调用示例必须自包含：
  // 运行命令 + 预期输出非空（无论 reportDepth）。后者拦下「声明要复现但没产出 pure-* 脚本」却带
  // 字段级 `⚠待补` 放行的情形。
  const callBody = extractReportSectionBody(reportText, reportCallExampleHeading) || "";
  if (hasProductionScript || task.deliveryRequirements?.localReproductionRequested === true) {
    const runCmdFilled = /(?:^|\n)\s*-\s*(?:完整运行命令|运行命令)\s*[：:]\s*\S+/.test(callBody) &&
      !/(?:完整运行命令|运行命令)\s*[：:]\s*(?:⚠|待补)/.test(callBody);
    const outputFilled = /(?:^|\n)\s*-\s*(?:预期输出片段|输出\s*\/\s*响应摘要|输出)\s*[：:]\s*\S+/.test(callBody) &&
      !/(?:预期输出片段|输出\s*\/\s*响应摘要|输出)\s*[：:]\s*(?:⚠|待补)/.test(callBody);
    const callExampleReason = hasProductionScript
      ? `run/ 下存在成品脚本 ${productionScriptRef}`
      : `已声明 localReproductionRequested`;
    if (!runCmdFilled) {
      errors.push(`report.md 调用示例 section must record a non-empty 运行命令 (${callExampleReason})`);
    }
    if (!outputFilled) {
      errors.push(`report.md 调用示例 section must record a non-empty 预期输出 (${callExampleReason})`);
    }
  }
}

export function artifactExists(taskDir, relPath) {
  return fileExistsInTask(taskDir, relPath);
}

function artifactExistsInContext(taskDir, relPath, context = null) {
  if (context?.files) {
    return context.files.includes(relPath);
  }
  return artifactExists(taskDir, relPath);
}

export function artifactTouched(taskDir, relPath, context = null) {
  if (context?.touchedArtifacts && Object.prototype.hasOwnProperty.call(context.touchedArtifacts, relPath)) {
    return Boolean(context.touchedArtifacts[relPath]);
  }
  return artifactTouchedAgainstTemplate(taskDir, relPath);
}

function artifactTouchedInContext(taskDir, relPath, context = null) {
  return artifactTouched(taskDir, relPath, context);
}

export function touchedAny(taskDir, relPaths, context = null) {
  return relPaths.some((relPath) => artifactTouched(taskDir, relPath, context));
}

function touchedAnyInContext(taskDir, relPaths, context = null) {
  return touchedAny(taskDir, relPaths, context);
}

function prepareTaskForValidation(taskDir, taskInput = null) {
  const rawTask = taskInput ? structuredClone(taskInput) : readRawTaskJson(taskDir);
  const task = ensureTaskRuntimeShape(taskInput ? structuredClone(taskInput) : readTaskJson(taskDir));
  Object.defineProperty(task, "__taskDir", {
    value: taskDir,
    enumerable: false,
    configurable: true,
    writable: true
  });
  Object.defineProperty(task, "__rawTask", {
    value: rawTask,
    enumerable: false,
    configurable: true,
    writable: true
  });
  return task;
}

function collectRawTaskValidationFindings(task, findings) {
  const rawTask = task?.__rawTask;
  if (!rawTask || typeof rawTask !== "object") {
    return;
  }
  for (const finding of collectRawTaskShapeFindings(rawTask)) {
    findings.push(finding);
  }
}

function placeholderLabelsForArtifact(relPath, text) {
  const labels = [];

  for (const pattern of genericTemplatePlaceholderPatterns) {
    if (pattern.test(text)) {
      labels.push(pattern.source);
    }
  }

  if (notStartedPlaceholderArtifacts.has(relPath) && /\bnot-started\b/i.test(text)) {
    labels.push("not-started");
  }

  if (/\.md$/i.test(relPath) && emptyMarkdownHeadingPattern.test(text)) {
    labels.push("empty-markdown-heading");
  }

  return Array.from(new Set(labels));
}

function collectTemplatePlaceholderLeakage(task, findings, context = null) {
  if (task.taskId === "replace-me" || path.basename(task.__taskDir) === "_TEMPLATE") {
    return;
  }

  const candidateRelPaths = [
    "report.md",
    "state/candidate-insights.json",
    "run/signature-input-map.md",
    "run/signer-state-map.md",
    "run/session-notes.md",
    "run/storage-notes.md"
  ];

  for (const relPath of candidateRelPaths) {
    if (!artifactExistsInContext(task.__taskDir, relPath, context)) {
      continue;
    }

    const filePath = taskFile(task.__taskDir, relPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      continue;
    }

    const labels = placeholderLabelsForArtifact(relPath, fs.readFileSync(filePath, "utf8"));
    if (labels.length > 0) {
      findings.push(`${relPath} still contains template placeholder markers: ${labels.join(", ")}`);
    }
  }
}

function buildDeliverablesContext(taskDir, snapshot = null) {
  if (!snapshot) {
    return null;
  }
  return {
    files: Array.isArray(snapshot.files) ? snapshot.files : [],
    touchedArtifacts: snapshot.touchedArtifacts || {}
  };
}

function readContextText(snapshot, key, fallbackPath) {
  if (snapshot && typeof snapshot[key] === "string") {
    return snapshot[key];
  }
  return fs.readFileSync(fallbackPath, "utf8");
}

function getValueByPath(target, valuePath) {
  return String(valuePath || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), target);
}

function evaluateCondition(task, taskDir, condition, context = null) {
  if (!condition) return false;

  if (Array.isArray(condition.touchedAny)) {
    return touchedAnyInContext(taskDir, condition.touchedAny, context);
  }

  const value = getValueByPath(task, condition.path);

  if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
    return value === condition.equals;
  }

  if (Array.isArray(condition.disallow)) {
    return !condition.disallow.includes(value);
  }

  if (typeof condition.minLength === "number") {
    return (Array.isArray(value) || typeof value === "string") && value.length >= condition.minLength;
  }

  if (condition.truthy === true) {
    return Boolean(value);
  }

  return Boolean(value);
}

function formatValidationMessage(message, task) {
  return String(message || "").replaceAll("{phase}", task.phase);
}

function topicIsPresent(task, rule) {
  return getValueByPath(task, rule?.presentPath) === true;
}

function collectActivatedTopicKeys(task) {
  if (Array.isArray(task.taskPacks?.activatedTopics)) {
    return new Set(
      (task.taskPacks?.activatedTopics || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    );
  }
  return null;
}

function collectSelectedTopicKeys(task) {
  if (Array.isArray(task.taskPacks?.selectedTopics)) {
    return new Set(
      (task.taskPacks?.selectedTopics || [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    );
  }
  return null;
}

function topicIsActivatedForValidation(task, topic) {
  const activeKeys = collectActivatedTopicKeys(task);
  if (activeKeys && activeKeys.size > 0) {
    return activeKeys.has(topic.key);
  }
  // When activatedTopics is empty, only validate topics that were explicitly selected
  // AND whose presentPath is true. Do not validate topics that were only template-mounted.
  const selectedKeys = collectSelectedTopicKeys(task);
  if (selectedKeys && selectedKeys.size > 0) {
    return selectedKeys.has(topic.key);
  }
  // Fallback: if neither activated nor selected topics exist, validate all present topics
  // but only for non-template tasks
  return true;
}

function evaluateTopicFormalValidation(topic, task, findings, options = {}) {
  const { templateMode = false, context = null } = options;
  const rule = topic.formalValidation;
  if (!rule || !topicIsPresent(task, rule) || !topicIsActivatedForValidation(task, topic)) {
    return;
  }

  if (topic.key === "jsvmp" && isVmBlackboxRoute(task)) {
    return;
  }

  for (const relPath of rule.requiredArtifacts || []) {
    if (!artifactExistsInContext(task.__taskDir, relPath, context)) {
      findings.push(`${rule.presentPath}=true but ${relPath} is missing`);
    }
  }

  if (templateMode) {
    return;
  }

  for (const requirement of rule.requirementsAll || []) {
    if (!evaluateCondition(task, task.__taskDir, requirement, context)) {
      findings.push(formatValidationMessage(requirement.message, task));
    }
  }

  for (const group of rule.requirementsAny || []) {
    const passed = (group.checks || []).some((condition) =>
      evaluateCondition(task, task.__taskDir, condition, context)
    );
    if (!passed) {
      findings.push(formatValidationMessage(group.message, task));
    }
  }
}

function evaluateTopicPhaseGuards(task, findings, context = null) {
  const phaseIndex = phaseOrder.indexOf(task.phase);
  if (phaseIndex < 0) {
    return;
  }

  for (const topic of topicValidationRules) {
    const rule = topic.formalValidation;
    if (!topicIsPresent(task, rule) || !topicIsActivatedForValidation(task, topic)) {
      continue;
    }

    for (const guard of rule.phaseGuards || []) {
      const minPhaseIndex = phaseOrder.indexOf(guard.minPhase);
      if (minPhaseIndex < 0 || phaseIndex < minPhaseIndex) {
        continue;
      }

      for (const requirement of guard.requirementsAll || []) {
        if (!evaluateCondition(task, task.__taskDir, requirement, context)) {
          findings.push(formatValidationMessage(requirement.message, task));
        }
      }

      for (const group of guard.requirementsAny || []) {
        const passed = (group.checks || []).some((condition) =>
          evaluateCondition(task, task.__taskDir, condition, context)
        );
        if (!passed) {
          findings.push(formatValidationMessage(group.message, task));
        }
      }
    }
  }
}

function reportHasCurrentAndNext(reportText, phase) {
  const hasPhaseHeading = textMatchesAny(reportText, reportCurrentHeadingPatterns);
  const hasPhaseValue = reportText.includes(phase);
  const hasNextHeading = textMatchesAny(reportText, reportNextHeadingPatterns);
  return hasPhaseHeading && hasPhaseValue && hasNextHeading;
}

function reportHasExecutionDecision(reportText) {
  return (
    textMatchesAny(reportText, reportExecutionHeadingPatterns) &&
    reportExecutionStatus.test(reportText) &&
    reportNextExecutableAction.test(reportText) &&
    reportPauseCategory.test(reportText) &&
    reportPauseReason.test(reportText)
  );
}

function stripInlineCodeAndBlocks(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/`[^`\n]+`/g, " ");
}

function looksLikeIdentifierList(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (!/^[A-Za-z0-9_./,\-| ]+$/.test(value)) return false;
  return !/\b(?:the|and|with|from|when|then|into|request|response|because|should|must|need|using)\b/i.test(value);
}

function narrativeSliceForLanguageCheck(line) {
  let text = stripInlineCodeAndBlocks(line).trim();
  if (!text || /^#{1,6}\s+/.test(text)) {
    return "";
  }

  text = text.replace(/^\s*[-*+]\s*/, "");
  const separatorIndex = [text.indexOf("："), text.indexOf(":")]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (separatorIndex >= 0) {
    const label = text.slice(0, separatorIndex);
    const value = text.slice(separatorIndex + 1);
    if (/[\p{Script=Han}]/u.test(label)) {
      text = value;
    }
  }

  text = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, " ")
    .replace(/\b(?:[A-Za-z]:)?[\\/][^\s]+/g, " ")
    .replace(/\b[\w.-]+\.(?:md|mjs|js|json|yaml|yml|ts|tsx|jsx|py|sh|txt|log)\b/gi, " ")
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (looksLikeIdentifierList(text)) {
    return "";
  }
  return text;
}

function collectReportLanguageViolations(reportText) {
  const narrativeLines = stripInlineCodeAndBlocks(reportText)
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: narrativeSliceForLanguageCheck(line) }))
    .filter((entry) => entry.text);
  const violations = [];

  for (const entry of narrativeLines) {
    const englishWords = entry.text.match(/\b[A-Za-z]{4,}\b/g) || [];
    const hanChars = entry.text.match(/\p{Script=Han}/gu) || [];
    if (englishWords.length >= 5 && hanChars.length === 0) {
      violations.push(`line ${entry.line}: ${entry.text.slice(0, 120)}`);
    }
    if (violations.length >= 3) {
      break;
    }
  }

  const mergedNarrative = narrativeLines.map((entry) => entry.text).join("\n");
  const totalEnglishWords = (mergedNarrative.match(/\b[A-Za-z]{4,}\b/g) || []).length;
  const totalHanChars = (mergedNarrative.match(/\p{Script=Han}/gu) || []).length;
  if (totalEnglishWords >= 30 && totalHanChars < totalEnglishWords * 2) {
    violations.push(`english-dominant narrative: englishWords=${totalEnglishWords}, hanChars=${totalHanChars}`);
  }

  return violations;
}

function taskRequiresLocalReproduction(task) {
  return (
    task.deliveryRequirements?.localReproductionRequested === true ||
    task.deliveryRequirements?.apiCallExampleRequired === true
  );
}

function taskRequiresApiCallExample(task) {
  return task.deliveryRequirements?.apiCallExampleRequired === true;
}

function validateLocalReproductionDelivery(task, reportText, findings, context = null) {
  const pureFiles = collectPureFiles(task.__taskDir);

  if (!reportLocalReproHeading.test(reportText)) {
    findings.push("local reproduction tasks must contain a 本地复现交付 / Local Reproduction Deliverables section");
  }
  if (!reportLocalAlgoEntry.test(reportText)) {
    findings.push("local reproduction tasks must record a non-empty local algorithm implementation path");
  }
  if (!reportLocalExampleEntry.test(reportText)) {
    findings.push("local reproduction tasks must record a non-empty local invocation example path");
  }
  if (!reportRunCommandEntry.test(reportText)) {
    findings.push("local reproduction tasks must record a non-empty runnable command");
  }
  if (!reportOutputSummaryEntry.test(reportText)) {
    findings.push("local reproduction tasks must record a non-empty output or response summary");
  }
  if (pureFiles.length === 0) {
    findings.push("local reproduction tasks require at least one pure-* artifact in the task root or run/");
  }
  if (!artifactExistsInContext(task.__taskDir, "run/local-repro-example.js", context)) {
    findings.push("local reproduction tasks require run/local-repro-example.js");
  } else if (!artifactTouchedInContext(task.__taskDir, "run/local-repro-example.js", context)) {
    findings.push("run/local-repro-example.js is still the template placeholder");
  } else {
    validateExecutableExample(task, "run/local-repro-example.js", "local reproduction example", findings);
  }

  if (taskRequiresApiCallExample(task)) {
    if (!reportApiExampleEntry.test(reportText)) {
      findings.push("API local reproduction tasks must record a non-empty API call example path");
    }
    if (!artifactExistsInContext(task.__taskDir, "run/web-replay.js", context)) {
      findings.push("API local reproduction tasks require run/web-replay.js");
    } else if (!artifactTouchedInContext(task.__taskDir, "run/web-replay.js", context)) {
      findings.push("run/web-replay.js is still the template placeholder");
    } else {
      validateExecutableExample(task, "run/web-replay.js", "API call example", findings);
    }
  }
}

function validateExecutableExample(task, relPath, label, findings) {
  if (task.taskId === "replace-me") {
    return;
  }

  const scriptPath = taskFile(task.__taskDir, relPath);
  const scriptDir = path.dirname(scriptPath);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: scriptDir,
    env: {
      ...process.env,
      WEB_REVERSE_SKILL_ROOT: task.roots?.skillRoot || process.env.WEB_REVERSE_SKILL_ROOT || "",
      WEB_REVERSE_WORKSPACE_ROOT: task.roots?.workspaceRoot || process.env.WEB_REVERSE_WORKSPACE_ROOT || ""
    },
    encoding: "utf8",
    timeout: 30000
  });

  if (result.error) {
    findings.push(`${label} execution failed: ${result.error.message}`);
    return;
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    findings.push(`${label} exited with code ${result.status}${detail ? `: ${detail}` : ""}`);
    return;
  }
  if (!String(result.stdout || "").trim()) {
    findings.push(`${label} must print output to stdout`);
  }
}

export function collectPureFiles(taskDir) {
  const results = new Set();
  const taskEntries = fs.existsSync(taskDir) ? fs.readdirSync(taskDir) : [];
  const runDir = taskFile(taskDir, "run");
  const runEntries = fs.existsSync(runDir) ? fs.readdirSync(runDir) : [];

  for (const name of taskEntries) {
    if (/^pure[_-].+\.(?:[cm]?js|py)$/i.test(name)) {
      results.add(name);
    }
  }
  for (const name of runEntries) {
    if (/^pure[_-].+\.(?:[cm]?js|py)$/i.test(name)) {
      results.add(`run/${name}`);
    }
  }

  return Array.from(results).sort();
}

// 合规 P1-4：四段强制不再仅绑 `pure-` 命名——堵命名规避（会话里成品脚本叫 dun163_solver.py / with_ddddocr.py
// 而非 pure-，导致四段强制静默失效）。这里收集 run/ 下「被 verify/fixtures 引用、或明显是成品求解器」的脚本：
// 1) 排除模板自带脚手架文件（与 _TEMPLATE/run 同名）与固定工具脚本；
// 2) 排除 *-template.* 模板；
// 3) 其余 .py/.js/.mjs/.cjs 视为成品脚本候选；若被 verify-once.mjs / fixtures.json 文本引用则更强证据。
export function collectSolverArtifacts(taskDir) {
  const runDir = taskFile(taskDir, "run");
  if (!fs.existsSync(runDir)) {
    return [];
  }
  const templateRunDir = taskFile(templateTaskDir, "run");
  const templateNames = new Set(
    fs.existsSync(templateRunDir) ? fs.readdirSync(templateRunDir) : []
  );
  const fixedTooling = new Set([
    "verify-once.mjs",
    "closeout.mjs",
    "validate-fixture.mjs",
    "run-local.mjs",
    "fixtures.json",
    "local-repro-example.js",
    "web-replay.js"
  ]);
  // 读取 verify-once.mjs / fixtures.json 原文，用于判定「被引用」。
  let referenceText = "";
  for (const rel of ["run/verify-once.mjs", "run/fixtures.json"]) {
    try {
      const filePath = taskFile(taskDir, rel);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        referenceText += "\n" + fs.readFileSync(filePath, "utf8");
      }
    } catch {
      // ignore
    }
  }
  const results = [];
  for (const name of fs.readdirSync(runDir)) {
    if (!/\.(?:[cm]?js|py)$/i.test(name)) continue;
    if (templateNames.has(name)) continue; // 模板脚手架，不算成品
    if (fixedTooling.has(name)) continue;
    if (/-template\.(?:[cm]?js|py)$/i.test(name)) continue;
    if (/^pure[_-]/i.test(name)) continue; // 已由 collectPureFiles 覆盖
    results.push({
      rel: `run/${name}`,
      referenced: referenceText.includes(name)
    });
  }
  return results;
}

function readTaskFileIfExists(taskDir, relPath) {
  const filePath = taskFile(taskDir, relPath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function collectSensitiveArtifactCandidates(taskDir) {
  const relPaths = new Set([
    "cookies.json",
    "run/cookies.json",
    "state/cookies.json",
    "run/live-browser-response-body.txt",
    "run/storage-snapshot.json",
    "state/storage-snapshot.json",
    "state/route-state.json"
  ]);

  for (const baseDir of ["run", "state"]) {
    const dirPath = taskFile(taskDir, baseDir);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      continue;
    }

    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      if (!/\.(?:json|jsonl|md|txt)$/i.test(entry.name)) {
        continue;
      }
      if (!/(cookie|storage|session|token|state|snapshot|header|response|auth)/i.test(entry.name)) {
        continue;
      }
      relPaths.add(`${baseDir}/${entry.name}`);
    }
  }

  return Array.from(relPaths).sort((left, right) => left.localeCompare(right));
}

function containsRawSensitiveSessionMaterial(text) {
  const normalized = String(text || "");
  const patterns = [
    /\b(?:sessionid|sessionid_ss|sid_tt|sid_guard|ttwid|passport_csrf_token(?:_default)?|authorization|csrf_session_id|__ac_signature|__ac_nonce|msToken|x-ms-token)\b[^,\r\n]{0,24}[:=]\s*["']?[A-Za-z0-9+/_=-]{12,}/i,
    /\bset-cookie\b\s*:\s*[^\r\n]{16,}/i,
    /"cookie"\s*:\s*"[^"]{20,}"/i,
    /"authorization"\s*:\s*"[^"]{12,}"/i
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function collectArtifactHygieneFindings(task, findings, options = {}) {
  const { strict = false } = options;
  const push = (message) => findings.push(message);
  for (const relPath of [
    "run/puppeteer-profile",
    "run/playwright-profile",
    "run/browser-profile"
  ]) {
    if (fs.existsSync(taskFile(task.__taskDir, relPath))) {
      push(
        strict
          ? `${relPath} must be removed before closeout; browser profiles must not remain in task-local artifacts`
          : `${relPath} should be cleaned before closeout; browser profiles should not remain in task-local artifacts`
      );
    }
  }

  for (const relPath of collectSensitiveArtifactCandidates(task.__taskDir)) {
    const filePath = taskFile(task.__taskDir, relPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      continue;
    }
    const text = readTaskFileIfExists(task.__taskDir, relPath);
    if (containsRawSensitiveSessionMaterial(text)) {
      push(
        strict
          ? `${relPath} appears to contain raw sensitive session material; closeout requires redacted / minimized snapshots`
          : `${relPath} appears to contain raw sensitive session material; prefer redacted / minimized snapshots`
      );
    }
    if (fs.statSync(filePath).size > 200_000) {
      push(
        strict
          ? `${relPath} is too large for default closeout retention; prefer response summaries or minimized samples`
          : `${relPath} is large; prefer response summaries or minimized samples over full raw payloads`
      );
    }
  }
}

// 红线2 机械门禁（架P0#1 / 技P0#1）：本任务 boot 后散落在 workspace 根目录的脚本/数据
// 必须搬进 artifacts/tasks/<task-id>/run|state。命中即 error，rule=move-stray-artifacts-into-task-run-dir。
// 只认「mtime 晚于 task 创建」的文件（见 common.mjs collectStrayWorkspaceArtifacts），不误报用户既有代码。
function collectStrayWorkspaceArtifactFindings(task, findings) {
  const workspaceRootDir = task.roots?.workspaceRoot;
  const taskLocalRoot = task.roots?.taskLocalRoot || task.__taskDir;
  if (!workspaceRootDir) {
    return;
  }
  // 若 workspaceRoot 与 task-local 重合（cwd 即任务目录），根目录扫描无意义，跳过。
  if (path.resolve(workspaceRootDir) === path.resolve(taskLocalRoot || workspaceRootDir)) {
    return;
  }
  const { stray, baselineMs } = collectStrayWorkspaceArtifacts(task.__taskDir, workspaceRootDir);
  if (stray.length === 0) {
    return;
  }
  const runDir = path.join("artifacts", "tasks", path.basename(task.__taskDir), "run").replaceAll("\\", "/");
  findings.push(
    `workspace 根目录散落 ${stray.length} 个本任务产物（红线2违规）：${stray.join(", ")}；` +
      `必须移入 ${runDir}/（脚本/样本）或 state/（中间数据）。` +
      `rule=move-stray-artifacts-into-task-run-dir${baselineMs ? "" : "（无法读取 boot 基线时间，已全量扫描顶层）"}`
  );
}

// 控制字段占位检测（交付门禁专用，语义比路由校验的 isPlaceholderControlValue 更宽）：
// deriveTaskMode/deriveTopicFocus 在未选定时回退到 pending-*；renderTaskSummaryBody 又会忠实回填这些占位。
// closeout 不应在控制字段仍是占位时通过（架P0#2 / 技D）。
// 这里**空串也判为占位（返回 true）**，且额外覆盖 replace-me/tbd/todo——与 :222 的路由校验语义刻意分离，
// 避免改动既有路由占位判定（尤其 fallbackMode 分支）的行为。
function isPlaceholderDeliveryControlValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return /^pending[-_]/.test(normalized) || normalized === "replace-me" || normalized === "tbd" || normalized === "todo";
}

export function evaluateDeliveryAuthenticity(task, findings, context = null) {
  if (!taskRequiresLocalReproduction(task)) {
    return;
  }

  for (const relPath of ["run/local-repro-example.js", "run/web-replay.js"]) {
    if (
      !artifactExistsInContext(task.__taskDir, relPath, context) ||
      artifactTouchedInContext(task.__taskDir, relPath, context) === false
    ) {
      continue;
    }

    const text = readTaskFileIfExists(task.__taskDir, relPath);
    if (!text.trim()) {
      continue;
    }

    if (suspiciousReplayFallbackPatterns.some((pattern) => pattern.test(text))) {
      findings.push(`${relPath} contains fallback-to-saved-response / verify_check / unsigned fallback handling; API delivery must not depend on cached successful JSON or unsigned replay`);
    }

    if (/unused params/i.test(text)) {
      findings.push(`${relPath} explicitly labels generated signer params as unused`);
    }

    const generatedABogus = /\baBogus\b|["']a_bogus["']/i.test(text);
    const usesABogus =
      /searchParams\.set\(\s*["']a_bogus["']/i.test(text) ||
      /\b(?:aBundle|signedUrl)\.signedUrl\b/.test(text) ||
      /doRequest\([^)]*signedUrl/i.test(text);
    if (generatedABogus && !usesABogus) {
      findings.push(`${relPath} generates a_bogus but the final request path does not appear to use it`);
    }

    const generatedXBogus = /\bxBogus\b|["']X-Bogus["']/i.test(text);
    const usesXBogus =
      /searchParams\.set\(\s*["']X-Bogus["']/i.test(text) ||
      /headers\s*[:=][\s\S]{0,200}["']X-Bogus["']/i.test(text) ||
      /\b(?:msBundle|signedUrl)\.signedUrl\b/.test(text);
    if (generatedXBogus && !usesXBogus) {
      findings.push(`${relPath} generates X-Bogus but the final request path does not appear to use it`);
    }

    const generatedSignature = /\bsignature\b|["']_signature["']/i.test(text);
    const usesSignature =
      /searchParams\.set\(\s*["']_signature["']/i.test(text) ||
      /\b(?:msBundle|signedUrl)\.signedUrl\b/.test(text);
    if (generatedSignature && !usesSignature) {
      findings.push(`${relPath} generates _signature but the final request path does not appear to use it`);
    }
  }
}

function textIncludesAny(text, values = []) {
  const haystack = String(text || "").toLowerCase();
  return values.some((value) => haystack.includes(String(value || "").trim().toLowerCase()));
}

function deriveAcceptanceValidators(task) {
  const values = new Set(["generic-contract"]);
  for (const validator of task.acceptanceModel?.validators || []) {
    if (String(validator || "").trim()) {
      values.add(String(validator).trim());
    }
  }
  if (taskRequiresLocalReproduction(task)) {
    values.add("local-reproduction");
  }
  if (taskRequiresApiCallExample(task)) {
    values.add("api-call-example");
  }
  return Array.from(values);
}

function validateTaskContractSnapshot(task, reportText, findings) {
  const contract = task.taskContract || {};
  const acceptance = task.acceptanceModel || {};
  const claimLevel = String(acceptance.claimLevel || "provisional").trim();
  const forbiddenDeliveryTokens = collectPolicyTokens([
    ...(acceptance.userRejectedApproaches || []),
    ...(contract.disallowedFallbacks || [])
  ]);
  const prohibitedIntermediateSignals = collectPolicyTokens([
    ...(contract.intermediateStatesNotDelivery || []),
    ...(acceptance.prohibitedIntermediateSignals || [])
  ]);

  if (!hasMeaningfulText(contract.objective)) {
    findings.push("taskContract.objective must be populated; every task requires an explicit contract objective");
  }
  if (!hasMeaningfulText(contract.deliverableTier)) {
    findings.push("taskContract.deliverableTier must be populated");
  }
  if ((contract.completionCriteria || []).length === 0 && countHitSuccessCriteria(task.successCriteria) === 0) {
    findings.push("taskContract.completionCriteria must be populated, or successCriteria must record at least one verifiable completion condition");
  }
  if (!textMatchesAny(reportText, reportContractHeadingPatterns)) {
    findings.push("report.md must contain a 任务契约 / Task Contract section");
  } else {
    if (!reportContractObjective.test(reportText)) {
      findings.push("report.md 任务契约 section must record a non-empty objective");
    }
    if (!reportContractTier.test(reportText)) {
      findings.push("report.md 任务契约 section must record a non-empty deliverable tier");
    }
  }
  if (!textMatchesAny(reportText, reportSummaryHeadingPatterns)) {
    findings.push("report.md must contain a 任务摘要 / Summary section");
  } else {
    if (!reportWorkspaceRoot.test(reportText)) {
      findings.push("report.md 任务摘要 section must record workspaceRoot");
    }
    if (!reportTaskLocalRoot.test(reportText)) {
      findings.push("report.md 任务摘要 section must record taskLocalRoot");
    }
    if (!reportArtifactTruthRoot.test(reportText)) {
      findings.push("report.md 任务摘要 section must record artifactTruthRoot");
    }
    if (!reportWorkspaceKind.test(reportText)) {
      findings.push("report.md 任务摘要 section must record workspaceKind");
    }
    if (!reportTaskMode.test(reportText)) {
      findings.push("report.md 任务摘要 section must record taskMode");
    }
    if (!reportFallbackMode.test(reportText)) {
      findings.push("report.md 任务摘要 section must record fallbackMode");
    }
    if (!reportPrimaryTopic.test(reportText)) {
      findings.push("report.md 任务摘要 section must record primaryTopic");
    }
    if (!reportSecondaryTopics.test(reportText)) {
      findings.push("report.md 任务摘要 section must record secondaryTopics");
    }
    if (!reportEvidenceStatus.test(reportText)) {
      findings.push("report.md 任务摘要 section must record evidenceStatus");
    }
    if (claimLevel !== "delivered" && !reportWhyNotDeliveredYet.test(reportText)) {
      findings.push("non-delivered report.md 任务摘要 section must record whyNotDeliveredYet");
    }
  }
  if (!textMatchesAny(reportText, reportExecutionModelHeadingPatterns)) {
    findings.push("report.md must contain an 执行状态机 / Execution Model section");
  } else {
    if (!reportExecutionCurrentState.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 当前执行状态 / current execution state");
    }
    if (!reportExecutionPrimaryEntrypoint.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 主切入点 / primary entrypoint");
    }
    if (!reportExecutionPrimaryMode.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 主模式 / primary mode");
    }
    if (!reportExecutionPrimaryTopic.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 主专题 / primary topic");
    }
    if (!reportExecutionSecondaryTopics.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 辅助专题 / secondary topics");
    }
    if (!reportExecutionMicroRoute.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 当前微路线 / microRoute");
    }
    if (!reportExecutionExperimentClass.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 当前实验类别 / experiment class");
    }
    if (!reportExecutionRoundBudget.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 当前轮次预算 / round budget");
    }
    if (!reportExecutionRoundsConsumed.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 当前已消耗轮次 / rounds consumed");
    }
    if (!reportExecutionStopLoss.test(reportText)) {
      findings.push("report.md 执行状态机 section must record 当前停损条件 / stopLossCondition");
    }
    if (!reportExecutionDeepDiveActive.test(reportText)) {
      findings.push("report.md 执行状态机 section must record deepDivePermit.active");
    }
    if (!reportExecutionDeepDiveMaxRounds.test(reportText)) {
      findings.push("report.md 执行状态机 section must record deepDivePermit.maxRounds");
    }
    if (!reportExecutionDeepDiveCurrentMicroRoute.test(reportText)) {
      findings.push("report.md 执行状态机 section must record deepDivePermit.currentMicroRoute");
    }
    if (!reportExecutionDeepDiveSubgoal.test(reportText)) {
      findings.push("report.md 执行状态机 section must record deepDivePermit.subgoal");
    }
    if (!reportExecutionDeepDiveMilestone.test(reportText)) {
      findings.push("report.md 执行状态机 section must record deepDivePermit.milestone");
    }
    if (!reportExecutionDeepDiveExitCondition.test(reportText)) {
      findings.push("report.md 执行状态机 section must record deepDivePermit.exitCondition");
    }
    if (!reportExecutionDeepDiveExpectedEvidence.test(reportText)) {
      findings.push("report.md 执行状态机 section must record deepDivePermit.expectedHighValueEvidence");
    }
  }
  if (!textMatchesAny(reportText, reportAcceptanceHeadingPatterns)) {
    findings.push("report.md must contain an 验收闭环 / Acceptance Closure section");
  } else if (!reportAcceptanceClaimLevel.test(reportText)) {
    findings.push("report.md 验收闭环 section must record claimLevel");
  }
  if (!reportEntrypointHeading.test(reportText)) {
    findings.push("report.md must contain a 切入点循环 / Entrypoint Loop section");
  } else {
    if (!reportActiveEntrypoints.test(reportText)) {
      findings.push("report.md 切入点循环 section must record activeEntrypoints");
    }
    if (!reportEntrypointStatuses.test(reportText)) {
      findings.push("report.md 切入点循环 section must record entrypointStatuses");
    }
    if (!reportEntrypointNextId.test(reportText)) {
      findings.push("report.md 切入点循环 section must record execution.nextEntrypointId");
    }
    if (!reportEntrypointNextAction.test(reportText)) {
      findings.push("report.md 切入点循环 section must record execution.nextExecutableAction");
    }
  }
  if (claimLevel === "delivered") {
    if (hasMeaningfulText(acceptance.acceptanceGap)) {
      findings.push("claimLevel=delivered requires acceptanceModel.acceptanceGap to be empty");
    }
    if (!hasMeaningfulText(acceptance.acceptancePath)) {
      findings.push("claimLevel=delivered requires acceptanceModel.acceptancePath");
    }
    if ((acceptance.completionBlockedBy || []).length > 0) {
      findings.push("claimLevel=delivered requires acceptanceModel.completionBlockedBy to be empty");
    }
  } else {
    if (!hasMeaningfulText(acceptance.acceptanceGap)) {
      findings.push("non-delivered claims require acceptanceModel.acceptanceGap");
    }
    if (!hasMeaningfulText(acceptance.nextEvidenceGate)) {
      findings.push("non-delivered claims require acceptanceModel.nextEvidenceGate");
    }
  }

  for (const token of forbiddenDeliveryTokens) {
    if (textHasPolicyToken(acceptance.acceptancePath, token)) {
      findings.push(`acceptanceModel.acceptancePath reuses a forbidden delivery route: ${token}`);
    }
  }

  if (claimLevel === "delivered") {
    for (const token of prohibitedIntermediateSignals) {
      if (textHasPolicyToken(acceptance.acceptancePath, token)) {
        findings.push(`claimLevel=delivered cannot use an intermediate-state placeholder as acceptancePath: ${token}`);
      }
    }
  }

  for (const token of forbiddenDeliveryTokens) {
    if (token && String(reportText || "").toLowerCase().includes(token.toLowerCase())) {
      findings.push(`report.md still references a forbidden delivery route: ${token}`);
    }
  }

}

// 合规 P0-2：挑战链 / 验证码 / 滑块类任务（模式 A）的验收 = 端到端服务端返回成功，
// 不是「格式被接受 / JSON 字段齐全 / validate-fixture 通过」。
// 「格式被接受」类弱验收措辞——出现在 acceptancePath 即视为冒充验收。
const formatOnlyAcceptancePatterns = [
  /格式被(?:识别为)?(?:合法|接受)/,
  /字段(?:被)?(?:识别|接受|齐全|存在)/,
  /validate[-_ ]?fixture/i,
  /(?:json|response)\s*(?:字段|schema)\s*(?:齐全|存在|valid)/i,
  /format[-_ ]?accepted/i,
  /被接受为合法格式/
];
// 端到端真实成功的证据措辞（acceptancePath 至少应命中其一）。
const endToEndSuccessPatterns = [
  /error\s*[=:]?\s*0\b/i,
  /(?:服务端|server).{0,6}(?:成功|通过|success)/i,
  /(?:校验|验证|挑战|滑块|求解器|solver).{0,4}(?:通过|成功|pass)/i,
  /(?:通过率|pass\s*rate)/i,
  /(?:end[-\s]?to[-\s]?end|端到端).{0,6}(?:成功|通过|success)/i,
  /\bverify-once\b.{0,12}(?:pass|通过|成功)/i,
  /retCode\s*[=:]?\s*0|result\s*[=:]?\s*(?:true|ok|success)/i
];

function taskIsChallengeClass(task) {
  if (task.challengeOrchestration?.present === true) {
    return true;
  }
  const mode = cleanText(task.executionModel?.taskMode);
  // 模式 A「请求验收」+ 目标含挑战/验证码/滑块关键词时按挑战类对待。
  const objective = cleanText(task.taskContract?.objective);
  const isModeA = /请求验收|请求成功|挑战链/.test(mode);
  const hasChallengeKeyword = /验证码|滑块|点选|挑战|captcha|slider|geetest|turnstile|recaptcha|人机/i.test(objective);
  return isModeA && hasChallengeKeyword;
}

// 在 closeout / verify 声明 delivered 时调用：挑战类任务的 acceptancePath 不得是「格式被接受」类弱验收，
// 且应能体现端到端服务端成功；否则 BLOCK——拦下「validate-fixture 通过即报完成」的会话级事故。
function validateChallengeAcceptance(task, findings) {
  if (!taskIsChallengeClass(task)) {
    return;
  }
  const acceptance = task.acceptanceModel || {};
  const claimLevel = String(acceptance.claimLevel || "provisional").trim();
  if (claimLevel !== "delivered" && claimLevel !== "acceptance-ready") {
    return;
  }
  const acceptancePath = cleanText(acceptance.acceptancePath);
  if (formatOnlyAcceptancePatterns.some((pattern) => pattern.test(acceptancePath))) {
    findings.push(
      "challenge/captcha task: acceptancePath 是「格式被接受 / 字段齐全 / validate-fixture 通过」类弱验收，" +
        "不能冒充验收；模式 A 验收 = 端到端服务端返回成功（求解器实际通过 / error==0 且业务校验通过），必须由 verify-once 复现"
    );
  }
  if (claimLevel === "delivered" && acceptancePath && !endToEndSuccessPatterns.some((pattern) => pattern.test(acceptancePath))) {
    findings.push(
      "challenge/captcha task claimLevel=delivered 但 acceptancePath 未体现端到端服务端成功（error==0 / 求解器通过 / 通过率 等）；" +
        "format-accepted 只能标 provisional，端到端成功才能 delivered"
    );
  }
}

function validateExecutionControlTruth(task, routeState, reportText, findings) {
  const model = task.executionModel || {};
  const execution = routeState?.execution || {};
  const permit = model.deepDivePermit || {};
  const discipline = execution?.discipline || {};
  const claimLevel = String(task.acceptanceModel?.claimLevel || "provisional").trim();
  const taskMode = cleanText(model.taskMode);
  const fallbackMode = cleanText(model.fallbackMode);
  const primaryTopic = cleanText(model.primaryTopic);
  const secondaryTopics = Array.isArray(model.secondaryTopics)
    ? model.secondaryTopics.map((topic) => cleanText(topic)).filter(Boolean)
    : [];
  const controlSources = model.controlSources || {};
  const strongState =
    claimLevel === "delivered" ||
    ["ready-to-continue", "completed"].includes(String(execution.status || "").trim());
  const semanticTaskMode = deriveTaskModeFromSemantics(task, routeState);
  const semanticTopicFocus = deriveTopicFocusFromSemantics(task, routeState);
  const semanticPrimaryTopic = cleanText(semanticTopicFocus.primaryTopic);
  const semanticSecondaryTopics = Array.isArray(semanticTopicFocus.secondaryTopics)
    ? semanticTopicFocus.secondaryTopics.map((topic) => cleanText(topic)).filter(Boolean)
    : [];
  const currentState = cleanText(model.currentState || task.phase);
  const primaryEntrypoint = cleanText(model.primaryEntrypoint || execution.nextEntrypointId);
  const experimentClass = cleanText(model.experimentClass);
  const workspaceRoot = cleanText(discipline.workspaceRoot || task.roots?.workspaceRoot);
  const taskLocalRoot = cleanText(discipline.taskLocalRoot || task.roots?.taskLocalRoot || task.__taskDir);
  const artifactTruthRoot = cleanText(discipline.artifactTruthRoot || taskLocalRoot);
  const workspaceKind = cleanText(discipline.workspaceKind || discipline.workspaceMode);
  const secondaryCanonical = canonicalListText(secondaryTopics);
  const semanticSecondaryCanonical = canonicalListText(semanticSecondaryTopics);

  if (taskMode && !allowedTaskModes.has(taskMode) && !isPlaceholderControlValue(taskMode)) {
    findings.push(`executionModel.taskMode is invalid: ${taskMode}`);
  }
  if (fallbackMode && (!allowedTaskModes.has(fallbackMode) || isPlaceholderControlValue(fallbackMode))) {
    findings.push(`executionModel.fallbackMode is invalid: ${fallbackMode}`);
  }
  if (fallbackMode && fallbackMode === taskMode) {
    findings.push("executionModel.fallbackMode must differ from executionModel.taskMode");
  }
  if (primaryTopic && !validTopicKeys.has(primaryTopic) && !isPlaceholderControlValue(primaryTopic)) {
    findings.push(`executionModel.primaryTopic is invalid: ${primaryTopic}`);
  }
  if (secondaryTopics.length > 2) {
    findings.push("executionModel.secondaryTopics must not contain more than 2 topics");
  }
  if (new Set(secondaryTopics).size !== secondaryTopics.length) {
    findings.push("executionModel.secondaryTopics must not contain duplicates");
  }
  for (const topic of secondaryTopics) {
    if (!validTopicKeys.has(topic)) {
      findings.push(`executionModel.secondaryTopics contains invalid topic: ${topic}`);
    }
    if (topic === primaryTopic) {
      findings.push("executionModel.secondaryTopics must not repeat executionModel.primaryTopic");
    }
    if (isPlaceholderControlValue(topic)) {
      findings.push(`executionModel.secondaryTopics contains placeholder topic: ${topic}`);
    }
  }

  if (strongState) {
    if (!taskMode || isPlaceholderControlValue(taskMode)) {
      findings.push("strong execution states must not keep executionModel.taskMode as a placeholder");
    }
    if (!primaryTopic || isPlaceholderControlValue(primaryTopic) || !validTopicKeys.has(primaryTopic)) {
      findings.push("strong execution states must not keep executionModel.primaryTopic as a placeholder");
    }
    if (cleanText(controlSources.taskMode) !== "explicit") {
      findings.push(`strong execution states require executionModel.controlSources.taskMode=explicit, got ${cleanText(controlSources.taskMode) || "(empty)"}`);
    }
    if (cleanText(controlSources.primaryTopic) !== "explicit") {
      findings.push(`strong execution states require executionModel.controlSources.primaryTopic=explicit, got ${cleanText(controlSources.primaryTopic) || "(empty)"}`);
    }
    if (cleanText(controlSources.secondaryTopics) !== "explicit") {
      findings.push(`strong execution states require executionModel.controlSources.secondaryTopics=explicit, got ${cleanText(controlSources.secondaryTopics) || "(empty)"}`);
    }
  }

  if (taskMode && semanticTaskMode !== "pending-mode-selection" && taskMode !== semanticTaskMode) {
    findings.push(`executionModel.taskMode is semantically inconsistent: expected ${semanticTaskMode} from deliverableTier/topics/route, got ${taskMode}`);
  }

  if (
    semanticPrimaryTopic &&
    semanticPrimaryTopic !== "pending-topic-selection" &&
    primaryTopic &&
    primaryTopic !== semanticPrimaryTopic
  ) {
    findings.push(`executionModel.primaryTopic is semantically inconsistent: expected ${semanticPrimaryTopic} from selectedTopics/route boundTopics, got ${primaryTopic}`);
  }

  if (
    semanticSecondaryTopics.length > 0 &&
    secondaryTopics.length > 0 &&
    secondaryCanonical !== semanticSecondaryCanonical
  ) {
    findings.push(`executionModel.secondaryTopics is semantically inconsistent: expected ${semanticSecondaryCanonical} from selectedTopics/route boundTopics, got ${secondaryCanonical}`);
  }

  const hasPermitNarrativeFields = [
    permit.subgoal,
    permit.milestone,
    permit.exitCondition,
    permit.expectedHighValueEvidence,
    permit.currentMicroRoute,
    permit.permitReason,
    permit.reviewedAt
  ].some((value) => hasMeaningfulText(value));

  if (permit.active === true) {
    if (!hasMeaningfulText(permit.subgoal)) {
      findings.push("deepDivePermit.active=true requires deepDivePermit.subgoal");
    }
    if (!hasMeaningfulText(permit.milestone)) {
      findings.push("deepDivePermit.active=true requires deepDivePermit.milestone");
    }
    if (!Number.isInteger(permit.maxRounds) || permit.maxRounds <= 0) {
      findings.push("deepDivePermit.active=true requires deepDivePermit.maxRounds > 0");
    }
    if (!hasMeaningfulText(permit.exitCondition)) {
      findings.push("deepDivePermit.active=true requires deepDivePermit.exitCondition");
    }
    if (!hasMeaningfulText(permit.expectedHighValueEvidence)) {
      findings.push("deepDivePermit.active=true requires deepDivePermit.expectedHighValueEvidence");
    }
    if (!hasMeaningfulText(permit.currentMicroRoute)) {
      findings.push("deepDivePermit.active=true requires deepDivePermit.currentMicroRoute");
    }
    if (
      hasMeaningfulText(model.microRoute) &&
      hasMeaningfulText(permit.currentMicroRoute) &&
      cleanText(model.microRoute) !== cleanText(permit.currentMicroRoute)
    ) {
      findings.push("deepDivePermit.currentMicroRoute must match executionModel.microRoute when both are populated");
    }
  } else {
    if ((Number(permit.maxRounds) || 0) > 0 || hasPermitNarrativeFields) {
      findings.push("deepDivePermit.active=false must not carry deep-dive override fields");
    }
  }

  if (model.roundsConsumed > model.roundBudget) {
    if (permit.active !== true) {
      findings.push("executionModel.roundsConsumed exceeds roundBudget without an active deepDivePermit");
    } else if (!Number.isInteger(permit.maxRounds) || permit.maxRounds <= 0) {
      findings.push("executionModel.roundsConsumed exceeds roundBudget but deepDivePermit.maxRounds is invalid");
    } else if (model.roundsConsumed > permit.maxRounds) {
      findings.push("executionModel.roundsConsumed exceeds deepDivePermit.maxRounds");
    }
  }

  validateReportScalarTruth(
    reportText,
    "workspaceRoot",
    workspaceRoot,
    findings,
    "report.md 任务摘要.workspaceRoot must match execution.discipline.workspaceRoot"
  );
  validateReportScalarTruth(
    reportText,
    "taskLocalRoot",
    taskLocalRoot,
    findings,
    "report.md 任务摘要.taskLocalRoot must match execution.discipline.taskLocalRoot"
  );
  validateReportScalarTruth(
    reportText,
    "artifactTruthRoot",
    artifactTruthRoot,
    findings,
    "report.md 任务摘要.artifactTruthRoot must match execution.discipline.artifactTruthRoot"
  );
  validateReportScalarTruth(
    reportText,
    "workspaceKind",
    workspaceKind,
    findings,
    "report.md 任务摘要.workspaceKind must match execution.discipline.workspaceKind"
  );
  validateReportScalarTruth(
    reportText,
    "taskMode",
    taskMode,
    findings,
    "report.md 任务摘要.taskMode must match executionModel.taskMode"
  );
  validateReportScalarTruth(
    reportText,
    "fallbackMode",
    fallbackMode,
    findings,
    "report.md 任务摘要.fallbackMode must match executionModel.fallbackMode"
  );
  validateReportScalarTruth(
    reportText,
    "primaryTopic",
    primaryTopic,
    findings,
    "report.md 任务摘要.primaryTopic must match executionModel.primaryTopic"
  );
  validateReportCsvTruth(
    reportText,
    "secondaryTopics",
    secondaryTopics,
    findings,
    "report.md 任务摘要.secondaryTopics must match executionModel.secondaryTopics"
  );
  validateReportScalarTruth(
    reportText,
    "当前执行状态",
    currentState,
    findings,
    "report.md 执行状态机.当前执行状态 must match executionModel.currentState"
  );
  validateReportScalarTruth(
    reportText,
    "主切入点",
    primaryEntrypoint,
    findings,
    "report.md 执行状态机.主切入点 must match executionModel.primaryEntrypoint"
  );
  validateReportScalarTruth(
    reportText,
    "主模式",
    taskMode,
    findings,
    "report.md 执行状态机.主模式 must match executionModel.taskMode"
  );
  validateReportScalarTruth(
    reportText,
    "主专题",
    primaryTopic,
    findings,
    "report.md 执行状态机.主专题 must match executionModel.primaryTopic"
  );
  validateReportCsvTruth(
    reportText,
    "辅助专题",
    secondaryTopics,
    findings,
    "report.md 执行状态机.辅助专题 must match executionModel.secondaryTopics"
  );
  validateReportScalarTruth(
    reportText,
    "当前微路线",
    model.microRoute,
    findings,
    "report.md 执行状态机.当前微路线 must match executionModel.microRoute"
  );
  validateReportScalarTruth(
    reportText,
    "当前实验类别",
    experimentClass,
    findings,
    "report.md 执行状态机.当前实验类别 must match executionModel.experimentClass"
  );
  validateReportScalarTruth(
    reportText,
    "当前停损条件",
    model.stopLossCondition,
    findings,
    "report.md 执行状态机.当前停损条件 must match executionModel.stopLossCondition"
  );
  validateReportIntegerTruth(
    reportText,
    "当前轮次预算",
    model.roundBudget,
    findings,
    "report.md 执行状态机.当前轮次预算 must match executionModel.roundBudget"
  );
  validateReportIntegerTruth(
    reportText,
    "当前已消耗轮次",
    model.roundsConsumed,
    findings,
    "report.md 执行状态机.当前已消耗轮次 must match executionModel.roundsConsumed"
  );
  validateReportBooleanTruth(
    reportText,
    "deepDivePermit.active",
    permit.active === true,
    findings,
    "report.md 执行状态机.deepDivePermit.active must match executionModel.deepDivePermit.active"
  );
  validateReportIntegerTruth(
    reportText,
    "deepDivePermit.maxRounds",
    permit.maxRounds ?? 0,
    findings,
    "report.md 执行状态机.deepDivePermit.maxRounds must match executionModel.deepDivePermit.maxRounds"
  );
  validateReportScalarTruth(
    reportText,
    "deepDivePermit.currentMicroRoute",
    permit.currentMicroRoute,
    findings,
    "report.md 执行状态机.deepDivePermit.currentMicroRoute must match executionModel.deepDivePermit.currentMicroRoute"
  );
  validateReportScalarTruth(
    reportText,
    "deepDivePermit.subgoal",
    permit.subgoal,
    findings,
    "report.md 执行状态机.deepDivePermit.subgoal must match executionModel.deepDivePermit.subgoal"
  );
  validateReportScalarTruth(
    reportText,
    "deepDivePermit.milestone",
    permit.milestone,
    findings,
    "report.md 执行状态机.deepDivePermit.milestone must match executionModel.deepDivePermit.milestone"
  );
  validateReportScalarTruth(
    reportText,
    "deepDivePermit.exitCondition",
    permit.exitCondition,
    findings,
    "report.md 执行状态机.deepDivePermit.exitCondition must match executionModel.deepDivePermit.exitCondition"
  );
  validateReportScalarTruth(
    reportText,
    "deepDivePermit.expectedHighValueEvidence",
    permit.expectedHighValueEvidence,
    findings,
    "report.md 执行状态机.deepDivePermit.expectedHighValueEvidence must match executionModel.deepDivePermit.expectedHighValueEvidence"
  );

  const routeEntrypoints = Array.isArray(routeState?.entrypoints) ? routeState.entrypoints : [];
  validateReportCsvTruth(
    reportText,
    "activeEntrypoints",
    routeState?.activeEntrypoints || [],
    findings,
    "report.md 切入点循环.activeEntrypoints must match route-state.json"
  );
  validateReportPipeTruth(
    reportText,
    "entrypointStatuses",
    routeEntrypoints.map((entrypoint) => `${entrypoint.id}:${entrypoint.status || "UNKNOWN"}`),
    findings,
    "report.md 切入点循环.entrypointStatuses must match route-state.json"
  );
  validateReportScalarTruth(
    reportText,
    "execution.nextEntrypointId",
    execution.nextEntrypointId,
    findings,
    "report.md 切入点循环.execution.nextEntrypointId must match route-state.json"
  );
  validateReportScalarTruth(
    reportText,
    "execution.nextExecutableAction",
    execution.nextExecutableAction,
    findings,
    "report.md 切入点循环.execution.nextExecutableAction must match route-state.json"
  );
}

function validateAcceptancePlugins(task, reportText, findings, context = null) {
  const acceptance = task.acceptanceModel || {};
  const validators = deriveAcceptanceValidators(task);
  const claimLevel = String(acceptance.claimLevel || "provisional").trim();

  for (const validator of validators) {
    switch (validator) {
      case "generic-contract":
        if (!textMatchesAny(reportText, reportAcceptanceHeadingPatterns)) {
          findings.push("generic-contract validator requires a 验收闭环 / Acceptance Closure section in report.md");
        }
        if (claimLevel === "delivered" && !reportAcceptancePathEntry.test(reportText)) {
          findings.push("generic-contract validator requires report.md to expose acceptancePath before delivered claims");
        }
        break;
      case "local-reproduction":
        validateLocalReproductionDelivery(task, reportText, findings, context);
        break;
      case "api-call-example":
        if (!artifactExistsInContext(task.__taskDir, "run/web-replay.js", context)) {
          findings.push("api-call-example validator requires run/web-replay.js");
        }
        break;
      case "request-accepted":
        if (claimLevel === "delivered" && !/请求验收状态/i.test(reportText)) {
          findings.push("request-accepted validator requires report.md to expose 请求验收状态 before delivered claims");
        }
        break;
      case "content-boundary":
        if (
          claimLevel === "delivered" &&
          /(ffprobe 可读|容器可读|浏览器 PoC)/i.test(String(acceptance.acceptancePath || ""))
        ) {
          findings.push("content-boundary validator rejects acceptancePath that only mentions container-readable / browser PoC style evidence");
        }
        break;
      case "runtime-rebuild":
        if (
          claimLevel === "delivered" &&
          task.deliveryRequirements?.localReproductionRequested === true &&
          !artifactExistsInContext(task.__taskDir, "run/run-local.mjs", context)
        ) {
          findings.push("runtime-rebuild validator requires run/run-local.mjs for delivered local-reproduction claims");
        }
        break;
      default:
        break;
    }
  }
}

function evaluateTaskStateFreshness(task, findings) {
  const freshness = evaluateStateFreshness(task.__taskDir, task);
  findings.push(...freshness.findings);
}

function countHitSuccessCriteria(items) {
  if (!Array.isArray(items)) return 0;

  return items.filter((item) => {
    if (item && typeof item === "object") {
      if (item.hit === true) return true;
      const status = String(item.status || "").toLowerCase();
      return ["hit", "met", "passed", "done", "satisfied"].includes(status);
    }
    const text = String(item || "").trim();
    return /^\[x\]/i.test(text) || /(passed|met|hit|done|\u547d\u4e2d|\u8fbe\u6210|\u6ee1\u8db3)/i.test(text);
  }).length;
}

function validatePhaseArtifacts(task, findings, context = null) {
  const pureFiles = collectPureFiles(task.__taskDir);
  const phaseIndex = phaseOrder.indexOf(task.phase);
  const requiresLocalReproduction = taskRequiresLocalReproduction(task);

  if (
    requiresLocalReproduction &&
    phaseIndex >= phaseOrder.indexOf("Rebuild") &&
    !artifactTouchedInContext(task.__taskDir, "run/run-local.mjs", context)
  ) {
    findings.push(`phase=${task.phase} but run/run-local.mjs is still the template placeholder`);
  }

  evaluateTopicPhaseGuards(task, findings, context);

  if (requiresLocalReproduction && phaseIndex >= phaseOrder.indexOf("PureExtraction") && pureFiles.length === 0) {
    findings.push(`phase=${task.phase} but run/ has no pure-* artifact`);
  }
}

function collectValidationWarnings(task, reportText, routeState, warnings) {
  if (!usesCanonicalHeading(reportText, reportCurrentHeadingCanonical) && textMatchesAny(reportText, reportCurrentHeadingPatterns)) {
    warnings.push("report.md uses a non-canonical 当前阶段 heading; task-close will normalize it");
  }

  if (!usesCanonicalHeading(reportText, reportExecutionHeadingCanonical) && textMatchesAny(reportText, reportExecutionHeadingPatterns)) {
    warnings.push("report.md uses a non-canonical 自动续跑决策 heading; task-close will normalize it");
  }

  if (!usesCanonicalHeading(reportText, reportNextHeadingCanonical) && textMatchesAny(reportText, reportNextHeadingPatterns)) {
    warnings.push("report.md uses a non-canonical 下一步 heading; task-close will normalize it");
  }

  if (isVmBlackboxRoute(task, routeState) && !/黑盒复用边界/i.test(reportText)) {
    warnings.push("vm blackbox route should record a 黑盒复用边界 note in report.md");
  }

  collectArtifactHygieneFindings(task, warnings);
}

function evaluateDeliverablesForTask(task, options = {}) {
  const { templateMode = false, context = null } = options;
  const findings = [];

  for (const topic of topicValidationRules) {
    evaluateTopicFormalValidation(topic, task, findings, { templateMode, context });
  }

  return findings;
}

export function evaluateDeliverables(taskDir, options = {}) {
  const task = prepareTaskForValidation(taskDir);
  return evaluateDeliverablesForTask(task, options);
}

export function evaluateDeliverablesSnapshot(snapshot, options = {}) {
  const task = prepareTaskForValidation(snapshot.taskDir, snapshot.task);
  return evaluateDeliverablesForTask(task, {
    ...options,
    context: buildDeliverablesContext(task.__taskDir, snapshot)
  });
}

function evaluateRouteConsistencyForContext(taskDir, taskInput = null, snapshot = null) {
  const findings = [];
  const task = prepareTaskForValidation(taskDir, taskInput);
  const taskExecutionMirror = {
    status: task.routeState.executionStatus,
    nextEntrypointId: task.routeState.nextEntrypointId,
    nextExecutableAction: task.routeState.nextExecutableAction,
    pauseCategory: task.routeState.pauseCategory,
    pauseReason: task.routeState.pauseReason
  };
  const taskVmMirror = {
    triageResult: String(task.vm?.triageResult || "").trim(),
    blackboxApi: String(task.vm?.blackboxApi || "").trim()
  };
  const routeStatePath = taskFile(taskDir, task.routeState.statePath);
  const routePlanPath = taskFile(taskDir, task.routeState.planPath);
  const progressPath = taskFile(taskDir, task.routeState.progressPath);
  const cluesPath = taskFile(taskDir, task.routeState.cluesPath);

  for (const [label, filePath] of [
    ["route-state", routeStatePath],
    ["route-plan", routePlanPath],
    ["progress", progressPath],
    ["clues", cluesPath]
  ]) {
    if (!fs.existsSync(filePath)) {
      findings.push(`${label} file is missing: ${relFromRepo(filePath)}`);
    }
  }

  if (findings.length > 0) {
    return findings;
  }

  const routeState = snapshot?.routeState ? structuredClone(snapshot.routeState) : readRouteStateDocument(taskDir, task);
  if (!routeState) {
    findings.push(`route-state file is unreadable: ${relFromRepo(routeStatePath)}`);
    return findings;
  }
  applyRouteStateToTask(task, routeState);

  const routePlanText = readContextText(snapshot, "routePlanText", routePlanPath);
  const progressText = readContextText(snapshot, "progressText", progressPath);
  const cluesText = readContextText(snapshot, "cluesText", cluesPath);
  const expectedRoutePlan = renderRoutePlanMarkdown(routeState, task);
  const expectedProgress = renderProgressMarkdown(routeState);
  const routeTracks = routeState.tracks.map((track) => track.title);
  const entrypointIds = (routeState.entrypoints || []).map((entrypoint) => entrypoint.id);
  const progressRows = routeState.tracks.map((track) => ({
    track: track.title,
    status: track.status,
    checkpoints: (track.checkpoints || []).join(", "),
    nextStep: track.nextStep
  }));
  const progressTracks = progressRows.map((row) => row.track);
  const activeTracks = routeState.activeTracks || [];
  const activeEntrypoints = routeState.activeEntrypoints || [];
  const execution = routeState.execution || {};

  for (const track of activeTracks) {
    if (!routeTracks.some((candidate) => sameTrack(candidate, track))) {
      findings.push(`route-state activeTracks entry ${track} is missing from route-state.tracks`);
    }
    if (!progressTracks.some((candidate) => sameTrack(candidate, track))) {
      findings.push(`route-state activeTracks entry ${track} is missing from route-state progress rows`);
    }
  }

  const inFlight = progressRows
    .filter((row) => row.status === "IN_PROGRESS" || row.status === "BLOCKED")
    .map((row) => row.track);

  for (const track of inFlight) {
    if (!activeTracks.some((candidate) => sameTrack(candidate, track))) {
      findings.push(`route-state marks ${track} as IN_PROGRESS/BLOCKED but activeTracks does not include it`);
    }
  }

  for (const entrypointId of activeEntrypoints) {
    if (!entrypointIds.some((candidate) => sameEntrypointId(candidate, entrypointId))) {
      findings.push(`route-state activeEntrypoints entry ${entrypointId} is missing from route-state.entrypoints`);
    }
  }

  const activeEntrypointRecords = (routeState.entrypoints || []).filter(
    (entrypoint) => entrypoint.status === "PROBING" || entrypoint.status === "EXPANDED"
  );

  for (const entrypoint of activeEntrypointRecords) {
    if (!activeEntrypoints.some((candidate) => sameEntrypointId(candidate, entrypoint.id))) {
      findings.push(`route-state marks ${entrypoint.id} as PROBING/EXPANDED but activeEntrypoints does not include it`);
    }
  }

  if (activeEntrypoints.length > 2) {
    findings.push("route-state activeEntrypoints must not contain more than 2 active probes");
  }

  if (!String(execution.status || "").trim()) {
    findings.push("route-state.execution.status must be set");
  }

  if (taskExecutionMirror.status !== execution.status) {
    findings.push("task.json.routeState.executionStatus is out of sync with route-state.json");
  }

  if (taskExecutionMirror.nextEntrypointId !== execution.nextEntrypointId) {
    findings.push("task.json.routeState.nextEntrypointId is out of sync with route-state.json");
  }

  if (taskExecutionMirror.nextExecutableAction !== execution.nextExecutableAction) {
    findings.push("task.json.routeState.nextExecutableAction is out of sync with route-state.json");
  }

  if (taskExecutionMirror.pauseCategory !== execution.pauseCategory) {
    findings.push("task.json.routeState.pauseCategory is out of sync with route-state.json");
  }

  if (taskExecutionMirror.pauseReason !== execution.pauseReason) {
    findings.push("task.json.routeState.pauseReason is out of sync with route-state.json");
  }

  const routeVmTriageResult = String(routeState.vmTriage?.triageResult || "").trim();
  const routeVmBlackboxApi = String(routeState.vmTriage?.blackboxApi || "").trim();
  const shouldCheckVmMirror =
    Boolean(task.vm) ||
    routeVmTriageResult !== "not-applicable" ||
    Boolean(routeVmBlackboxApi);

  if (shouldCheckVmMirror && taskVmMirror.triageResult !== routeVmTriageResult) {
    findings.push("task.json vm.triageResult is out of sync with route-state.json.vmTriage.triageResult");
  }

  if (shouldCheckVmMirror && taskVmMirror.blackboxApi !== routeVmBlackboxApi) {
    findings.push("task.json vm.blackboxApi is out of sync with route-state.json.vmTriage.blackboxApi");
  }

  if (execution.autoAdvanceEligible === true && execution.status !== "ready-to-continue") {
    findings.push("route-state.execution.autoAdvanceEligible=true requires status=ready-to-continue");
  }

  if (execution.status === "ready-to-continue") {
    if (!String(execution.nextExecutableAction || "").trim()) {
      findings.push("route-state.execution.status=ready-to-continue but nextExecutableAction is empty");
    }
    if (!String(execution.nextEntrypointId || "").trim()) {
      findings.push("route-state.execution.status=ready-to-continue but nextEntrypointId is empty");
    }
    if (
      String(execution.nextEntrypointId || "").trim() &&
      !entrypointIds.some((candidate) => sameEntrypointId(candidate, execution.nextEntrypointId))
    ) {
      findings.push(`route-state.execution.nextEntrypointId ${execution.nextEntrypointId} is missing from route-state.entrypoints`);
    }
  }

  if (execution.status === "completed") {
    if (execution.autoAdvanceEligible === true) {
      findings.push("route-state.execution.status=completed must set autoAdvanceEligible=false");
    }
    if (String(execution.nextExecutableAction || "").trim()) {
      findings.push("route-state.execution.status=completed must not carry nextExecutableAction");
    }
    if (String(execution.nextEntrypointId || "").trim()) {
      findings.push("route-state.execution.status=completed must not carry nextEntrypointId");
    }
    if ((routeState.activeEntrypoints || []).length > 0) {
      findings.push("route-state.execution.status=completed must clear activeEntrypoints");
    }
  }

  if (execution.pauseCategory === "none" && String(execution.pauseReason || "").trim()) {
    findings.push("route-state.execution.pauseCategory=none should not carry a pauseReason");
  }

  if (execution.pauseCategory !== "none" && !String(execution.pauseReason || "").trim()) {
    findings.push("route-state.execution.pauseCategory!=none requires pauseReason");
  }

  if (execution.status === "blocked-on-user" && execution.pauseCategory !== "user") {
    findings.push("route-state.execution.status=blocked-on-user requires pauseCategory=user");
  }

  if (execution.status === "blocked-on-risk" && execution.pauseCategory !== "risk") {
    findings.push("route-state.execution.status=blocked-on-risk requires pauseCategory=risk");
  }

  if (routeState.syncStatus === "backfilled-from-markdown-lossy" && execution.status !== "needs-route-rebuild") {
    findings.push("lossy route-state must set execution.status=needs-route-rebuild");
  }

  if ((routeState.entrypoints || []).length > maxEntrypointsInWorkingSet) {
    findings.push(`route-state entrypoints must not contain more than ${maxEntrypointsInWorkingSet} working-set records; archive or prune exhausted entries`);
  }

  if ((routeState.retrospectives || []).length > maxRetrospectivesInWorkingSet) {
    findings.push(`route-state retrospectives must not contain more than ${maxRetrospectivesInWorkingSet} recent records`);
  }

  if (routeState.syncStatus === "backfilled-from-markdown-lossy") {
    findings.push("route-state was lossily backfilled from markdown; rebuild entrypoints/retrospectives before continuing");
  }

  if (
    ["Observe", "Capture", "Rebuild", "Patch"].includes(task.phase) &&
    (routeState.entrypoints || []).length === 0
  ) {
    findings.push(`phase=${task.phase} but route-state.json has no entrypoints`);
  }

  const allEntrypointsExhausted =
    (routeState.entrypoints || []).length > 0 &&
    (routeState.entrypoints || []).every((entrypoint) =>
      ["EXHAUSTED", "PARKED"].includes(String(entrypoint.status || ""))
    );

  if (allEntrypointsExhausted && (routeState.retrospectives || []).length === 0) {
    findings.push("all entrypoints are exhausted/parked but route-state.json has no retrospective");
  }

  for (const clue of routeState.clues || []) {
    if (
      clue.sourceEntrypoint &&
      !entrypointIds.some((candidate) => sameEntrypointId(candidate, clue.sourceEntrypoint))
    ) {
      findings.push(`clue ${clue.id} points to missing sourceEntrypoint ${clue.sourceEntrypoint}`);
    }
  }

  for (const retrospective of routeState.retrospectives || []) {
    for (const entrypointId of retrospective.newEntrypoints || []) {
      if (!entrypointIds.some((candidate) => sameEntrypointId(candidate, entrypointId))) {
        findings.push(`${retrospective.id} points to missing newEntrypoint ${entrypointId}`);
      }
    }
  }

  if (normalizeNewlines(routePlanText) !== normalizeNewlines(expectedRoutePlan)) {
    findings.push("route-plan.md is out of sync with route-state.json");
  }

  if (normalizeNewlines(progressText) !== normalizeNewlines(expectedProgress)) {
    findings.push("progress.md is out of sync with route-state.json");
  }

  // clues.md 已是线索唯一真源：不再要求它等于某个渲染结果，而是校验 route-state.clues
  // 缓存确实反映了 clues.md（新方向）。clues.md 里的每条线索都应出现在 route-state 缓存中。
  const cluesInStateCache = new Set(
    (routeState.clues || []).map((clue) => String(clue.content || "").trim()).filter(Boolean)
  );
  const cluesInMd = parseCluesMarkdown(cluesText)
    .map((clue) => String(clue.content || "").trim())
    .filter(Boolean);
  if (cluesInMd.some((content) => !cluesInStateCache.has(content))) {
    findings.push("route-state.json clues 缓存与 clues.md 不一致（clues.md 为真源，跑 task-sync 刷新缓存）");
  }

  const statusCounts = new Map();
  for (const row of progressRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) || 0) + 1);
  }

  if (task.phase === "Observe" && progressRows.length > 0 && (statusCounts.get("DONE") || 0) === progressRows.length) {
    findings.push("phase=Observe but progress.md says every track is DONE");
  }

  if ((task.phase === "Port" || task.phase === "Close") && (statusCounts.get("DONE") || 0) === 0) {
    findings.push(`phase=${task.phase} but progress.md has no DONE track`);
  }

  if (
    task.phase === "PureExtraction" &&
    (statusCounts.get("DONE") || 0) === 0 &&
    (statusCounts.get("IN_PROGRESS") || 0) === 0
  ) {
    findings.push("phase=PureExtraction but progress.md has no DONE or IN_PROGRESS track");
  }

  return findings;
}

export function evaluateRouteConsistency(taskDir) {
  return evaluateRouteConsistencyForContext(taskDir);
}

export function evaluateRouteConsistencySnapshot(snapshot) {
  return evaluateRouteConsistencyForContext(snapshot.taskDir, snapshot.task, snapshot);
}

export function runFormalValidation(taskDir) {
  const errors = [];
  const warnings = [];
  const taskJsonPath = taskFile(taskDir, "task.json");
  const reportPath = taskFile(taskDir, "report.md");
  const fixturesPath = taskFile(taskDir, "run/fixtures.json");

  if (!fs.existsSync(taskJsonPath)) {
    errors.push(`missing task.json: ${relFromRepo(taskJsonPath)}`);
  }
  if (!fs.existsSync(reportPath)) {
    errors.push(`missing report.md: ${relFromRepo(reportPath)}`);
  }
  if (!fs.existsSync(fixturesPath)) {
    errors.push(`missing fixtures.json: ${relFromRepo(fixturesPath)}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings, findings: errors };
  }

  const task = prepareTaskForValidation(taskDir);
  const deliverablesContext = buildDeliverablesContext(taskDir);
  collectRawTaskValidationFindings(task, errors);

  if (!phaseOrder.includes(task.phase)) {
    errors.push(`invalid task.phase: ${task.phase}`);
  }

  if (task.taskId === "replace-me" || path.basename(taskDir) === "_TEMPLATE") {
    errors.push("verify-once cannot pass on the template task or an uninitialized taskId");
  }

  const reportText = fs.readFileSync(reportPath, "utf8");
  if (!reportHasCurrentAndNext(reportText, task.phase)) {
    errors.push("report.md must contain current phase and next-step information");
  }
  if (!reportHasExecutionDecision(reportText)) {
    errors.push("report.md must contain an 自动续跑决策 / Continuation Decision section");
  }
  // [工具层减负] 报告语言（中文叙述）是展示约定，对交付物正确性零贡献，却会让 verify-once
  // 因报告含英文而 FAIL→逼模型反复重写报告（eval 实测的 7× 开销来源之一）。降级为 warning：
  // 仍提示，但不阻断完成。机制门禁（delivery-authenticity / placeholder-leakage 等）保持 error。
  const reportLanguageViolations = collectReportLanguageViolations(reportText);
  if (reportLanguageViolations.length > 0) {
    warnings.push(`report.md narrative 建议用中文；${reportLanguageViolations.join(" | ")}`);
  }
  validateTaskContractSnapshot(task, reportText, errors);
  validateChallengeAcceptance(task, errors);
  validateAcceptancePlugins(task, reportText, errors, deliverablesContext);
  evaluateDeliveryAuthenticity(task, errors, deliverablesContext);
  collectTemplatePlaceholderLeakage(task, errors, deliverablesContext);

  const routeState = readRouteStateDocument(taskDir, task);
  if (routeState) {
    validateExecutionControlTruth(task, routeState, reportText, errors);
  }
  if (routeState && taskLooksComposite(task, routeState)) {
    validateCompositeEntrypointReporting(reportText, routeState, warnings);
  }
  // 报告详实度四段门禁：deep 时硬门槛，否则软门槛；成品脚本存在时调用示例运行命令/预期输出硬门槛。
  validateReportDepthSections(task, reportText, taskDir, errors, warnings);

  try {
    JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
  } catch (error) {
    errors.push(`fixtures.json is not valid JSON: ${error.message}`);
  }

  errors.push(...evaluateDeliverablesForTask(task, { context: deliverablesContext }));
  errors.push(...evaluateRouteConsistencyForContext(taskDir, task));
  validatePhaseArtifacts(task, errors, deliverablesContext);
  evaluateTaskStateFreshness(task, errors);
  // 红线2：散落根目录的本任务产物 = error，强制搬进 task run/ 后才能视为合格交付。
  collectStrayWorkspaceArtifactFindings(task, errors);
  collectValidationWarnings(task, reportText, routeState, warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    findings: errors
  };
}

export function persistValidation(taskDir, result) {
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  task.validation.status = result.ok ? "passed" : "failed";
  task.validation.lastVerifiedAt = nowIso();
  task.validation.notes = result.ok
    ? ["formal one-shot validation passed", ...(result.warnings || []).slice(0, 4).map((item) => `warning: ${item}`)]
    : [
        ...(result.errors || result.findings || []).slice(0, 8),
        ...(result.warnings || []).slice(0, 4).map((item) => `warning: ${item}`)
      ];
  writeTaskJson(taskDir, task);
}

export function evaluateCloseoutGate(taskDir) {
  const errors = [];
  const warnings = [];
  const task = prepareTaskForValidation(taskDir);
  const deliverablesContext = buildDeliverablesContext(taskDir);
  collectRawTaskValidationFindings(task, errors);

  if (task.validation.status !== "passed") {
    errors.push("closeout requires validation.status=passed");
  }

  if (countHitSuccessCriteria(task.successCriteria) === 0) {
    errors.push("closeout requires at least one hit successCriteria entry");
  }

  if (String(task.acceptanceModel?.claimLevel || "").trim() !== "delivered") {
    errors.push("closeout requires acceptanceModel.claimLevel=delivered");
  }

  if (hasMeaningfulText(task.acceptanceModel?.acceptanceGap)) {
    errors.push("closeout requires acceptanceModel.acceptanceGap to be empty");
  }

  if (!hasMeaningfulText(task.acceptanceModel?.acceptancePath)) {
    errors.push("closeout requires acceptanceModel.acceptancePath");
  }

  if ((task.acceptanceModel?.completionBlockedBy || []).length > 0) {
    errors.push("closeout requires acceptanceModel.completionBlockedBy to be empty");
  }

  // 控制字段占位门禁（架P0#2 / 技D）：taskMode / primaryTopic 仍为 pending-* / 空时不得收尾，
  // 拦下「只跑 snapshot 不跑 close、报告控制字段停在 pending-* 仍发布」的空壳交付。
  const closeTaskMode = deriveTaskMode(task);
  if (isPlaceholderDeliveryControlValue(closeTaskMode)) {
    errors.push(`closeout requires a concrete taskMode (current=${closeTaskMode || "(empty)"}); 先在 executionModel.taskMode 选定主模式`);
  }
  const closeTopicFocus = deriveTopicFocus(task);
  if (isPlaceholderDeliveryControlValue(closeTopicFocus.primaryTopic)) {
    errors.push(`closeout requires a concrete primaryTopic (current=${closeTopicFocus.primaryTopic || "(empty)"}); 先在 executionModel.primaryTopic 选定主专题`);
  }

  if (task.envConformance?.present && task.firstDivergence?.status === "not-recorded") {
    errors.push("env task cannot close out without firstDivergence");
  }

  if (task.vm?.present && !isVmBlackboxRoute(task) && String(task.vm.opcodeCoverage || "0%") === "0%") {
    errors.push("vm task cannot close out with opcodeCoverage=0% unless vm.triageResult=blackbox");
  }

  if (task.vm?.present && isVmBlackboxRoute(task) && !String(task.vm.blackboxApi || "").trim()) {
    warnings.push("vm blackbox route should record vm.blackboxApi before closeout");
  }

  evaluateDeliveryAuthenticity(task, errors, deliverablesContext);
  collectTemplatePlaceholderLeakage(task, errors, deliverablesContext);
  validateChallengeAcceptance(task, errors);
  validateAcceptancePlugins(task, readTaskFileIfExists(taskDir, "report.md"), errors, deliverablesContext);
  evaluateTaskStateFreshness(task, errors);
  collectArtifactHygieneFindings(task, errors, { strict: true });
  // 红线2：收尾时同样硬拦 workspace 根目录散落产物。
  collectStrayWorkspaceArtifactFindings(task, errors);

  // [工具层减负] 线索真源已是 state/clues.md；candidate-insights.json 退为可选次级缓冲。
  // 不再因它仍是模板占位就阻断 closeout（那是冗余仪式），仅在解析损坏时告警。
  if (
    Array.isArray(task.taskPacks?.selectedTopics) &&
    task.taskPacks.selectedTopics.length > 0 &&
    fs.existsSync(taskFile(taskDir, "state/candidate-insights.json"))
  ) {
    try {
      JSON.parse(fs.readFileSync(taskFile(taskDir, "state/candidate-insights.json"), "utf8"));
    } catch (error) {
      warnings.push(`state/candidate-insights.json 解析失败（可选缓冲，不阻断）：${error.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    findings: errors
  };
}
