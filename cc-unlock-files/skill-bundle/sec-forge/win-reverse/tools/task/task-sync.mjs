import {
  ensureTaskScaffold,
  ensureTaskWorkspaceBridges,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  ensureTaskRuntimeShape,
  syncTaskTopicCoverage,
  writeTaskJson
} from "./common.mjs";
import {
  applyRouteStateToTask,
  buildRouteStateFromMarkdown,
  normalizeRouteStateDocument,
  readRouteStateDocument,
  resolveExecutionState,
  syncMarkdownViews,
  writeRouteStateDocument
} from "./route-state.mjs";
import {
  applyWebShellTechResultToTask,
  autoDetectWebShellTechFromTaskContext
} from "./web-shell-triage-state.mjs";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasMeaningfulRouteState(routeState, task) {
  const requiresEntrypoints = ["Observe", "Capture", "Rebuild", "Patch"].includes(task?.phase);
  return Boolean(
    routeState &&
    routeState.syncStatus !== "backfilled-from-markdown-lossy" &&
    Array.isArray(routeState.tracks) &&
    routeState.tracks.some((track) => String(track?.title || "").trim()) &&
    (!requiresEntrypoints || (Array.isArray(routeState.entrypoints) && routeState.entrypoints.length > 0))
  );
}

function main() {
  const taskRef = process.argv[2];
  if (!taskRef) {
    console.error("usage: node tools/task/task-sync.mjs <task-id>");
    process.exit(1);
  }

  const taskDir = resolveTaskDir(taskRef);
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  autoDetectWebShellTechFromTaskContext(taskDir, task);
  syncTaskTopicCoverage(taskDir, task);
  ensureTaskScaffold(taskDir, task);
  ensureTaskWorkspaceBridges(taskDir, task);

  let routeState = readRouteStateDocument(taskDir, task);
  let syncStatus = cleanText(routeState?.syncStatus) || "restored-from-route-state";
  if (!hasMeaningfulRouteState(routeState, task)) {
    routeState = buildRouteStateFromMarkdown(taskDir, task);
    syncStatus = cleanText(routeState?.syncStatus) || "backfilled-from-markdown";
  }

  routeState = normalizeRouteStateDocument(
    {
      ...routeState,
      taskId: task.taskId,
      phase: task.phase,
      syncStatus
    },
    task
  );
  applyWebShellTechResultToTask(taskDir, task, routeState);
  routeState.execution = resolveExecutionState(task, routeState);
  routeState = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, routeState);
  applyRouteStateToTask(task, routeState);
  writeTaskJson(taskDir, task);

  console.log(`task-sync: synced ${relFromRepo(taskDir)}`);
  console.log(`task-sync: activeTracks=${routeState.activeTracks.join(",") || "(none)"}`);
  console.log(`task-sync: syncStatus=${routeState.syncStatus}`);
  console.log(`task-sync: executionStatus=${routeState.execution.status}`);
  console.log(`task-sync: nextEntrypoint=${routeState.execution.nextEntrypointId || "(none)"}`);
  console.log(`task-sync: nextAction=${routeState.execution.nextExecutableAction || "(none)"}`);
}

main();
