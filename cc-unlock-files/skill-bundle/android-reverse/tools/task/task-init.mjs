import fs from "node:fs";
import {
  buildTaskFromTemplates,
  copyCoreTaskScaffold,
  copyDirRecursive,
  ensureTaskRuntimeShape,
  ensureTaskDeliveryArtifacts,
  getTopicPackDir,
  getTopicBySpecifier,
  getTopicExtensionFile,
  listWorkspaceHistoryFiles,
  readJsonFile,
  relFromRepo,
  resolveTaskDir,
  writeTaskJson
} from "./common.mjs";
import {
  defaultRouteStateDocument,
  resolveExecutionState,
  syncMarkdownViews,
  writeRouteStateDocument
} from "./route-state.mjs";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  );
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return uniqStrings(value);
  }
  if (value == null) {
    return [];
  }
  const text = cleanText(value);
  if (!text) {
    return [];
  }
  return uniqStrings(text.split(/[,\n，；;]/));
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function readBoolean(...values) {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

function normalizeDeliverableTier(value) {
  const text = cleanText(value).toUpperCase();
  return /^T[1-5]$/.test(text) ? text : "";
}

function inferDeliverableTierFromText(...values) {
  const text = values.map((value) => cleanText(value)).filter(Boolean).join("\n").toLowerCase();
  if (!text) {
    return "T1";
  }
  if (/(纯算法|python|node|独立实现|不依赖\s*android|port|复现.*签名|实现.*签名)/i.test(text)) {
    return "T5";
  }
  if (/(协议|接口|签名逻辑|算法流程|密钥|参数来源|还原.*签名)/i.test(text)) {
    return "T4";
  }
  if (/(patch|smali|重打包|重签名|安装验证|修改.*apk|改包)/i.test(text)) {
    return "T3";
  }
  if (/(hook|frida|脚本|抓参数|动态抓取)/i.test(text)) {
    return "T2";
  }
  return "T1";
}

function inferDeliverableTiersFromText(...values) {
  const text = values.map((value) => cleanText(value)).filter(Boolean).join("\n").toLowerCase();
  const tiers = new Set();
  if (/(patch|smali|重打包|重签名|安装验证|修改.*apk|改包|去广告)/i.test(text)) tiers.add("T3");
  if (/(纯算法|python|node|独立实现|不依赖\s*android|port|复现.*签名|实现.*签名)/i.test(text)) tiers.add("T5");
  if (/(协议|接口|签名逻辑|算法流程|密钥|参数来源|还原.*签名)/i.test(text)) tiers.add("T4");
  if (/(hook|frida|脚本|抓参数|动态抓取)/i.test(text)) tiers.add("T2");
  return tiers.size > 0
    ? Array.from(tiers).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))
    : ["T1"];
}

function normalizeCriteriaInput(primaryValues, legacyValues) {
  const primary = Array.isArray(primaryValues) ? primaryValues : [];
  const legacy = Array.isArray(legacyValues) ? legacyValues : [];
  const source = primary.length > 0 ? primary : legacy;
  return source
    .map((item, index) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const label = cleanText(item.label || item.title || item.text);
        return label
          ? {
              ...item,
              id: cleanText(item.id) || `criterion-${index + 1}`,
              label,
              status: cleanText(item.status) || "pending",
              evidenceRefs: toStringArray(item.evidenceRefs)
            }
          : null;
      }
      const label = cleanText(item);
      return label
        ? { id: `criterion-${index + 1}`, label, status: "pending", evidenceRefs: [] }
        : null;
    })
    .filter(Boolean);
}

function normalizeInputDeliverables(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => {
      const tier = normalizeDeliverableTier(item.tier || item.deliverableTier) || "T1";
      return {
        id: cleanText(item.id) || `${tier.toLowerCase()}-${index + 1}`,
        tier,
        criteriaIds: toStringArray(item.criteriaIds),
        status: cleanText(item.status) || "in-progress",
        required: item.required !== false
      };
    });
}

