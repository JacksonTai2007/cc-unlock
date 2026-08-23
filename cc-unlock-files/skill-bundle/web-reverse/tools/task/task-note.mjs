import fs from "node:fs";
import {
  collectRawTaskShapeFindings,
  ensureTaskRuntimeShape,
  ensureTaskScaffold,
  ensureTaskWorkspaceBridges,
  exists,
  nowIso,
  readJsonFile,
  readRawTaskJson,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  skillRoot,
  taskFile,
  workspaceRoot,
  writeJsonFile,
  writeTaskJson
} from "./common.mjs";
import {
  applyRouteStateToTask,
  parseCluesMarkdown,
  readRouteStateDocument,
  renderCluesMarkdown,
  syncMarkdownViews,
  writeRouteStateDocument
} from "./route-state.mjs";

// task-note：一条命令把一条高价值线索「原子落盘」，解决「发现重要线索来不及落盘、
// 任务中止后浪费 token 重分析」。模型每发现一条可复用线索就调用一次，成本极低。
//
//   node tools/task/task-note.mjs <task-id> --kind=clue|insight|entrypoint|reject \
//        --text="..." [--entrypoint=EP-001] [--track=A] [--claim=provisional] \
//        [--verify="..."] [--impact="..."] [--action="..."] [--ref=url]
//
// kind 语义：
//   clue       追加一条线索到 route-state.clues（再由 syncMarkdownViews 渲染进 state/clues.md）
//   entrypoint 等同 clue，但强制带上来源切入点，便于回溯切入点链路
//   insight    追加一条候选洞见到 state/candidate-insights.json
//   reject     追加一条被否决方案到 acceptanceModel.userRejectedApproaches（累积、只增不减）

const allowedKinds = new Set(["clue", "insight", "entrypoint", "reject"]);

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  const getValue = (flag) => {
    const hit = args.find((item) => item.startsWith(`${flag}=`));
    return hit ? hit.split("=").slice(1).join("=") : "";
  };
  return {
    taskRef,
    workspaceRoot: getValue("--workspace-root").trim(),
    kind: (getValue("--kind") || "clue").trim().toLowerCase(),
    text: getValue("--text").trim(),
    entrypoint: getValue("--entrypoint").trim(),
    track: getValue("--track").trim(),
    claim: getValue("--claim").trim(),
    verify: getValue("--verify").trim(),
    impact: getValue("--impact").trim(),
    action: getValue("--action").trim(),
    ref: getValue("--ref").trim()
  };
}

function usage(message) {
  if (message) {
    console.error(`task-note: ${message}`);
  }
  console.error('usage: node tools/task/task-note.mjs <task-id> --kind=clue|insight|entrypoint|reject --text="..." [--entrypoint=EP-001] [--track=A] [--claim=provisional] [--verify="..."] [--impact="..."] [--action="..."] [--ref=url]');
  process.exit(1);
}

function persistRouteState(taskDir, task, routeState) {
  const persisted = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, persisted);
  applyRouteStateToTask(task, persisted);
  writeTaskJson(taskDir, task);
  return persisted;
}

// 2.6 搜索重挂载：线索落盘的「那一刻」就是最自然的搜索触发点（模型必读 task-note 输出）。
// 命中高信号 token（provider / WASM / 错误码 / host / 商业保护）即提示立刻搜索，而不是把触发
// 藏在模型不会调的 task-advance 输出里。返回建议的 query 关键词；无信号返回空。
function detectSearchSignal(text) {
  const t = String(text || "");
  const probes = [
    [/wasm|webassembly|jsvmp|\bvmp\b|__wbindgen|emscripten/i, "WASM/VM 导出或 host 域名"],
    [/akamai|cloudflare|perimeterx|datadome|incapsula|kasada|turnstile|recaptcha|hcaptcha|geetest|fingerprintjs|易盾|顶象|瑞数|阿里|腾讯验证/i, "provider 名"],
    [/错误码|error[\s:=]*\d{2,}|status[\s:=]*\d{3}|\b0x[0-9a-f]{3,}\b/i, "错误码 / 状态码"],
    [/\b[a-z0-9-]{2,}\.(?:com|cn|net|io|org|co)\b/i, "host 域名 + 核心字段名"]
  ];
  const hits = probes.filter(([re]) => re.test(t)).map(([, label]) => label);
  return hits;
}

