import {
  collectRawTaskShapeFindings,
  ensureTaskScaffold,
  ensureTaskWorkspaceBridges,
  readRawTaskJson,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  ensureTaskRuntimeShape,
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
import { evaluateStateFreshness } from "./check-state-freshness.mjs";

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
  const rawTaskFindings = collectRawTaskShapeFindings(readRawTaskJson(taskDir));
  if (rawTaskFindings.length > 0) {
    console.error(`task-sync: raw task.json shape is invalid for ${relFromRepo(taskDir)}`);
    for (const finding of rawTaskFindings) {
      console.error(`- ${finding}`);
    }
    process.exit(2);
  }
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  ensureTaskScaffold(taskDir, task);
  ensureTaskWorkspaceBridges(taskDir, task);

  let routeState = readRouteStateDocument(taskDir, task);
  const previousFreshness = evaluateStateFreshness(taskDir, task);
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
  console.log(`task-sync: workspaceRoot=${routeState.execution?.discipline?.workspaceRoot || task.roots?.workspaceRoot || "(none)"}`);
  console.log(`task-sync: taskLocalRoot=${routeState.execution?.discipline?.taskLocalRoot || task.roots?.taskLocalRoot || "(none)"}`);
  console.log(`task-sync: artifactTruthRoot=${routeState.execution?.discipline?.artifactTruthRoot || "(none)"}`);
  console.log(`task-sync: workspaceMode=${routeState.execution?.discipline?.workspaceMode || "skill-workspace"}`);
  console.log(`task-sync: discipline.mustExecuteNow=${routeState.execution?.discipline?.mustExecuteNow ? "true" : "false"}`);
  console.log(`task-sync: activatedTopics=${task.taskPacks?.activatedTopics?.join(",") || "(none)"}`);
  console.log(`task-sync: stateFreshness=${previousFreshness.ok ? "fresh" : "stale-detected-before-sync"}`);
  if (!previousFreshness.ok) {
    for (const finding of previousFreshness.findings) {
      console.log(`task-sync: freshnessFinding=${finding}`);
    }
  }
  if (routeState.execution?.discipline?.mustExecuteNow) {
    console.log("task-sync: DISCIPLINE status-only response is forbidden; execute nextExecutableAction before reporting.");
    console.log(`task-sync: DISCIPLINE before any user-visible reply run: node tools/task/assert-can-reply.mjs ${task.taskId}`);
    console.log("task-sync: DISCIPLINE verify real files under artifactTruthRoot before claiming updated artifacts.");
    console.log("task-sync: DISCIPLINE verify latest validation before claiming success.");
    console.log("task-sync: DISCIPLINE hook high-semantic boundary first: action/dispatch/payload/sign/request-use.");
    console.log("task-sync: DISCIPLINE switching cookie/script/DOM hook surfaces is not a real pivot.");
    console.log(`task-sync: DISCIPLINE same-family hook retry cap=${routeState.execution?.discipline?.sameFamilyHookRetryCap || 2}.`);
    console.log("task-sync: DISCIPLINE every hook must directly serve the acceptance boundary.");
  }
}

main();
