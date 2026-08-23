import fs from "node:fs";
import path from "node:path";
import {
  buildTaskFromTemplates,
  copyCoreTaskScaffold,
  copyDirRecursive,
  ensureTaskRuntimeShape,
  ensureTaskDeliveryArtifacts,
  inferLocalReproFromSemantics,
  inferReportDepthDeepFromSemantics,
  localizeTaskStateArtifacts,
  getTopicPackDir,
  getTopicBySpecifier,
  getTopicExtensionFile,
  inferProtectionTier,
  listWorkspaceHistoryFiles,
  readJsonFile,
  relFromRepo,
  resolveReadablePath,
  resolveTaskDir,
  writeTaskJson
} from "./common.mjs";
import {
  defaultRouteStateDocument,
  resolveExecutionState,
  syncMarkdownViews,
  writeRouteStateDocument
} from "./route-state.mjs";

// 归一化用户给出的浏览器 MCP 标识：去掉 `mcp__` 前缀与尾随的 `__*` 工具段，
// 统一别名，得到稳定的 server 短名（如 stealth-browser / js-reverse / chrome-devtools）。
// 无法识别的也原样保留（trim 后），不丢失用户意图。
export function normalizeBrowserMcp(raw) {
  let value = String(raw || "").trim();
  if (!value) {
    return "";
  }
  value = value.replace(/^mcp__/i, "").replace(/__.*$/, "");
  value = value.toLowerCase().replace(/_/g, "-");
  const aliases = new Map([
    ["stealth-browser-mcp", "stealth-browser"],
    ["stealth-browser", "stealth-browser"],
    ["stealth", "stealth-browser"],
    ["js-reverse", "js-reverse"],
    ["jsreverse", "js-reverse"],
    ["chrome-devtools", "chrome-devtools"],
    ["chrome-devtools-mcp", "chrome-devtools"],
    ["devtools", "chrome-devtools"]
  ]);
  return aliases.get(value) || value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskId = args.find((item) => !item.startsWith("--"));
  if (!taskId) {
    console.error("usage: node tools/task/task-init.mjs <task-id> [--force-new-task] [--protection-tier=T4] [--topic=jsvmp] [--topics=jsvmp,wasm] [--task-input=path.json] [--browser-mcp=stealth-browser] [--local-repro] [--api-call-example] [--<topic-or-alias> ...]");
    process.exit(1);
  }

  const protectionArg = args.find((item) => item.startsWith("--protection-tier="));
  const browserMcpArg = args.find((item) => item.startsWith("--browser-mcp="));
  const taskInputArg = args.find((item) => item.startsWith("--task-input="));
  const forceNewTask = args.includes("--force-new-task");
  const explicitTopicKeys = [];
  const unknownFlags = [];
  const unknownTopicSpecifiers = [];
  let localReproductionRequested = false;
  let apiCallExampleRequired = false;

  for (const item of args.filter((value) => value.startsWith("--") && !value.startsWith("--protection-tier="))) {
    if (item.startsWith("--task-input=")) {
      continue;
    }
    if (item.startsWith("--browser-mcp=")) {
      continue;
    }
    if (item === "--force-new-task") {
      continue;
    }
    if (item.startsWith("--topic=") || item.startsWith("--topics=")) {
      const raw = item.split("=")[1] || "";
      const tokens = raw.split(",").map((value) => value.trim()).filter(Boolean);
      if (tokens.length === 0) {
        unknownTopicSpecifiers.push(item);
        continue;
      }
      for (const token of tokens) {
        const topic = getTopicBySpecifier(token);
        if (!topic) {
          unknownTopicSpecifiers.push(token);
          continue;
        }
        explicitTopicKeys.push(topic.key);
      }
      continue;
    }

    if (item === "--local-repro") {
      localReproductionRequested = true;
      continue;
    }

    if (item === "--api-call-example") {
      localReproductionRequested = true;
      apiCallExampleRequired = true;
      continue;
    }

    const topic = getTopicBySpecifier(item);
    if (topic) {
      explicitTopicKeys.push(topic.key);
      continue;
    }

    unknownFlags.push(item);
  }

  if (unknownFlags.length > 0) {
    console.error(`unknown task-init flag(s): ${unknownFlags.join(", ")}`);
    process.exit(1);
  }

  if (unknownTopicSpecifiers.length > 0) {
    const unresolved = Array.from(new Set(unknownTopicSpecifiers));
    console.error(`task-init: unknown topic specifier(s): ${unresolved.join(", ")}`);
    console.error("task-init: use topic key / alias from topics/*, e.g. --topic=signature or --topics=signature,session.");
    process.exit(1);
  }

  const selectedTopics = Array.from(
    new Set(
      explicitTopicKeys
        .map((value) => getTopicBySpecifier(value))
        .filter(Boolean)
        .map((topic) => topic.key)
    )
  );

  const extensionFiles = Array.from(
    new Set([
      ...selectedTopics
        .map((key) => getTopicBySpecifier(key))
        .filter(Boolean)
        .map((topic) => getTopicExtensionFile(topic))
        .filter(Boolean)
    ])
  );

  let taskInput = null;
  if (taskInputArg) {
    const taskInputPath = taskInputArg.split("=")[1] || "";
    if (!taskInputPath.trim()) {
      console.error("task-init: --task-input requires a JSON path");
      process.exit(1);
    }
    const { resolvedPath, tried } = resolveReadablePath(taskInputPath);
    try {
      taskInput = readJsonFile(resolvedPath);
    } catch (error) {
      const triedHint = tried.length > 0
        ? ` (tried: ${tried.map((value) => `'${value}'`).join(", ")})`
        : "";
      console.error(`task-init: failed to read task input: ${error.message}${triedHint}`);
      process.exit(1);
    }
    localReproductionRequested ||= taskInput?.requirements?.localReproductionRequested === true;
    apiCallExampleRequired ||= taskInput?.requirements?.apiCallExampleRequired === true;
    if (apiCallExampleRequired) {
      localReproductionRequested = true;
    }
  }

  // CLI flag 优先；其次 task-input 的 browserMcp / toolPolicy.browserMcp。
  const browserMcp = normalizeBrowserMcp(
    (browserMcpArg ? browserMcpArg.split("=").slice(1).join("=") : "") ||
      taskInput?.browserMcp ||
      taskInput?.toolPolicy?.browserMcp
  );
  const browserMcpSource = browserMcpArg
    ? "cli"
    : taskInput?.browserMcp || taskInput?.toolPolicy?.browserMcp
      ? "task-input"
      : "";

  return {
    taskId,
    protectionTier: protectionArg?.split("=")[1] || inferProtectionTier(selectedTopics),
    extensionFiles,
    selectedTopics,
    taskInput,
    localReproductionRequested,
    apiCallExampleRequired,
    browserMcp,
    browserMcpSource,
    forceNewTask
  };
}