function inferRuntimeFlavor(taskInput) {
  const frameworkHints = [
    ...toStringArray(taskInput?.frameworkHints),
    cleanText(taskInput?.runtimeFlavor)
  ].map((item) => item.toLowerCase());

  if (frameworkHints.some((item) => item.includes("flutter"))) {
    return "flutter";
  }
  if (frameworkHints.some((item) => item.includes("hermes") || item.includes("react native"))) {
    return "hermes";
  }
  if (frameworkHints.some((item) => item.includes("unity") || item.includes("il2cpp"))) {
    return "unity";
  }
  return "unknown";
}

function hasMtTool(values) {
  return values.some((value) => /mt[-_\s]?(mcp|apk)|mt管理器|mt manager/i.test(cleanText(value)));
}

function inferTopicsFromTaskInput(taskInput) {
  const inferred = new Set();
  if (!taskInput) {
    return [];
  }

  const objective = cleanText(taskInput.objective).toLowerCase();
  const targetType = cleanText(taskInput.targetType).toLowerCase();
  const frameworkHints = toStringArray(taskInput.frameworkHints).map((item) => item.toLowerCase());
  const networkHints = toStringArray(taskInput.networkHints).map((item) => item.toLowerCase());
  const protectionHints = toStringArray(taskInput.protectionHints).map((item) => item.toLowerCase());
  const processHints = toStringArray(taskInput.processHints).map((item) => item.toLowerCase());
  const entryHints = toStringArray(taskInput.entryHints).map((item) => item.toLowerCase());
  const combinedHints = [
    objective,
    targetType,
    ...frameworkHints,
    ...networkHints,
    ...protectionHints,
    ...processHints,
    ...entryHints
  ].filter(Boolean);
  const hasHint = (needle) => combinedHints.some((item) => item.includes(needle));

  inferred.add("static-triage");

  if (["apks", "aab", "xapk"].includes(targetType) || hasHint("split")) {
    inferred.add("split-delivery");
  }
  if (frameworkHints.some((item) => ["flutter", "hermes", "unity"].some((needle) => item.includes(needle)))) {
    inferred.add("framework-runtime");
  }
  if (networkHints.some((item) => ["cronet", "boringssl", "native tls", "quic"].some((needle) => item.includes(needle)))) {
    inferred.add("native-network");
  }
  if (protectionHints.some((item) => ["certificatepinner", "pinning", "rootbeer", "integrity", "safetynet", "frida", "ptrace"].some((needle) => item.includes(needle)))) {
    inferred.add("protection-bypass");
  }
  if (protectionHints.some((item) => item.includes("jni")) || hasHint("registernatives") || hasHint("jni")) {
    inferred.add("jni-bridge");
  }
  if (targetType === "so" || hasHint("elf") || hasHint("libcrypto") || hasHint("native")) {
    inferred.add("native-so");
  }
  if (processHints.some((item) => ["isolated process", "child process", "multiprocess", "spawn", "oat", "vdex", "inline"].some((needle) => item.includes(needle)))) {
    inferred.add("art-runtime");
  }
  if (hasHint("dexclassloader") || hasHint("dynamic dex") || hasHint("shell") || hasHint("dump")) {
    inferred.add("dex-loader");
  }
  if (hasHint("webview") || hasHint("addjavascriptinterface") || hasHint("evaluatejavascript") || hasHint("hybrid")) {
    inferred.add("webview-hybrid");
  }
  if (hasHint("contentprovider") || hasHint("sharedpreferences") || hasHint("binder") || hasHint("sqlite") || hasHint("mmkv")) {
    inferred.add("storage-ipc");
  }
  if (hasHint("smali") || hasHint("rebuild") || hasHint("resign")) {
    inferred.add("smali-patching");
  }
  if (hasHint("signature") || hasHint("hmac") || hasHint("aes") || hasHint("protobuf") || hasHint("token")) {
    inferred.add("crypto-protocol");
  }
  if (hasHint("hook") || hasHint("frida") || hasHint("interceptor")) {
    inferred.add("runtime-hooking");
  }
  if (hasHint("retrofit") || hasHint("okhttp") || hasHint("repository api")) {
    inferred.add("java-api");
  }
  if (hasHint("viewmodel") || hasHint("repository") || hasHint("onclick") || hasHint("observer") || hasHint("call flow")) {
    inferred.add("call-flow");
  }
  if (hasHint("emulator") || hasHint("debugger") || hasHint("isdebuggerconnected")) {
    inferred.add("anti-emulator-debug");
  }
  if (hasHint("ctf") || hasHint("flag") || hasHint("crackme")) {
    inferred.add("ctf");
  }

  return Array.from(inferred)
    .map((value) => getTopicBySpecifier(value))
    .filter(Boolean)
    .map((topic) => topic.key);
}

