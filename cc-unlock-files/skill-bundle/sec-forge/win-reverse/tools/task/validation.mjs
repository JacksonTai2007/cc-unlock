import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readTopicRegistry } from "../topic-registry.mjs";
import {
  ensureTaskRuntimeShape,
  fileExistsInTask,
  normalizeNewlines,
  nowIso,
  phaseOrder,
  readTaskJson,
  relFromRepo,
  taskFile,
  templateTaskDir,
  writeTaskJson
} from "./common.mjs";
import {
  applyRouteStateToTask,
  artifactTouchedAgainstTemplate,
  parseProgress,
  parseRoutePlan,
  renderCluesMarkdown,
  renderProgressMarkdown,
  renderRoutePlanMarkdown,
  readRouteStateDocument
} from "./route-state.mjs";

const progressStatuses = new Set(["PENDING", "IN_PROGRESS", "BLOCKED", "DONE"]);
const reportCurrentHeadingPatterns = [/^##\s*(?:当前阶段|当前进度|当前状态)\s*[：:]?\s*$/gim];
const reportCurrentHeadingCanonical = /^##\s*当前阶段\s*$/gim;
const reportNextHeadingPatterns = [/^##\s*(?:下一步|后续动作|next step)\s*[：:]?\s*$/gim];
const reportNextHeadingCanonical = /^##\s*下一步\s*$/gim;
const reportExecutionHeadingPatterns = [/^##\s*(?:自动续跑决策|续跑决策|Continuation Decision)\s*[：:]?\s*$/gim];
const reportExecutionHeadingCanonical = /^##\s*自动续跑决策\s*$/gim;
const reportRuntimeTemplateHeadingPatterns = [
  /^##\s*(?:Runtime 专用后续动作模板摘要|Web 套壳技术路线摘要|Runtime Template Summary)\s*[：:]?\s*$/gim
];
const reportRuntimeTemplateHeadingCanonical = /^##\s*Runtime 专用后续动作模板摘要\s*$/gim;
const reportExecutionStatus = /(?:^|\n)-\s*(?:执行状态|execution status)\s*[：:]/i;
const reportNextExecutableAction = /(?:^|\n)-\s*(?:下一可执行动作|下一动作|next executable action|next action)\s*[：:]/i;
const reportPauseCategory = /(?:^|\n)-\s*(?:暂停类别|pause category)\s*[：:]/i;
const reportPauseReason = /(?:^|\n)-\s*(?:暂停原因|pause reason)\s*[：:]/i;
const reportLocalReproHeading = /##\s+(本地复现交付|Local Reproduction Deliverables)/i;
const reportLocalAlgoEntry = /-\s*(本地算法实现|local algorithm)\s*[：:]\s*\S+/i;
const reportLocalExampleEntry = /-\s*(调用示例|local repro example)\s*[：:]\s*\S+/i;
const reportApiExampleEntry = /-\s*(协议重放示例|API 调用示例|protocol replay example|api call example)\s*[：:]\s*\S+/i;
const reportRunCommandEntry = /-\s*(运行命令|run command)\s*[：:]\s*\S+/i;
const reportOutputSummaryEntry =
  /-\s*(输出\s*\/\s*响应摘要|输出摘要|响应摘要|打印展示|response summary|printed response)\s*[：:]\s*\S+/i;
const reportEntrypointHeading = /##\s+(切入点循环|Entrypoint Loop)/i;
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

export function artifactExists(taskDir, relPath) {
  return fileExistsInTask(taskDir, relPath);
}

export function artifactTouched(taskDir, relPath) {
  return artifactTouchedAgainstTemplate(taskDir, relPath);
}

export function touchedAny(taskDir, relPaths) {
  return relPaths.some((relPath) => artifactTouched(taskDir, relPath));
}

function getValueByPath(target, valuePath) {
  return String(valuePath || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), target);
}

function evaluateCondition(task, taskDir, condition) {
  if (!condition) return false;

  if (Array.isArray(condition.touchedAny)) {
    return touchedAny(taskDir, condition.touchedAny);
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

function evaluateTopicFormalValidation(topic, task, findings, options = {}) {
  const { templateMode = false } = options;
  const rule = topic.formalValidation;
  if (!rule || !topicIsPresent(task, rule)) {
    return;
  }

  if (topic.key === "jsvmp" && isVmBlackboxRoute(task)) {
    return;
  }

  for (const relPath of rule.requiredArtifacts || []) {
    if (!artifactExists(task.__taskDir, relPath)) {
      findings.push(`${rule.presentPath}=true but ${relPath} is missing`);
    }
  }

  if (templateMode) {
    return;
  }

  for (const requirement of rule.requirementsAll || []) {
    if (!evaluateCondition(task, task.__taskDir, requirement)) {
      findings.push(formatValidationMessage(requirement.message, task));
    }
  }

  for (const group of rule.requirementsAny || []) {
    const passed = (group.checks || []).some((condition) =>
      evaluateCondition(task, task.__taskDir, condition)
    );
    if (!passed) {
      findings.push(formatValidationMessage(group.message, task));
    }
  }
}

function evaluateTopicPhaseGuards(task, findings) {
  const phaseIndex = phaseOrder.indexOf(task.phase);
  if (phaseIndex < 0) {
    return;
  }

  for (const topic of topicValidationRules) {
    const rule = topic.formalValidation;
    if (!topicIsPresent(task, rule)) {
      continue;
    }

    for (const guard of rule.phaseGuards || []) {
      const minPhaseIndex = phaseOrder.indexOf(guard.minPhase);
      if (minPhaseIndex < 0 || phaseIndex < minPhaseIndex) {
        continue;
      }

      for (const requirement of guard.requirementsAll || []) {
        if (!evaluateCondition(task, task.__taskDir, requirement)) {
          findings.push(formatValidationMessage(requirement.message, task));
        }
      }

      for (const group of guard.requirementsAny || []) {
        const passed = (group.checks || []).some((condition) =>
          evaluateCondition(task, task.__taskDir, condition)
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
    task.deliveryRequirements?.protocolReplayExampleRequired === true ||
    task.deliveryRequirements?.apiCallExampleRequired === true
  );
}

function taskRequiresApiCallExample(task) {
  return (
    task.deliveryRequirements?.protocolReplayExampleRequired === true ||
    task.deliveryRequirements?.apiCallExampleRequired === true
  );
}

function validateLocalReproductionDelivery(task, reportText, findings) {
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
  if (!artifactExists(task.__taskDir, "run/local-repro-example.js")) {
    findings.push("local reproduction tasks require run/local-repro-example.js");
  } else if (!artifactTouched(task.__taskDir, "run/local-repro-example.js")) {
    findings.push("run/local-repro-example.js is still the template placeholder");
  } else {
    validateExecutableExample(task, "run/local-repro-example.js", "local reproduction example", findings);
  }

  if (taskRequiresApiCallExample(task)) {
    if (!reportApiExampleEntry.test(reportText)) {
      findings.push("protocol replay tasks must record a non-empty protocol replay example path");
    }
    if (!artifactExists(task.__taskDir, "run/protocol-replay-example.js")) {
      findings.push("protocol replay tasks require run/protocol-replay-example.js");
    } else if (!artifactTouched(task.__taskDir, "run/protocol-replay-example.js")) {
      findings.push("run/protocol-replay-example.js is still the template placeholder");
    } else {
      validateExecutableExample(task, "run/protocol-replay-example.js", "protocol replay example", findings);
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
      WIN_REVERSE_SKILL_ROOT: task.roots?.skillRoot || process.env.WIN_REVERSE_SKILL_ROOT || "",
      WIN_REVERSE_WORKSPACE_ROOT: task.roots?.workspaceRoot || process.env.WIN_REVERSE_WORKSPACE_ROOT || ""
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

function collectPureFiles(taskDir) {
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

function validatePhaseArtifacts(task, findings) {
  const pureFiles = collectPureFiles(task.__taskDir);
  const phaseIndex = phaseOrder.indexOf(task.phase);

  if (phaseIndex >= phaseOrder.indexOf("Rebuild") && !artifactTouched(task.__taskDir, "run/run-local.mjs")) {
    findings.push(`phase=${task.phase} but run/run-local.mjs is still the template placeholder`);
  }

  evaluateTopicPhaseGuards(task, findings);

  if (phaseIndex >= phaseOrder.indexOf("PureExtraction") && pureFiles.length === 0) {
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

  const webShellReportExpected =
    task.webShellTriage?.present === true ||
    (task.taskPacks?.selectedTopics || []).includes("web-shell-triage");
  if (webShellReportExpected && !textMatchesAny(reportText, reportRuntimeTemplateHeadingPatterns)) {
    warnings.push("web-shell-triage task should record a Runtime 专用后续动作模板摘要 section in report.md");
  }
  if (
    webShellReportExpected &&
    textMatchesAny(reportText, reportRuntimeTemplateHeadingPatterns) &&
    !usesCanonicalHeading(reportText, reportRuntimeTemplateHeadingCanonical)
  ) {
    warnings.push("report.md uses a non-canonical Runtime 专用后续动作模板摘要 heading; task-sync/task-close will normalize it");
  }

  if (isVmBlackboxRoute(task, routeState) && !/黑盒复用边界/i.test(reportText)) {
    warnings.push("vm blackbox route should record a 黑盒复用边界 note in report.md");
  }
}

export function evaluateDeliverables(taskDir, options = {}) {
  const { templateMode = false } = options;
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  task.__taskDir = taskDir;
  const findings = [];

  for (const topic of topicValidationRules) {
    evaluateTopicFormalValidation(topic, task, findings, { templateMode });
  }

  return findings;
}

export function evaluateRouteConsistency(taskDir) {
  const findings = [];
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
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

  const routeState = readRouteStateDocument(taskDir, task);
  if (!routeState) {
    findings.push(`route-state file is unreadable: ${relFromRepo(routeStatePath)}`);
    return findings;
  }
  applyRouteStateToTask(task, routeState);

  const routePlanText = fs.readFileSync(routePlanPath, "utf8");
  const progressText = fs.readFileSync(progressPath, "utf8");
  const cluesText = fs.readFileSync(cluesPath, "utf8");
  const expectedRoutePlan = renderRoutePlanMarkdown(routeState, task);
  const expectedProgress = renderProgressMarkdown(routeState);
  const expectedClues = renderCluesMarkdown(routeState);
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

  if (normalizeNewlines(cluesText) !== normalizeNewlines(expectedClues)) {
    findings.push("clues.md is out of sync with route-state.json");
  }

  const statusCounts = new Map();
  for (const row of progressRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) || 0) + 1);
  }

  if (task.phase === "Observe" && progressRows.length > 0 && (statusCounts.get("DONE") || 0) === progressRows.length) {
    findings.push("phase=Observe but progress.md says every track is DONE");
  }

  if (task.phase === "Port" && (statusCounts.get("DONE") || 0) === 0) {
    findings.push("phase=Port but progress.md has no DONE track");
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

const pureAlgorithmForbiddenPatterns = [
  { pattern: /child_process/, label: "child_process (exec/spawn)" },
  { pattern: /regedit|registry|Winreg|REGISTRY/, label: "registry operation" },
  { pattern: /Program\s+Files/i, label: "target install path write" }
];

function validateDeliverableTierConsistency(task, errors) {
  const tier = String(task.deliverableTier || "").trim();
  if (tier !== "pure-algorithm") {
    return;
  }

  const pureFiles = collectPureFiles(task.__taskDir);
  for (const relPath of pureFiles) {
    const fullPath = taskFile(task.__taskDir, relPath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    for (const { pattern, label } of pureAlgorithmForbiddenPatterns) {
      if (pattern.test(content)) {
        errors.push(`deliverableTier=pure-algorithm but ${relPath} contains forbidden pattern: ${label}`);
      }
    }
  }
}

function validateBackupManifest(task, errors) {
  const phaseIndex = phaseOrder.indexOf(task.phase);
  const tier = String(task.deliverableTier || "").trim();
  const needsBackup = phaseIndex >= phaseOrder.indexOf("Patch") || tier === "patch";
  if (!needsBackup) {
    return;
  }

  const manifestPath = taskFile(task.__taskDir, "run/backup-manifest.md");
  if (!fs.existsSync(manifestPath)) {
    errors.push("phase>=Patch or deliverableTier=patch but run/backup-manifest.md is missing");
  } else {
    const content = fs.readFileSync(manifestPath, "utf8");
    if (!/[0-9a-fA-F]{64}/.test(content)) {
      errors.push("run/backup-manifest.md exists but contains no SHA256 hash entries");
    }
  }
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

  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  task.__taskDir = taskDir;

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
  const reportLanguageViolations = collectReportLanguageViolations(reportText);
  if (reportLanguageViolations.length > 0) {
    errors.push(`report.md narrative must be written in Chinese; ${reportLanguageViolations.join(" | ")}`);
  }
  if (taskRequiresLocalReproduction(task)) {
    validateLocalReproductionDelivery(task, reportText, errors);
  }

  const routeState = readRouteStateDocument(taskDir, task);
  if (routeState && taskLooksComposite(task, routeState)) {
    validateCompositeEntrypointReporting(reportText, routeState, warnings);
  }

  try {
    JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
  } catch (error) {
    errors.push(`fixtures.json is not valid JSON: ${error.message}`);
  }

  errors.push(...evaluateDeliverables(taskDir));
  errors.push(...evaluateRouteConsistency(taskDir));
  validatePhaseArtifacts(task, errors);
  collectValidationWarnings(task, reportText, routeState, warnings);
  validateDeliverableTierConsistency(task, errors);
  validateBackupManifest(task, errors);

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
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));

  if (task.validation.status !== "passed") {
    errors.push("closeout requires validation.status=passed");
  }

  if (countHitSuccessCriteria(task.successCriteria) === 0) {
    errors.push("closeout requires at least one hit successCriteria entry");
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

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    findings: errors
  };
}
