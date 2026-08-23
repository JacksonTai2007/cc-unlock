import {
  collectRawTaskShapeFindings,
  ensureTaskRuntimeShape,
  readRawTaskJson,
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
import { evaluateStateFreshness } from "./check-state-freshness.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) {
    console.error("usage: node tools/task/task-advance.mjs <task-id|task-path> [--pause-category=none|user|risk|internal] [--pause-reason=\"...\"] [--resume-from-user|--clear-pause] [--json]");
    process.exit(1);
  }

  const resumeFromUser = args.includes("--resume-from-user");
  const clearPause = args.includes("--clear-pause");
  const pauseCategory = resumeFromUser || clearPause
    ? "none"
    : args.find((item) => item.startsWith("--pause-category="))?.split("=")[1] || "";
  const pauseReason = resumeFromUser || clearPause
    ? ""
    : args.find((item) => item.startsWith("--pause-reason="))?.split("=").slice(1).join("=") || "";
  const json = args.includes("--json");

  return {
    taskRef,
    pauseCategory,
    pauseReason,
    resumeFromUser,
    clearPause,
    json
  };
}

function main() {
  const { taskRef, pauseCategory, pauseReason, resumeFromUser, clearPause, json } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);
  const rawTaskFindings = collectRawTaskShapeFindings(readRawTaskJson(taskDir));
  if (rawTaskFindings.length > 0) {
    console.error(`task-advance: raw task.json shape is invalid for ${relFromRepo(taskDir)}`);
    for (const finding of rawTaskFindings) {
      console.error(`- ${finding}`);
    }
    process.exit(2);
  }
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  let routeState = readRouteStateDocument(taskDir, task);
  const freshness = evaluateStateFreshness(taskDir, task);

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
  console.log(`execution.discipline.workspaceRoot=${payload.execution.discipline?.workspaceRoot || task.roots?.workspaceRoot || "(none)"}`);
  console.log(`execution.discipline.taskLocalRoot=${payload.execution.discipline?.taskLocalRoot || task.roots?.taskLocalRoot || "(none)"}`);
  console.log(`execution.discipline.artifactTruthRoot=${payload.execution.discipline?.artifactTruthRoot || "(none)"}`);
  console.log(`execution.discipline.workspaceMode=${payload.execution.discipline?.workspaceMode || "skill-workspace"}`);
  // P2-T2：每次 advance 末尾重复打印绝对路径锚点，避免模型遗忘写入目录。
  const absoluteTaskRoot = task.roots?.taskLocalRoot || taskDir;
  console.log(`artifact.anchor=${absoluteTaskRoot} (run/ state/ report.md 均相对此路径)`);
  console.log(`execution.discipline.mustExecuteNow=${payload.execution.discipline?.mustExecuteNow ? "true" : "false"}`);
  // 浏览器 MCP 锁定信号：每轮都打印，跨轮抵消上下文衰减导致的工具漂移。
  const pinnedBrowserMcp = payload.execution.discipline?.pinnedBrowserMcp || task.browserSession?.pinnedMcp || "";
  if (pinnedBrowserMcp) {
    console.log(`execution.discipline.pinnedBrowserMcp=${pinnedBrowserMcp}`);
    console.log(`execution.discipline.rule=pinned-browser-mcp=${pinnedBrowserMcp}`);
    console.log(`execution.discipline.pinnedBrowserMcp.note=只用 ${pinnedBrowserMcp} 这个浏览器 MCP；某能力它无原生时走 browser-mcp-capability-map.md 该列的 fallback（如经 execute_cdp_command），禁止为单个能力切换到别的浏览器 MCP（换 MCP→风控指纹变化/拿到假挑战，污染整条逆向）。如确需换工具，先向用户确认并经 task-init --browser-mcp 重锁。`);
  } else {
    console.log("execution.discipline.pinnedBrowserMcp=(none) 用户未锁定浏览器 MCP；如用户已显式指定某浏览器 MCP，用 task-init --browser-mcp=<name> 锁定以防后续漂移");
  }
  console.log(`execution.activatedTopics=${task.taskPacks?.activatedTopics?.join(",") || "(none)"}`);
  console.log(`execution.stateFreshness=${freshness.ok ? "fresh" : "stale-detected"}`);
  if (resumeFromUser || clearPause) {
    console.log("execution.resumeAction=cleared-user-pause");
  } else if (payload.execution.status === "blocked-on-user") {
    console.log(`execution.resumeHint=node tools/task/task-advance.mjs ${taskRef} --resume-from-user`);
  }
  if (!freshness.ok) {
    for (const finding of freshness.findings) {
      console.log(`execution.stateFreshnessFinding=${finding}`);
    }
  }
  if (payload.execution.discipline?.mustExecuteNow) {
    const action = payload.execution.nextExecutableAction || "(none)";
    const taskId = task.taskId || taskRef;
    const toolDir = payload.execution.discipline?.skillRoot
      ? `${payload.execution.discipline.skillRoot}/tools/task`
      : "<skill-path>/tools/task";
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("MUST_EXECUTE_NOW_BREAKDOWN:");
    console.log("");
    console.log("  STEP-1 [强制前置 · 不可跳过]: 线索落盘检查");
    console.log("    本轮是否产生新线索/洞见/被否方案/关键中间值？");
    console.log("    → 有: 立即执行:");
    console.log(`       node ${toolDir}/task-note.mjs ${taskId} --kind=clue --text="..." [--entrypoint=EP-00N]`);
    console.log("    → 无: 声明「本轮无线索需落盘」");
    console.log("    完成后才允许进入 STEP-2。");
    console.log("");
    console.log(`  STEP-2 [执行]: ${action}`);
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("execution.discipline.rule=status-only-response-forbidden");
    console.log("execution.discipline.rule=promise-only-response-forbidden");
    console.log("execution.discipline.rule=reply-gate-assert-can-reply");
    console.log("execution.discipline.rule=verify-artifacts-before-claim");
    console.log("execution.discipline.rule=verify-success-before-claim");
    console.log("execution.discipline.rule=high-semantic-hook-first");
    console.log(`execution.discipline.rule=same-family-hook-retry-cap-${payload.execution.discipline?.sameFamilyHookRetryCap || 2}`);
    console.log("execution.discipline.rule=low-level-hook-surface-switch-not-pivot");
    console.log("execution.discipline.rule=acceptance-boundary-first");
    console.log("execution.discipline.rule=note-before-execute-mandatory");
  } else {
    console.log("execution.clueCheck=每轮执行前检查本轮是否有新线索/洞见/被否方案需要 task-note 落盘");
    console.log(`execution.clueCheck.cmd=node <skill-path>/tools/task/task-note.mjs <task-id> --kind=clue --text="..."`);
    console.log("execution.clueCheck.rule=发现即落盘，同一轮内立即追加；不要攒着等会儿一起写");
  }
}

main();