function copySelectedTopicPacks(taskDir, selectedTopics) {
  for (const topic of selectedTopics
    .map((topicKey) => getTopicBySpecifier(topicKey))
    .filter(Boolean)) {
    const packDir = getTopicPackDir(topic);
    if (!packDir || !fs.existsSync(packDir)) {
      continue;
    }
    copyDirRecursive(packDir, taskDir, {
      skip: new Set(["extension.json"])
    });
  }
}

function main() {
  const {
    taskId,
    protectionTier,
    extensionFiles,
    selectedTopics,
    taskInput,
    localReproductionRequested,
    apiCallExampleRequired,
    browserMcp,
    browserMcpSource,
    forceNewTask
  } = parseArgs(process.argv);
  const effectiveWorkspaceRoot = process.env.WEB_REVERSE_WORKSPACE_ROOT
    ? path.resolve(process.env.WEB_REVERSE_WORKSPACE_ROOT)
    : process.cwd();
  const taskDir = resolveTaskDir(taskId, { workspaceRoot: effectiveWorkspaceRoot });
  const historyFiles = listWorkspaceHistoryFiles(effectiveWorkspaceRoot);

  if (fs.existsSync(taskDir)) {
    console.error(`task directory already exists: ${relFromRepo(taskDir)}`);
    process.exit(1);
  }

  if (historyFiles.length > 0 && !forceNewTask) {
    console.error("task-init: history data files already exist in this workspace, so creating another task-local is blocked by default.");
    console.error("task-init: resume with task-sync/task-advance, or re-run with --force-new-task if you intentionally want another task id in the same workspace.");
    process.exit(1);
  }

  copyCoreTaskScaffold(taskDir);
  copySelectedTopicPacks(taskDir, selectedTopics);

  const task = ensureTaskRuntimeShape(
    buildTaskFromTemplates({
      taskId,
      protectionTier,
      extensionFiles
    })
  );
  task.routeState.syncStatus = "initialized";
  task.validation.status = "not-started";
  task.validation.lastVerifiedAt = "";
  task.validation.notes = [];
  task.taskPacks.mode = selectedTopics.length > 0 ? "selected-topic-packs" : "core-only";
  task.taskPacks.explicitTopics = selectedTopics.slice();
  task.taskPacks.explicitExtensions = extensionFiles.slice();
  task.taskPacks.selectedTopics = selectedTopics;
  task.taskPacks.selectedExtensions = extensionFiles;
  task.taskPacks.activatedTopics = [];
  task.taskPacks.activatedExtensions = [];
  task.deliveryRequirements.localReproductionRequested = localReproductionRequested;
  task.deliveryRequirements.apiCallExampleRequired = apiCallExampleRequired;
  if (browserMcp) {
    task.browserSession.pinnedMcp = browserMcp;
    task.browserSession.pinnedMcpSource = browserMcpSource || "explicit";
    task.browserSession.pinnedMcpLockedAt = new Date().toISOString();
  }
  if (taskInput?.objective) {
    task.targetContext.objective = String(taskInput.objective);
  }
  if (taskInput?.targetActionDescription) {
    task.targetContext.targetActionDescription = String(taskInput.targetActionDescription);
  }
  if (Array.isArray(taskInput?.targetUrlPatterns)) {
    task.targetContext.targetUrlPatterns = taskInput.targetUrlPatterns
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(taskInput?.targetKeywords)) {
    task.targetContext.targetKeywords = taskInput.targetKeywords
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(taskInput?.targetFunctionNames)) {
    task.targetContext.targetFunctionNames = taskInput.targetFunctionNames
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (taskInput?.targetTimeWindow) {
    task.targetContext.targetTimeWindow = String(taskInput.targetTimeWindow);
  }
  if (Array.isArray(taskInput?.targetBundleHints)) {
    task.targetContext.targetBundleHints = taskInput.targetBundleHints
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(taskInput?.protectionHints)) {
    task.targetContext.protectionHints = taskInput.protectionHints
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(taskInput?.loginRequirements)) {
    task.targetContext.loginRequirements = taskInput.loginRequirements
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (taskInput?.requirements?.timeoutPolicy) {
    task.targetContext.timeoutPolicy = String(taskInput.requirements.timeoutPolicy);
  }
  if (taskInput?.requirements?.retryPolicy) {
    task.targetContext.retryPolicy = String(taskInput.requirements.retryPolicy);
  }
  if (Array.isArray(taskInput?.successCriteria)) {
    task.successCriteria = taskInput.successCriteria
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (taskInput?.contract && typeof taskInput.contract === "object") {
    if (taskInput.contract.objective) {
      task.taskContract.objective = String(taskInput.contract.objective).trim();
    }
    if (Array.isArray(taskInput.contract.nonNegotiables)) {
      task.taskContract.nonNegotiables = taskInput.contract.nonNegotiables
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    if (taskInput.contract.deliverableTier) {
      task.taskContract.deliverableTier = String(taskInput.contract.deliverableTier).trim();
    }
    if (Array.isArray(taskInput.contract.completionCriteria)) {
      task.taskContract.completionCriteria = taskInput.contract.completionCriteria
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    if (Array.isArray(taskInput.contract.disallowedFallbacks)) {
      task.taskContract.disallowedFallbacks = taskInput.contract.disallowedFallbacks
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    if (Array.isArray(taskInput.contract.intermediateStatesNotDelivery)) {
      task.taskContract.intermediateStatesNotDelivery = taskInput.contract.intermediateStatesNotDelivery
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    if (taskInput.contract.status) {
      task.taskContract.status = String(taskInput.contract.status).trim();
    }
  }
  if (taskInput?.acceptance && typeof taskInput.acceptance === "object") {
    if (taskInput.acceptance.claimLevel) {
      task.acceptanceModel.claimLevel = String(taskInput.acceptance.claimLevel).trim();
    }
    if (taskInput.acceptance.acceptanceGap) {
      task.acceptanceModel.acceptanceGap = String(taskInput.acceptance.acceptanceGap).trim();
    }
    if (taskInput.acceptance.nextEvidenceGate) {
      task.acceptanceModel.nextEvidenceGate = String(taskInput.acceptance.nextEvidenceGate).trim();
    }
    if (taskInput.acceptance.acceptancePath) {
      task.acceptanceModel.acceptancePath = String(taskInput.acceptance.acceptancePath).trim();
    }
    if (Array.isArray(taskInput.acceptance.validators)) {
      task.acceptanceModel.validators = taskInput.acceptance.validators
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    if (Array.isArray(taskInput.acceptance.userRejectedApproaches)) {
      task.acceptanceModel.userRejectedApproaches = taskInput.acceptance.userRejectedApproaches
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
  }
  if (taskInput?.executionModel && typeof taskInput.executionModel === "object") {
    task.executionModel.controlSources ||= {};
    if (taskInput.executionModel.currentState) {
      task.executionModel.currentState = String(taskInput.executionModel.currentState).trim();
      task.executionModel.controlSources.currentState = "explicit";
    }
    if (taskInput.executionModel.taskMode) {
      task.executionModel.taskMode = String(taskInput.executionModel.taskMode).trim();
      task.executionModel.controlSources.taskMode = "explicit";
    }
    if (taskInput.executionModel.fallbackMode) {
      task.executionModel.fallbackMode = String(taskInput.executionModel.fallbackMode).trim();
      task.executionModel.controlSources.fallbackMode = "explicit";
    }
    if (taskInput.executionModel.primaryTopic) {
      task.executionModel.primaryTopic = String(taskInput.executionModel.primaryTopic).trim();
      task.executionModel.controlSources.primaryTopic = "explicit";
    }
    if (Array.isArray(taskInput.executionModel.secondaryTopics)) {
      task.executionModel.secondaryTopics = taskInput.executionModel.secondaryTopics
        .map((item) => String(item || "").trim())
        .filter(Boolean);
      task.executionModel.controlSources.secondaryTopics = "explicit";
    }
    if (taskInput.executionModel.primaryEntrypoint) {
      task.executionModel.primaryEntrypoint = String(taskInput.executionModel.primaryEntrypoint).trim();
      task.executionModel.controlSources.primaryEntrypoint = "explicit";
    }
    if (taskInput.executionModel.microRoute) {
      task.executionModel.microRoute = String(taskInput.executionModel.microRoute).trim();
      task.executionModel.controlSources.microRoute = "explicit";
    }
    if (taskInput.executionModel.experimentClass) {
      task.executionModel.experimentClass = String(taskInput.executionModel.experimentClass).trim();
      task.executionModel.controlSources.experimentClass = "explicit";
    }
    if (taskInput.executionModel.highValueEvidenceGoal) {
      task.executionModel.highValueEvidenceGoal = String(taskInput.executionModel.highValueEvidenceGoal).trim();
    }
    if (taskInput.executionModel.nextUpgradeGate) {
      task.executionModel.nextUpgradeGate = String(taskInput.executionModel.nextUpgradeGate).trim();
    }
    if (taskInput.executionModel.stopLossCondition) {
      task.executionModel.stopLossCondition = String(taskInput.executionModel.stopLossCondition).trim();
    }
    if (typeof taskInput.executionModel.roundBudget === "number") {
      task.executionModel.roundBudget = taskInput.executionModel.roundBudget;
      task.executionModel.controlSources.roundBudget = "explicit";
    }
    if (typeof taskInput.executionModel.roundsConsumed === "number") {
      task.executionModel.roundsConsumed = taskInput.executionModel.roundsConsumed;
      task.executionModel.controlSources.roundsConsumed = "explicit";
    }
    if (taskInput.executionModel.deepDivePermit && typeof taskInput.executionModel.deepDivePermit === "object") {
      task.executionModel.deepDivePermit ||= {};
      if (typeof taskInput.executionModel.deepDivePermit.active === "boolean") {
        task.executionModel.deepDivePermit.active = taskInput.executionModel.deepDivePermit.active;
        task.executionModel.controlSources["deepDivePermit.active"] = "explicit";
      }
      for (const key of ["subgoal", "milestone", "exitCondition", "expectedHighValueEvidence", "currentMicroRoute", "permitReason", "reviewedAt"]) {
        if (taskInput.executionModel.deepDivePermit[key]) {
          task.executionModel.deepDivePermit[key] = String(taskInput.executionModel.deepDivePermit[key]).trim();
        }
      }
      if (typeof taskInput.executionModel.deepDivePermit.maxRounds === "number") {
        task.executionModel.deepDivePermit.maxRounds = taskInput.executionModel.deepDivePermit.maxRounds;
        task.executionModel.controlSources["deepDivePermit.maxRounds"] = "explicit";
      }
    }
  }
  if (Array.isArray(taskInput?.requirements?.deliverables)) {
    task.targetContext.requestedDeliverables = taskInput.requirements.deliverables
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (taskInput?.target?.value) {
    task.targetContext.inputTarget = String(taskInput.target.value);
  }
  if (taskInput?.boundaries && typeof taskInput.boundaries === "object") {
    if (typeof taskInput.boundaries.activeTriggerAllowed === "boolean") {
      task.boundaries.activeTriggerAllowed = taskInput.boundaries.activeTriggerAllowed;
    }
    if (typeof taskInput.boundaries.breakpointAllowed === "boolean") {
      task.boundaries.breakpointAllowed = taskInput.boundaries.breakpointAllowed;
    }
    if (Array.isArray(taskInput.boundaries.forbiddenActions)) {
      task.boundaries.forbiddenActions = taskInput.boundaries.forbiddenActions
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    if (taskInput.boundaries.rateLimit) {
      task.boundaries.rateLimit = String(taskInput.boundaries.rateLimit);
    }
  }
  if (!task.taskContract.objective && task.targetContext.objective) {
    task.taskContract.objective = String(task.targetContext.objective).trim();
  }
  if ((task.taskContract.completionCriteria || []).length === 0 && Array.isArray(task.successCriteria)) {
    task.taskContract.completionCriteria = task.successCriteria
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  task.taskContract.status = task.taskContract.objective ? "ready" : task.taskContract.status;
  // NL 意图兜底（保留上面 flag/task-input/apiUrl 触发路径不变，只加兜底，不降级已显式置位的值）：
  // 此处 objective/title/targetActionDescription 均已落定，可基于关键词推断 reportDepth=deep / localReproductionRequested。
  if (task.deliveryRequirements.reportDepth !== "deep" && inferReportDepthDeepFromSemantics(task)) {
    task.deliveryRequirements.reportDepth = "deep";
    console.log("task-init: inferred deliveryRequirements.reportDepth=deep from objective/title keywords");
  }
  if (task.deliveryRequirements.localReproductionRequested !== true && inferLocalReproFromSemantics(task)) {
    task.deliveryRequirements.localReproductionRequested = true;
    console.log("task-init: inferred deliveryRequirements.localReproductionRequested=true from objective/title keywords");
  }
  ensureTaskDeliveryArtifacts(taskDir, task);
  localizeTaskStateArtifacts(taskDir, task);
  // P1-T2：写入 createdAt 以提供稳定的 boot 基线时间，不被 task-sync 刷新。
  // getTaskBootBaselineMs 优先读取此字段，避免续跑 sync 后基线偏晚导致漏报散落产物。
  task.createdAt = new Date().toISOString();
  writeTaskJson(taskDir, task);
  const routeState = defaultRouteStateDocument(task);
  routeState.syncStatus = "initialized";
  routeState.execution = resolveExecutionState(task, routeState);
  const persistedRouteState = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, persistedRouteState);

  console.log(`task-init: created ${relFromRepo(taskDir)}`);
  console.log(`task-init: protectionTier=${protectionTier}`);
  console.log(`task-init: executionStatus=${persistedRouteState.execution.status}`);
  console.log(`task-init: nextAction=${persistedRouteState.execution.nextExecutableAction}`);
  if (extensionFiles.length > 0) {
    console.log(`task-init: extensions=${extensionFiles.join(",")}`);
  }
  if (selectedTopics.length > 0) {
    console.log(`task-init: topics=${selectedTopics.join(",")}`);
  }
  if (localReproductionRequested) {
    console.log("task-init: deliveryRequirements.localReproductionRequested=true");
  }
  if (apiCallExampleRequired) {
    console.log("task-init: deliveryRequirements.apiCallExampleRequired=true");
  }
  if (browserMcp) {
    console.log(`task-init: browserSession.pinnedMcp=${browserMcp} (source=${browserMcpSource || "explicit"}; 锁定后不得静默漂移到其它浏览器 MCP)`);
  }
}

main();