function normalizeTaskInput(taskInput) {
  if (!taskInput) {
    return null;
  }

  const targetObject = asObject(taskInput.target) || {};
  const requirementsObject = asObject(taskInput.requirements) || {};
  const boundariesObject = asObject(taskInput.boundaries) || {};
  const toolchainObject = asObject(taskInput.toolchain) || {};
  const targetValue = cleanText(
    typeof taskInput.target === "string"
      ? taskInput.target
      : targetObject.value || targetObject.path || targetObject.file || taskInput.targetPath
  );
  const packageName = cleanText(taskInput.packageName || targetObject.packageName);
  const targetParts = uniqStrings([
    ...toStringArray(taskInput.targetParts),
    ...toStringArray(targetObject.parts)
  ]);
  const protectionHints = uniqStrings([
    ...toStringArray(taskInput.protectionHints),
    ...toStringArray(targetObject.protectionHints)
  ]);
  const frameworkHints = uniqStrings([
    ...toStringArray(taskInput.frameworkHints),
    ...toStringArray(targetObject.frameworkHints)
  ]);
  const networkHints = uniqStrings([
    ...toStringArray(taskInput.networkHints),
    ...toStringArray(targetObject.networkHints)
  ]);
  const processHints = uniqStrings([
    ...toStringArray(taskInput.processHints),
    ...toStringArray(targetObject.processHints)
  ]);
  const entryHints = uniqStrings([
    ...toStringArray(taskInput.entryHints),
    ...toStringArray(targetObject.entryHints)
  ]);
  const requestedDeliverables = uniqStrings([
    ...toStringArray(requirementsObject.deliverables),
    ...toStringArray(Array.isArray(taskInput.deliverables)
      ? taskInput.deliverables.filter((item) => typeof item === "string")
      : taskInput.deliverables)
  ]);
  const localReproductionRequested = readBoolean(
    requirementsObject.localReproductionRequested,
    taskInput.localReproductionRequested
  );
  const apiCallExampleRequired = readBoolean(
    requirementsObject.apiCallExampleRequired,
    taskInput.apiCallExampleRequired
  );
  const explicitDeliverableTier = normalizeDeliverableTier(
    taskInput.deliverableTier ||
    requirementsObject.deliverableTier ||
    requirementsObject.level
  );
  const explicitDeliverables = normalizeInputDeliverables(taskInput.deliverables);
  const inferredDeliverableTiers = explicitDeliverableTier
    ? [explicitDeliverableTier]
    : inferDeliverableTiersFromText(taskInput.objective, requirementsObject.summary, requestedDeliverables.join(" "));
  const completionCriteria = normalizeCriteriaInput(
    [
      ...(Array.isArray(taskInput.completionCriteria) ? taskInput.completionCriteria : []),
      ...(Array.isArray(requirementsObject.completionCriteria) ? requirementsObject.completionCriteria : [])
    ],
    [
      ...(Array.isArray(taskInput.successCriteria) ? taskInput.successCriteria : []),
      ...(Array.isArray(requirementsObject.successCriteria) ? requirementsObject.successCriteria : [])
    ]
  );
  const deliverables = explicitDeliverables.length > 0
    ? explicitDeliverables
    : inferredDeliverableTiers.map((tier, index) => ({
        id: inferredDeliverableTiers.length === 1 ? "primary" : `${tier.toLowerCase()}-${index + 1}`,
        tier,
        criteriaIds: [],
        status: "in-progress",
        required: true
      }));
  const deliverableTier = deliverables[0]?.tier || inferDeliverableTierFromText(taskInput.objective);
  const protectionTierText = cleanText(taskInput.protectionTier).toUpperCase();
  const protectionTier = /^A(?:[0-7]|2\+)$/.test(protectionTierText) ? protectionTierText : null;
  const declaredMcpTools = uniqStrings([
    ...toStringArray(taskInput.declaredTools),
    ...toStringArray(taskInput.mcpTools),
    ...toStringArray(taskInput.toolHints),
    ...toStringArray(toolchainObject.declaredMcpTools)
  ]);
  const preferredTools = uniqStrings([
    ...toStringArray(taskInput.preferredTools),
    ...toStringArray(toolchainObject.preferredTools)
  ]);
  if (hasMtTool([...declaredMcpTools, ...preferredTools])) {
    if (!declaredMcpTools.includes("mt-mcp")) {
      declaredMcpTools.push("mt-mcp");
    }
    if (!preferredTools.includes("mt-mcp")) {
      preferredTools.push("mt-mcp");
    }
  }

  return {
    raw: taskInput,
    targetValue,
    targetType: cleanText(taskInput.targetType || targetObject.type),
    targetParts,
    objective: cleanText(taskInput.objective),
    requirementsSummary: cleanText(
      typeof taskInput.requirements === "string"
        ? taskInput.requirements
        : requirementsObject.summary || requirementsObject.level || ""
    ),
    boundariesSummary: cleanText(
      typeof taskInput.boundaries === "string"
        ? taskInput.boundaries
        : boundariesObject.summary || boundariesObject.notes || ""
    ),
    packageName,
    abi: cleanText(taskInput.abi || targetObject.abi),
    androidVersion: cleanText(taskInput.androidVersion || targetObject.androidVersion),
    deviceMode: cleanText(taskInput.deviceMode || requirementsObject.deviceMode || "none"),
    attachMode: cleanText(taskInput.attachMode || requirementsObject.attachMode || "unknown"),
    protectionHints,
    frameworkHints,
    networkHints,
    processHints,
    entryHints,
    completionCriteria,
    deliverables,
    requestedDeliverables,
    deliverableTier,
    protectionTier,
    disallowedFallbacks: uniqStrings([
      ...toStringArray(taskInput.disallowedFallbacks),
      ...toStringArray(requirementsObject.disallowedFallbacks)
    ]),
    userRejectedApproaches: uniqStrings([
      ...toStringArray(taskInput.userRejectedApproaches),
      ...toStringArray(requirementsObject.userRejectedApproaches)
    ]),
    declaredMcpTools,
    preferredTools,
    localReproductionRequested,
    apiCallExampleRequired,
    activeTriggerAllowed: readBoolean(
      boundariesObject.activeTriggerAllowed,
      taskInput.activeTriggerAllowed,
      requirementsObject.activeTriggerAllowed,
      taskInput.dynamicAllowed
    ),
    forbiddenActions: uniqStrings([
      ...toStringArray(boundariesObject.forbiddenActions),
      ...toStringArray(taskInput.forbiddenActions)
    ]),
    patchingAllowed: readBoolean(
      taskInput.patchingAllowed,
      requirementsObject.patchingAllowed,
      boundariesObject.patchingAllowed
    )
  };
}

