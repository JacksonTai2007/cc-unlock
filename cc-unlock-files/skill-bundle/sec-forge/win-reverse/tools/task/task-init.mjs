import fs from "node:fs";
import {
  assertSafeWorkspaceRoot,
  buildTaskFromTemplates,
  copyCoreTaskScaffold,
  copyDirRecursive,
  ensureTaskRuntimeShape,
  ensureTaskDeliveryArtifacts,
  getTopicPackDir,
  getTopicBySpecifier,
  getTopicExtensionFile,
  inferProtectionTier,
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
import {
  normalizeTaskInputShape,
  validateTaskInput
} from "./task-input-schema.mjs";

function normalizeTextList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskId = args.find((item) => !item.startsWith("--"));
  if (!taskId) {
    console.error("usage: node tools/task/task-init.mjs <task-id> [--force-new-task] [--protection-tier=T2] [--topic=static-triage] [--topics=static-triage,packer-unpack] [--task-input=path.json] [--local-repro] [--protocol-replay] [--api-call-example] [--<topic-or-alias> ...]");
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

    if (item === "--protocol-replay") {
      localReproductionRequested = true;
      apiCallExampleRequired = true;
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
    console.error("task-init: use topic key / alias from topics/*, e.g. --topic=static-triage or --topics=static-triage,packer-unpack.");
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
    try {
      taskInput = readJsonFile(taskInputPath);
    } catch (error) {
      console.error(`task-init: failed to read task input: ${error.message}`);
      process.exit(1);
    }
    const validation = validateTaskInput(taskInput);
    if (!validation.ok) {
      console.error("task-init: task input failed schema validation");
      for (const error of validation.errors) {
        console.error(`- ${error}`);
      }
      process.exit(1);
    }
    taskInput = normalizeTaskInputShape(validation.normalized);
    localReproductionRequested ||= taskInput?.requirements?.localReproductionRequested === true;
    apiCallExampleRequired ||=
      taskInput?.requirements?.protocolReplayExampleRequired === true ||
      taskInput?.requirements?.apiCallExampleRequired === true;
    if (apiCallExampleRequired) {
      localReproductionRequested = true;
    }
  }

  return {
    taskId,
    protectionTier: protectionArg?.split("=")[1] || inferProtectionTier(selectedTopics),
    extensionFiles,
    selectedTopics,
    taskInput,
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
  try {
    assertSafeWorkspaceRoot({
      commandName: "task-init"
    });
  } catch (error) {
    console.error(String(error?.message || error));
    process.exit(1);
  }

  const {
    taskId,
    protectionTier,
    extensionFiles,
    selectedTopics,
    taskInput,
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
  task.deliveryRequirements.protocolReplayExampleRequired = apiCallExampleRequired;
  if (taskInput?.objective) {
    task.targetContext.objective = String(taskInput.objective);
  }
  if (Array.isArray(taskInput?.requirements?.deliverables)) {
    task.targetContext.requestedDeliverables = taskInput.requirements.deliverables
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (taskInput?.target?.value) {
    task.targetContext.inputTarget = String(taskInput.target.value);
  }
  if (taskInput?.target?.binaryPath) {
    task.targetContext.targetBinaryPath = String(taskInput.target.binaryPath);
  }
  task.targetContext.samplePaths = normalizeTextList([
    ...(taskInput?.samplePaths || []),
    ...(taskInput?.target?.samplePaths || [])
  ]);
  task.targetContext.focusSignals = normalizeTextList(taskInput?.focusSignals || []);
  if (task.targetContext.focusSignals.length > 0) {
    task.targetContext.targetKeywords = normalizeTextList([
      ...(task.targetContext.targetKeywords || []),
      ...task.targetContext.focusSignals
    ]);
  }
  if (taskInput?.runtime?.architecture) {
    task.runtime.architecture = String(taskInput.runtime.architecture);
  }
  if (taskInput?.runtime?.wow64) {
    task.runtime.wow64 = String(taskInput.runtime.wow64);
  }
  if (typeof taskInput?.runtime?.managed === "boolean") {
    task.runtime.managed = taskInput.runtime.managed;
  }
  if (typeof taskInput?.runtime?.kernelMode === "boolean") {
    task.runtime.kernelMode = taskInput.runtime.kernelMode;
  }
  if (typeof taskInput?.access?.adminRequired === "boolean") {
    task.accessRequirements.adminRequired = taskInput.access.adminRequired;
  }
  if (typeof taskInput?.access?.interactiveUnlockRequired === "boolean") {
    task.accessRequirements.interactiveUnlockRequired = taskInput.access.interactiveUnlockRequired;
  }
  if (typeof taskInput?.access?.driverSigningBypassRequired === "boolean") {
    task.accessRequirements.driverSigningBypassRequired = taskInput.access.driverSigningBypassRequired;
  }
  if (taskInput?.boundaries) {
    task.boundaries.input = taskInput.boundaries;
  }
  ensureTaskDeliveryArtifacts(taskDir, task);
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
    console.log("task-init: deliveryRequirements.protocolReplayExampleRequired=true");
  }
}

main();