function appendClue(taskDir, task, opts) {
  // clues.md 是线索唯一真源：直接把线索作为 bullet 追加进文件，再从文件反推 route-state.clues 缓存。
  // 这与模型「用 Edit 手编 clues.md」走同一条真源，互不覆盖。
  const cluesRel = task.routeState?.cluesPath || "state/clues.md";
  const cluesFile = taskFile(taskDir, cluesRel);
  if (!exists(cluesFile)) {
    fs.writeFileSync(cluesFile, renderCluesMarkdown());
  }
  let text = fs.readFileSync(cluesFile, "utf8");
  const confidence = opts.claim || "provisional";
  const entrypoint = opts.entrypoint ? ` {${opts.entrypoint}}` : "";
  const extras = [
    opts.track ? `track=${opts.track}` : "",
    opts.verify ? `验证：${opts.verify}` : "",
    opts.impact ? `影响：${opts.impact}` : "",
    opts.action ? `行动：${opts.action}` : "",
    opts.ref ? `ref=${opts.ref}` : ""
  ].filter(Boolean);
  const suffix = extras.length ? `（${extras.join("；")}）` : "";
  const bullet = `- [${confidence}] ${opts.text}${suffix}${entrypoint}`;
  // 追加到「## 线索」段末；没有该段就补一个再追加。
  if (/^##\s*线索\s*$/m.test(text)) {
    text = `${text.replace(/\s*$/, "")}\n${bullet}\n`;
  } else {
    text = `${text.replace(/\s*$/, "")}\n\n## 线索\n\n${bullet}\n`;
  }
  fs.writeFileSync(cluesFile, text);
  // 从 clues.md 反推 route-state.clues 缓存并持久化（syncMarkdownViews 不会覆盖 clues.md）。
  const routeState = readRouteStateDocument(taskDir, task);
  if (routeState) {
    persistRouteState(taskDir, task, routeState);
  }
  const total = parseCluesMarkdown(text).length;
  console.log(`task-note: appended clue to ${relFromRepo(cluesFile, taskDir)} (total clues: ${total})`);
  console.log("task-note: clues.md 是线索唯一真源；你也可以直接用 Edit 往「## 线索」下追加 bullet。");
  const signals = detectSearchSignal(`${opts.text} ${opts.entrypoint} ${opts.impact}`);
  if (signals.length > 0) {
    console.log(
      `task-note: ⚡这条线索含搜索高信号（${signals.join("、")}）——建议立即 ` +
        `mcp__web-search__search_bing({query: "<上面具体值>"})，结果写入 state/external-research.md/.json。`
    );
  }
}

function appendInsight(taskDir, task, opts) {
  const relPath = "state/candidate-insights.json";
  const filePath = taskFile(taskDir, relPath);
  let doc = { version: 1, taskId: task.taskId, generatedAt: "", insights: [] };
  if (exists(filePath)) {
    try {
      doc = readJsonFile(filePath);
    } catch (error) {
      console.warn(`task-note: candidate-insights.json unreadable, recreating (${error.message})`);
      doc = { version: 1, taskId: task.taskId, generatedAt: "", insights: [] };
    }
  }
  doc.version ||= 1;
  doc.taskId = doc.taskId && doc.taskId !== "replace-me" ? doc.taskId : task.taskId;
  doc.insights = Array.isArray(doc.insights) ? doc.insights : [];
  const id = `INSIGHT-${String(doc.insights.length + 1).padStart(3, "0")}`;
  doc.insights.push({
    id,
    discoveredAt: nowIso(),
    text: opts.text,
    claimLevel: opts.claim || "provisional",
    sourceEntrypoint: opts.entrypoint,
    ref: opts.ref
  });
  doc.generatedAt = nowIso();
  writeJsonFile(filePath, doc);
  console.log(`task-note: appended ${id} to ${relPath} (total insights: ${doc.insights.length})`);
}

function appendReject(taskDir, task, opts) {
  task.acceptanceModel ||= {};
  const list = Array.isArray(task.acceptanceModel.userRejectedApproaches)
    ? task.acceptanceModel.userRejectedApproaches
    : [];
  const entry = opts.text;
  if (list.includes(entry)) {
    console.log(`task-note: userRejectedApproaches already contains this entry; no change (total: ${list.length})`);
    return;
  }
  list.push(entry);
  task.acceptanceModel.userRejectedApproaches = list;
  writeTaskJson(taskDir, task);
  // 刷新 route-state 视图，让 route-plan 的验收段落反映新的否决项。
  const routeState = readRouteStateDocument(taskDir, task);
  persistRouteState(taskDir, task, routeState);
  console.log(`task-note: appended rejected approach to acceptanceModel.userRejectedApproaches (total: ${list.length})`);
  console.log("task-note: NOTE userRejectedApproaches 为累积字段，只增不减，不会被 task-sync 清空。");
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.taskRef) {
    usage("missing <task-id>");
  }
  if (!allowedKinds.has(opts.kind)) {
    usage(`unknown --kind=${opts.kind}; allowed: clue|insight|entrypoint|reject`);
  }
  if (!opts.text) {
    usage("--text is required and must be non-empty");
  }

  const taskDir = resolveTaskDir(opts.taskRef, opts.workspaceRoot ? { workspaceRoot: opts.workspaceRoot } : {});
  if (!exists(taskFile(taskDir, "task.json"))) {
    console.error(`task-note: no task.json under ${relFromRepo(taskDir)}; run task-boot/task-init first.`);
    console.error(`task-note: resolved workspaceRoot=${workspaceRoot}, skillRoot=${skillRoot}`);
    console.error(`task-note: if cwd is wrong, either cd to the project directory or set WEB_REVERSE_WORKSPACE_ROOT=<project-dir>`);
    console.error(`task-note: alternative: pass --workspace-root=<project-dir> explicitly`);
    process.exit(1);
  }
  const rawFindings = collectRawTaskShapeFindings(readRawTaskJson(taskDir));
  if (rawFindings.length > 0) {
    console.error(`task-note: task.json shape is invalid for ${relFromRepo(taskDir)}`);
    for (const finding of rawFindings) {
      console.error(`- ${finding}`);
    }
    process.exit(2);
  }

  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  ensureTaskScaffold(taskDir, task);
  ensureTaskWorkspaceBridges(taskDir, task);

  if (opts.kind === "insight") {
    appendInsight(taskDir, task, opts);
  } else if (opts.kind === "reject") {
    appendReject(taskDir, task, opts);
  } else {
    // clue / entrypoint
    appendClue(taskDir, task, opts);
  }
}

main();
