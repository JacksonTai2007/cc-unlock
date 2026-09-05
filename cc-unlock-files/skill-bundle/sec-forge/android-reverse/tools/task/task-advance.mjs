import {
  ensureTaskRuntimeShape,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  writeTaskJson
} from "./common.mjs";
import {
  applyRouteStateToTask,
  normalizeRouteStateDocument,
  readRouteStateDocument,
  resolveExecutionState,
  syncMarkdownViews,
  writeRouteStateDocument
} from "./route-state.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) {
    console.error("usage: node tools/task/task-advance.mjs <task-id|task-path> [--pause-category=none|user|risk|internal] [--pause-reason=\"...\"] [--json]");
    process.exit(1);
  }

  const pauseCategory = args.find((item) => item.startsWith("--pause-category="))?.split("=")[1] || "";
  const pauseReason = args.find((item) => item.startsWith("--pause-reason="))?.split("=").slice(1).join("=") || "";
  const json = args.includes("--json");

  return {
    taskRef,
    pauseCategory,
    pauseReason,
    json
  };
}

function main() {
  const { taskRef, pauseCategory, pauseReason, json } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  let routeState = readRouteStateDocument(taskDir, task);

  if (!routeState) {
    console.error("task-advance: route-state.json is missing or unreadable; run task-sync first");
    process.exit(1);
  }

  routeState = normalizeRouteStateDocument(routeState, task);
  if (pauseCategory) {
    routeState.execution = normalizeRouteStateDocument(
      {
        execution: {
          ...routeState.execution,
          pauseCategory,
          pauseReason
        }
      },
      task
    ).execution;
  }

  routeState.execution = resolveExecutionState(task, routeState);
  routeState = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, routeState);
  applyRouteStateToTask(task, routeState);
  writeTaskJson(taskDir, task);

  const payload = {
    task: relFromRepo(taskDir),
    phase: routeState.phase,
    syncStatus: routeState.syncStatus,
    execution: routeState.execution
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`task-advance: ${payload.task}`);
  console.log(`phase=${payload.phase}`);
  console.log(`syncStatus=${payload.syncStatus}`);
  console.log(`execution.status=${payload.execution.status}`);
  console.log(`execution.autoAdvanceEligible=${payload.execution.autoAdvanceEligible}`);
  console.log(`execution.nextEntrypointId=${payload.execution.nextEntrypointId || "(none)"}`);
  console.log(`execution.nextExecutableAction=${payload.execution.nextExecutableAction || "(none)"}`);
  console.log(`execution.pauseCategory=${payload.execution.pauseCategory}`);
  console.log(`execution.pauseReason=${payload.execution.pauseReason || "(none)"}`);
}

main();

