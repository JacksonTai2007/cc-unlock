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
import { evaluateVerificationEvidence } from "./verification.mjs";

const progressStatuses = new Set(["PENDING", "IN_PROGRESS", "BLOCKED", "DONE"]);
const reportCurrentHeadingPatterns = [/^##\s*(?:当前阶段|当前进度|当前状态)\s*[：:]?\s*$/gim];
const reportCurrentHeadingCanonical = /^##\s*当前阶段\s*$/gim;
const reportNextHeadingPatterns = [/^##\s*(?:下一步|后续动作|next step)\s*[：:]?\s*$/gim];
const reportNextHeadingCanonical = /^##\s*下一步\s*$/gim;
const reportExecutionHeadingPatterns = [/^##\s*(?:自动续跑决策|续跑决策|Continuation Decision)\s*[：:]?\s*$/gim];
const reportExecutionHeadingCanonical = /^##\s*自动续跑决策\s*$/gim;
const reportExecutionStatus = /(?:^|\n)-\s*(?:执行状态|execution status)\s*[：:]/i;
const reportNextExecutableAction = /(?:^|\n)-\s*(?:下一可执行动作|下一动作|next executable action|next action)\s*[：:]/i;
const reportPauseCategory = /(?:^|\n)-\s*(?:暂停类别|pause category)\s*[：:]/i;
const reportPauseReason = /(?:^|\n)-\s*(?:暂停原因|pause reason)\s*[：:]/i;
const reportLocalReproHeading = /##\s+(本地复现交付|Local Reproduction Deliverables)/i;
const reportLocalAlgoEntry = /-[ \t]*(本地算法实现|local algorithm)[ \t]*[：:][ \t]*\S[^\r\n]*/i;
const reportLocalExampleEntry = /-[ \t]*(调用示例|local repro example)[ \t]*[：:][ \t]*\S[^\r\n]*/i;
const reportApiExampleEntry = /-[ \t]*(API 调用示例|api call example)[ \t]*[：:][ \t]*\S[^\r\n]*/i;
const reportRunCommandEntry = /-[ \t]*(运行命令|run command)[ \t]*[：:][ \t]*\S[^\r\n]*/i;
const reportOutputSummaryEntry =
  /-[ \t]*(输出[ \t]*\/[ \t]*响应摘要|输出摘要|响应摘要|打印展示|response summary|printed response)[ \t]*[：:][ \t]*\S[^\r\n]*/i;
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
    (task?.deliverables || []).length > 1 ||
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

function evidenceFilePath(evidenceRef) {
  return String(evidenceRef || "")
    .split("#")[0]
    .replace(/:\d+(?::\d+)?$/, "")
    .trim();
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
    task.deliveryRequirements?.apiCallExampleRequired === true ||
    String(task.deliverableTier || "").toUpperCase() === "T5" ||
    (task.deliverables || []).some((item) => item?.required !== false && String(item?.tier || "").toUpperCase() === "T5")
  );
}

function taskRequiresApiCallExample(task) {
  return task.deliveryRequirements?.apiCallExampleRequired === true;
}

function validateLocalReproductionDelivery(task, reportText, findings, warnings) {
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
  if (taskRequiresApiCallExample(task) && !reportApiExampleEntry.test(reportText)) {
    findings.push("API local reproduction tasks must record a non-empty API call example path");
  }

  const hasTypedSpec = artifactExists(task.__taskDir, "run/verification.spec.json");
  if (Number(task.schemaVersion || 1) >= 2 || hasTypedSpec) {
    const verification = evaluateVerificationEvidence(task.__taskDir, task);
    findings.push(...verification.errors);
    warnings.push(...verification.warnings);
  } else {
    warnings.push("legacy local reproduction evidence is syntax-only; task-close requires a fresh typed verification result");
    for (const relPath of ["run/local-repro-example.js", "run/api-call-example.js"]) {
      if (artifactExists(task.__taskDir, relPath) && artifactTouched(task.__taskDir, relPath)) {
        validateExecutableExample(task, relPath, relPath, findings);
      }
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
      ANDROID_REVERSE_SKILL_ROOT: task.roots?.skillRoot || process.env.ANDROID_REVERSE_SKILL_ROOT || "",
      ANDROID_REVERSE_WORKSPACE_ROOT: task.roots?.workspaceRoot || process.env.ANDROID_REVERSE_WORKSPACE_ROOT || ""
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

const fridaHookPatterns = [
  /\bJava\.use\b/,
  /\bInterceptor\.(attach|replace)\b/,
  /\bModule\.(findExportByName|findBaseAddress)\b/,
  /\bNativeFunction\b/,
  /\.implementation\s*=\s*function\b/
];

function isLikelyFridaScript(name) {
  if (!name.endsWith(".js")) return false;
  const stem = path.basename(name, ".js");
  return /(?:bypass|hook|template|trace|intercept|dump|frida|class-loader)\b/i.test(stem);
}

function validateArtifactSyntax(taskDir, findings) {
  const runDir = taskFile(taskDir, "run");
  if (!fs.existsSync(runDir)) return;

  for (const entry of fs.readdirSync(runDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const filePath = path.join(runDir, name);
    const relPath = `run/${name}`;

    if (name.endsWith(".js") && artifactTouched(taskDir, relPath)) {
      const result = spawnSync(process.execPath, ["--check", filePath], {
        encoding: "utf8",
        timeout: 10000
      });
      if (result.status !== 0) {
        const detail = String(result.stderr || "").trim().split("\n").slice(0, 3).join("; ");
        findings.push(`run/${name} has JavaScript syntax errors: ${detail}`);
      }
    }

    if (name.endsWith(".py") && artifactTouched(taskDir, relPath)) {
      const code = fs.readFileSync(filePath, "utf8");
      const pyResult = spawnSync("python", ["-c", "import ast,sys;ast.parse(sys.stdin.read())"], {
        input: code,
        encoding: "utf8",
        timeout: 10000
      });
      if (pyResult.error && pyResult.error.code === "ENOENT") {
        continue;
      }
      if (pyResult.status !== 0) {
        const detail = String(pyResult.stderr || "").trim().split("\n").slice(0, 3).join("; ");
        findings.push(`run/${name} has Python syntax errors: ${detail}`);
      }
    }
  }
}

function validateArtifactContentDepth(taskDir, findings) {
  const runDir = taskFile(taskDir, "run");
  if (!fs.existsSync(runDir)) return;

  for (const entry of fs.readdirSync(runDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const relPath = `run/${name}`;
    if (!artifactTouched(taskDir, relPath)) continue;

    const content = fs.readFileSync(path.join(runDir, name), "utf8");

    if (isLikelyFridaScript(name)) {
      const hasHookApi = fridaHookPatterns.some((p) => p.test(content));
      if (!hasHookApi) {
        findings.push(
          `run/${name} looks like a Frida script but contains no hook-setting API calls ` +
          `(expected Java.use, Interceptor.attach, Module.findExportByName, or .implementation=)`
        );
      }
    }

    if (name.endsWith(".py") && /^(solver|pure)/i.test(name)) {
      const codeLines = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && !l.startsWith('"""') && !l.startsWith("'''"))
        .length;
      if (codeLines < 5) {
        findings.push(`run/${name} has fewer than 5 substantive code lines; expected solver logic`);
      }
    }
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

function countHitSuccessCriteria(items, schemaVersion = 1) {
  if (!Array.isArray(items)) return 0;

  return items.filter((item) => {
    if (item && typeof item === "object") {
      if (schemaVersion < 2 && item.hit === true) return true;
      const status = String(item.status || "").toLowerCase();
      return schemaVersion >= 2
        ? status === "met"
        : ["hit", "met", "passed", "done", "satisfied"].includes(status);
    }
    const text = String(item || "").trim();
    return /^\[x\](?:\s|$)/i.test(text);
  }).length;
}

function completionCriteriaForTask(task) {
  return Array.isArray(task.completionCriteria) && task.completionCriteria.length > 0
    ? task.completionCriteria
    : task.successCriteria;
}

function taskHasTier(task, tier) {
  return String(task?.deliverableTier || "").toUpperCase() === tier ||
    (task?.deliverables || []).some((item) => item?.required !== false && String(item?.tier || "").toUpperCase() === tier);
}

function validatePatchCloseout(task, errors) {
  if (!taskHasTier(task, "T3")) return;

  const baseline = task.patchBaseline || {};
  const baselineReady = String(baseline.status || "").toLowerCase() === "passed" &&
    baseline.signatureVerified === true &&
    baseline.installed === true &&
    baseline.launched === true &&
    Array.isArray(baseline.evidenceRefs) && baseline.evidenceRefs.length > 0 &&
    /^[a-f0-9]{64}$/i.test(String(baseline.sourceArtifactSha256 || "")) &&
    /^[a-f0-9]{64}$/i.test(String(baseline.resignedArtifactSha256 || ""));
  if (!baselineReady) {
    errors.push("T3 closeout requires a passed no-op re-sign baseline with source/resigned hashes, signature, install, launch, and evidence");
  }
  for (const evidenceRef of baseline.evidenceRefs || []) {
    const relPath = evidenceFilePath(evidenceRef);
    if (!relPath || !artifactExists(task.__taskDir, relPath)) {
      errors.push(`T3 baseline evidence does not exist: ${evidenceRef || "<empty>"}`);
    }
  }
  if (baseline.usedUninstall === true && baseline.userApprovedDataReset !== true) {
    errors.push("T3 baseline used adb uninstall without recorded user approval for data reset");
  }

  const matrix = Array.isArray(task.patchRegressionMatrix) ? task.patchRegressionMatrix : [];
  const baseIds = new Set(["cold-start", "core-path", "signature-integrity"]);
  const objectiveSpecificIds = new Set();
  if (/(去广告|广告|all\s+ads)/i.test(String(task.objective || ""))) {
    for (const id of ["onboarding", "home", "query-results", "login-sso", "deep-navigation", "resume"]) {
      objectiveSpecificIds.add(id);
    }
  }
  for (const id of new Set([...baseIds, ...objectiveSpecificIds])) {
    const item = matrix.find((entry) => String(entry?.id || "") === id);
    const status = String(item?.status || "").toLowerCase();
    const hasEvidence = Array.isArray(item?.evidenceRefs) && item.evidenceRefs.length > 0;
    const isPassed = status === "passed";
    const isSupportedNotApplicable = objectiveSpecificIds.has(id) &&
      status === "not-applicable" &&
      String(item?.rationale || "").trim().length > 0;
    if (!item || (!isPassed && !isSupportedNotApplicable) || !hasEvidence) {
      const expectation = objectiveSpecificIds.has(id)
        ? "passed evidence, or not-applicable with rationale and evidence"
        : "passed evidence";
      errors.push(`T3 regression matrix requires ${expectation} for ${id}`);
      continue;
    }
    for (const evidenceRef of item.evidenceRefs) {
      const relPath = evidenceFilePath(evidenceRef);
      if (!relPath || !artifactExists(task.__taskDir, relPath)) {
        errors.push(`T3 regression evidence for ${id} does not exist: ${evidenceRef || "<empty>"}`);
      }
    }
  }
}

function validatePhaseArtifacts(task, findings) {
  const phaseIndex = phaseOrder.indexOf(task.phase);

  if (phaseIndex >= phaseOrder.indexOf("Rebuild") && !artifactTouched(task.__taskDir, "run/run-local.mjs")) {
    findings.push(`phase=${task.phase} but run/run-local.mjs is still the template placeholder`);
  }

  evaluateTopicPhaseGuards(task, findings);

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
}

function validateUserConfirmationClaims(task, reportText, findings) {
  const claimLines = String(reportText || "")
    .split(/\r?\n/)
    .filter((line) => /(?:用户.{0,12}(?:已确认|确认通过|验证通过|实测成功)|user.{0,12}confirmed)/i.test(line))
    .filter((line) => !/(?:未|尚未|等待|待用户|需要用户|请求用户).{0,12}(?:确认|验证)/i.test(line));
  if (claimLines.length === 0) return;

  const acceptance = task.userAcceptance || {};
  if (String(acceptance.status || "").toLowerCase() !== "confirmed" ||
      !Array.isArray(acceptance.evidenceRefs) || acceptance.evidenceRefs.length === 0) {
    findings.push("report.md claims user confirmation without task.userAcceptance.status=confirmed and evidenceRefs");
    return;
  }
  for (const evidenceRef of acceptance.evidenceRefs) {
    const relPath = evidenceFilePath(evidenceRef);
    if (!relPath || !artifactExists(task.__taskDir, relPath)) {
      findings.push(`user acceptance evidence does not exist: ${evidenceRef || "<empty>"}`);
    }
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

  const ac = routeState.attemptCounters;
  if (ac && ac.totalAttempts >= 50) {
    findings.push(`attempt-ledger total attempts (${ac.totalAttempts}) >= 50; final report should be triggered`);
  }
  if (ac && ac.totalAttempts >= 30 && ac.successCount < 3) {
    findings.push(`attempt-ledger success rate too low (${ac.successCount}/${ac.totalAttempts}); forced retrospective recommended`);
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
    validateLocalReproductionDelivery(task, reportText, errors, warnings);
  }
  validateUserConfirmationClaims(task, reportText, errors);

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
  validateArtifactSyntax(taskDir, errors);
  validateArtifactContentDepth(taskDir, errors);
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
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));

  if (task.validation.status !== "passed") {
    errors.push("closeout requires validation.status=passed");
  }

  const pendingDeliverables = (task.deliverables || [])
    .filter((item) => item?.required !== false && String(item?.status || "").toLowerCase() !== "delivered")
    .map((item) => item.id || "<unnamed>");
  if (pendingDeliverables.length > 0) {
    errors.push(`closeout requires every required deliverable to be delivered: ${pendingDeliverables.join(", ")}`);
  }

  const completionCriteria = completionCriteriaForTask(task);
  const hitCompletionCriteria = countHitSuccessCriteria(completionCriteria, Number(task.schemaVersion || 1));
  if (completionCriteria.length === 0) {
    errors.push("closeout requires non-empty completionCriteria");
  } else if (hitCompletionCriteria < completionCriteria.length) {
    errors.push(`closeout requires every completionCriteria entry to be hit (${hitCompletionCriteria}/${completionCriteria.length})`);
  }
  if (Number(task.schemaVersion || 1) >= 2) {
    for (const item of completionCriteria) {
      if (!item || typeof item !== "object") {
        errors.push("schema v2 completionCriteria entries must be structured objects");
        continue;
      }
      if (String(item.status || "").toLowerCase() === "met") {
        if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length === 0) {
          errors.push(`completion criterion ${item.id || item.label || "<unnamed>"} is met without evidenceRefs`);
          continue;
        }
        for (const evidenceRef of item.evidenceRefs) {
          const relPath = evidenceFilePath(evidenceRef);
          if (!relPath || !artifactExists(taskDir, relPath)) {
            errors.push(`completion criterion ${item.id || item.label || "<unnamed>"} evidence does not exist: ${evidenceRef || "<empty>"}`);
          }
        }
      }
    }
  }


  if (taskRequiresLocalReproduction(task)) {
    const verification = evaluateVerificationEvidence(taskDir, task);
    errors.push(...verification.errors.map((item) => `closeout verification: ${item}`));
    warnings.push(...verification.warnings);
  }
  validatePatchCloseout(task, errors);

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