function applyTaskInputToTask(task, normalizedTaskInput) {
  if (!normalizedTaskInput) {
    return;
  }

  const {
    targetValue,
    targetType,
    targetParts,
    objective,
    requirementsSummary,
    boundariesSummary,
    packageName,
    abi,
    androidVersion,
    deviceMode,
    attachMode,
    protectionHints,
    frameworkHints,
    networkHints,
    processHints,
    entryHints,
    completionCriteria,
    deliverables,
    requestedDeliverables,
    deliverableTier,
    protectionTier,
    disallowedFallbacks,
    userRejectedApproaches,
    declaredMcpTools,
    preferredTools,
    activeTriggerAllowed,
    forbiddenActions,
    patchingAllowed
  } = normalizedTaskInput;

  task.target ||= {};
  task.runtime ||= {};
  task.executionContext ||= {};
  task.targetContext ||= {};
  task.boundaries ||= {};

  task.runtime.packaging = targetType || task.runtime.packaging || "unknown";
  task.runtime.runtimeFlavor = inferRuntimeFlavor(normalizedTaskInput.raw);
  task.target.path = targetValue || task.target.path || "";
  task.target.type = targetType || task.target.type || "";
  task.target.parts = targetParts.slice();
  task.target.packageName = packageName || task.target.packageName || "";
  task.target.abi = abi || task.target.abi || "";
  task.target.androidVersion = androidVersion || task.target.androidVersion || "";
  task.executionContext.attachMode = attachMode || task.executionContext.attachMode || "unknown";
  task.executionContext.deviceReady = deviceMode && deviceMode !== "none";
  task.executionContext.sessionReusable = task.executionContext.deviceReady;
  task.executionContext.deviceMode = deviceMode || task.executionContext.deviceMode || "none";
  task.targetContext.objective = objective || task.targetContext.objective || "";
  task.targetContext.targetActionDescription = objective || task.targetContext.targetActionDescription || "";
  task.targetContext.inputTarget = targetValue || packageName || task.targetContext.inputTarget || "";
  task.targetContext.targetSignals = uniqStrings([
    ...(task.targetContext.targetSignals || []),
    targetValue,
    packageName,
    ...targetParts,
    ...entryHints
  ]);
  task.targetContext.targetKeywords = uniqStrings([
    ...(task.targetContext.targetKeywords || []),
    targetType,
    deviceMode,
    ...protectionHints,
    ...frameworkHints,
    ...networkHints,
    ...processHints
  ]);
  task.targetContext.targetFunctionNames = uniqStrings([
    ...(task.targetContext.targetFunctionNames || []),
    ...entryHints
  ]);
  task.targetContext.requirementsSummary = requirementsSummary;
  task.targetContext.boundariesSummary = boundariesSummary;
  task.targetContext.requestedDeliverables = requestedDeliverables.slice();
  task.targetContext.targetParts = targetParts.slice();
  task.targetContext.deviceMode = deviceMode;
  task.targetContext.attachMode = attachMode;
  task.targetContext.androidVersion = androidVersion;
  task.targetContext.abi = abi;
  task.targetContext.taskInputHints = {
    protectionHints,
    frameworkHints,
    networkHints,
    processHints,
    entryHints
  };
  task.objective = objective || task.objective || task.targetContext.objective || "";
  task.deliverableTier = deliverableTier || task.deliverableTier || "T1";
  task.completionCriteria = completionCriteria.length > 0
    ? completionCriteria.map((item) => ({ ...item, evidenceRefs: item.evidenceRefs.slice() }))
    : [
        {
          id: "criterion-1",
          label: "交付物必须直接满足 objective 原文，并在 report.md 与 run/fixtures.json 中提供硬证据回指。",
          status: "pending",
          evidenceRefs: []
        }
      ];
  const criterionIds = task.completionCriteria.map((item) => item.id).filter(Boolean);
  task.deliverables = deliverables.map((item) => ({
    ...item,
    criteriaIds: item.criteriaIds.length > 0 ? item.criteriaIds.slice() : criterionIds.slice()
  }));
  task.currentDeliverableId = task.deliverables[0]?.id || "primary";
  if (protectionTier) {
    task.protectionTier = protectionTier;
  }
  task.disallowedFallbacks = disallowedFallbacks.slice();
  task.userRejectedApproaches = userRejectedApproaches.slice();
  task.toolchain ||= {};
  task.toolchain.declaredMcpTools = declaredMcpTools.slice();
  task.toolchain.preferredTools = preferredTools.slice();
  task.toolchain.unavailableTools ||= [];
  task.toolchain.foregroundRequirements ||= [];
  if (hasMtTool([...declaredMcpTools, ...preferredTools])) {
    task.toolchain.foregroundRequirements = uniqStrings([
      ...task.toolchain.foregroundRequirements,
      "mt-mcp requires MT Manager to be the foreground app before MCP actions"
    ]);
  }
  if (task.deliverables.some((item) => item.tier === "T5")) {
    task.disallowedRuntimeDeps = ["unicorn", "unidbg", "angr", "qiling", "frida", "adb", "java_subprocess"];
    task.deliveryRequirements.localReproductionRequested = true;
  }
  if (task.deliverables.some((item) => item.tier === "T4")) {
    task.requiresProtocolDoc = true;
  }
  if (task.deliverables.some((item) => item.tier === "T2")) {
    task.requiresRunnableHook = true;
  }
  task.boundaries.activeTriggerAllowed = activeTriggerAllowed;
  task.boundaries.forbiddenActions = forbiddenActions.slice();
  task.boundaries.patchingAllowed = patchingAllowed;
  task.boundaries.summary = boundariesSummary;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskId = args.find((item) => !item.startsWith("--"));
  if (!taskId) {
    console.error("usage: node tools/task/task-init.mjs <task-id> [--force-new-task] [--protection-tier=A4] [--topic=static-triage] [--topics=static-triage,jni-bridge] [--task-input=path.json] [--local-repro] [--api-call-example] [--<topic-or-alias> ...]");
    process.exit(1);
  }

  const protectionArg = args.find((item) => item.startsWith("--protection-tier="));
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
    console.error("task-init: use topic key / alias from topics/*, e.g. --topic=static-triage or --topics=static-triage,jni-bridge.");
    process.exit(1);
  }

  let taskInput = null;
  let normalizedTaskInput = null;
  if (taskInputArg) {
    const taskInputPath = taskInputArg.split("=")[1] || "";
    if (!taskInputPath.trim()) {
      console.error("task-init: --task-input requires a JSON path");
      process.exit(1);
    }
    try {
      taskInput = readJsonFile(taskInputPath);
      normalizedTaskInput = normalizeTaskInput(taskInput);
    } catch (error) {
      console.error(`task-init: failed to read task input: ${error.message}`);
      process.exit(1);
    }
    localReproductionRequested ||= normalizedTaskInput?.localReproductionRequested === true;
    apiCallExampleRequired ||= normalizedTaskInput?.apiCallExampleRequired === true;
    if (apiCallExampleRequired) {
      localReproductionRequested = true;
    }
  }

  const inferredTopics = inferTopicsFromTaskInput(taskInput);
  const selectedTopics = Array.from(
    new Set(
      [...explicitTopicKeys, ...inferredTopics]
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

  return {
    taskId,
    protectionTier: protectionArg?.split("=")[1] || normalizedTaskInput?.protectionTier || null,
    extensionFiles,
    selectedTopics,
    taskInput,
    normalizedTaskInput,
    inferredTopics,
    localReproductionRequested,
    apiCallExampleRequired,
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
    normalizedTaskInput,
    inferredTopics,
    localReproductionRequested,
    apiCallExampleRequired,
    forceNewTask
  } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskId);
  const historyFiles = listWorkspaceHistoryFiles();

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
  task.deliveryRequirements.localReproductionRequested = localReproductionRequested;
  task.deliveryRequirements.apiCallExampleRequired = apiCallExampleRequired;
  applyTaskInputToTask(task, normalizedTaskInput);
  ensureTaskDeliveryArtifacts(taskDir, task);
  writeTaskJson(taskDir, task);
  const routeState = defaultRouteStateDocument(task);
  routeState.syncStatus = "initialized";
  routeState.execution = resolveExecutionState(task, routeState);
  const persistedRouteState = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, persistedRouteState);

  console.log(`task-init: created ${relFromRepo(taskDir)}`);
  console.log(`task-init: protectionTier=${protectionTier || "unassessed"}`);
  console.log(`task-init: executionStatus=${persistedRouteState.execution.status}`);
  console.log(`task-init: nextAction=${persistedRouteState.execution.nextExecutableAction}`);
  if (extensionFiles.length > 0) {
    console.log(`task-init: extensions=${extensionFiles.join(",")}`);
  }
  if (selectedTopics.length > 0) {
    console.log(`task-init: topics=${selectedTopics.join(",")}`);
  }
  if (inferredTopics.length > 0) {
    console.log(`task-init: inferredTopics=${inferredTopics.join(",")}`);
  }
  if (normalizedTaskInput) {
    console.log(`task-init: packaging=${task.runtime.packaging} runtimeFlavor=${task.runtime.runtimeFlavor}`);
    console.log(`task-init: target=${task.targetContext.inputTarget || "(none)"} package=${task.target.packageName || "(none)"}`);
    console.log(`task-init: attachMode=${task.executionContext.attachMode} deviceMode=${task.executionContext.deviceMode || "none"}`);
  }
  if (localReproductionRequested) {
    console.log("task-init: deliveryRequirements.localReproductionRequested=true");
  }
  if (apiCallExampleRequired) {
    console.log("task-init: deliveryRequirements.apiCallExampleRequired=true");
  }
}

main();
