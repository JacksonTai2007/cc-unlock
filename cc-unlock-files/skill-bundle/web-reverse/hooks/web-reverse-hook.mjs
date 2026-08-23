#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// web-reverse 生命周期 hook 分发器。把「确定性执行层」从模型自觉变成机制保证：
//
//   session-start  提醒模型先 task-boot 续跑已有任务（不自动建任务）
//   stop           模型每次停止回复前，自动 task-snapshot 刷新 report.md
//   evidence       关键证据工具调用后，自动 task-snapshot 做断点保护
//   guard          PreToolUse：拦截把任务产物写到 cwd 根目录的 Write/Edit/NotebookEdit
//
// 在 .claude/settings.json 中按事件挂载本脚本（见同目录 README / 仓库 .claude/settings.json）。
// 本脚本自定位：它位于 <skill>/hooks/，工具链在 <skill>/tools/task/。
// 活跃任务在「用户当前工作目录」cwd/artifacts/tasks/ 下自动发现。
// 设计为绝不崩溃：任何异常都 exit 0。其中 session-start/stop/evidence 绝不阻断；
// 唯有 guard 在「明确违反产物纪律」时返回 deny 决策（这正是它存在的意义）。

const hookDir = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(hookDir, "..", "tools", "task");
const cwd = process.cwd();

function findActiveTaskId() {
  const tasksRoot = path.join(cwd, "artifacts", "tasks");
  if (!fs.existsSync(tasksRoot)) {
    return "";
  }
  const candidates = [];
  for (const entry of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "_TEMPLATE") {
      continue;
    }
    const taskJson = path.join(tasksRoot, entry.name, "task.json");
    if (fs.existsSync(taskJson)) {
      candidates.push({ id: entry.name, mtime: fs.statSync(taskJson).mtimeMs });
    }
  }
  // 最近被改动的任务视为活跃任务。
  candidates.sort((left, right) => right.mtime - left.mtime);
  return candidates[0]?.id || "";
}

function runSnapshot(taskId, advanceRound = false) {
  const args = [path.join(toolDir, "task-snapshot.mjs"), taskId];
  // 只有「停止回复」这个真实回复边界才 --round 推进全局轮次；
  // evidence（每个证据工具调用后）只做断点快照，不推进轮次——否则一轮里几十次工具调用会把轮次冲爆。
  if (advanceRound) {
    args.push("--round");
  }
  spawnSync(process.execPath, args, {
    cwd,
    env: { ...process.env, WEB_REVERSE_WORKSPACE_ROOT: cwd },
    stdio: "ignore"
  });
}

function emitContext(message) {
  // SessionStart：stdout 会作为附加上下文注入模型。
  process.stdout.write(`${message}\n`);
}

// cwd 根目录唯一允许直接存在的文件（与 SKILL.md「产物纪律」白名单一致）。
// 注意：SKILL.md 在 skill 包目录内是合法的（它是 skill 定义的一部分），
// 但在任务 workspace 内不应由模型创建——此处白名单只放行 skill 包维护场景。
const ROOT_WHITELIST = new Set([".web-reverse-tool-dir", ".gitignore", "SKILL.md", "SKILL.md.bak"]);

// 即使没有 workspace 标记，这些文件名也强烈暗示是 web-reverse 产物——
// 用于打破「不初始化 → 无标记 → guard 放行 → 继续写根目录」的死锁。
const WEB_REVERSE_ARTIFACT_RE =
  /^(?:REPORT|report)\.md$|^(?:test_|dun163_|captcha_|search_|verify-|pure|core_|load_).*\.(?:py|js|mjs|json|jpg|png|har)$|^fixtures\.json$|^web-replay\.js$|^state.*\.json$|^__pycache__$/i;

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 检查当前 cwd 是否已经是 web-reverse workspace（有标记目录或已有产物）。
function detectWebReverseWorkspace() {
  const hasMarker =
    fs.existsSync(path.join(cwd, ".web-reverse-tool-dir")) ||
    fs.existsSync(path.join(cwd, "artifacts", "tasks"));
  if (hasMarker) {
    return { isWorkspace: true, hasMarker: true };
  }
  // 启发式：即使无标记，如果根下已有 web-reverse 产物，也视为本技能 workspace
  //（防止模型跳过初始化后 guard 完全失效）。
  try {
    const files = fs.readdirSync(cwd);
    const hasArtifacts = files.some((f) => WEB_REVERSE_ARTIFACT_RE.test(f));
    return { isWorkspace: hasArtifacts, hasMarker: false };
  } catch {
    return { isWorkspace: false, hasMarker: false };
  }
}

// PreToolUse 守卫：阻止把任务产物写到 cwd 根目录。
// 拦截条件（满足全部）：
//   1. cwd 是 web-reverse workspace（有标记目录 或 已有 web-reverse 产物）
//   2. 目标文件的父目录就是 cwd 根
//   3. basename 不在白名单
function guardRootWrite() {
  const payload = readStdinJson();
  if (!payload || typeof payload !== "object") {
    return; // 解析不了就放行
  }

  const input = payload.tool_input || {};
  const target = input.file_path || input.notebook_path || input.path || "";
  if (!target || typeof target !== "string") {
    return;
  }

  const { isWorkspace, hasMarker } = detectWebReverseWorkspace();
  if (!isWorkspace) {
    return; // 不是 web-reverse 项目，放行
  }

  const abs = path.resolve(cwd, target);
  // 只拦截「父目录正好是 cwd 根」的文件；artifacts/、run/、state/ 等子目录下的写入一律放行。
  if (path.dirname(abs) !== path.resolve(cwd)) {
    return;
  }

  const base = path.basename(abs);
  if (ROOT_WHITELIST.has(base)) {
    return;
  }

  // 启发式模式（无 marker 但已有产物）：只拦截「看起来像 web-reverse 产物」的文件，
  // 不误伤普通文件（如 README.md、hello.txt）。有 marker 时拦截所有非白名单文件。
  if (!hasMarker && !WEB_REVERSE_ARTIFACT_RE.test(base)) {
    return;
  }

  const taskId = findActiveTaskId();
  const dest = taskId ? `artifacts/tasks/${taskId}/` : "artifacts/tasks/<task-id>/";
  const isReport = /^report\.md$/i.test(base) || /report/i.test(base) && base.toLowerCase().endsWith(".md");

  let hint;
  if (!hasMarker && !taskId) {
    // 死锁突破路径：没有初始化标记也没有活跃任务
    hint =
      `当前目录没有初始化 web-reverse 任务（无 .web-reverse-tool-dir / artifacts/tasks/）。` +
      `请先在当前目录执行初始化：node ${path.join(toolDir, "task-boot.mjs")} <task-id>。` +
      `初始化完成后所有产物会自动落到 artifacts/tasks/<task-id>/ 下。`;
  } else if (isReport) {
    hint = `最终报告就是 ${dest}report.md（小写，由 task-snapshot/task-close 渲染，勿手建 REPORT.md）。`;
  } else {
    hint = `脚本/样本/图片/中间数据请写到 ${dest}run/ 下。`;
  }

  const reason =
    `[web-reverse 产物纪律] 禁止把 '${base}' 写到工作目录根 (${cwd})。` +
    `cwd 根仅允许 .web-reverse-tool-dir / .gitignore。${hint}`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason
      }
    }) + "\n"
  );
}

function main() {
  const event = (process.argv[2] || "").toLowerCase();

  if (event === "guard") {
    guardRootWrite();
    return;
  }

  const taskId = findActiveTaskId();

  if (event === "session-start") {
    if (taskId) {
      emitContext(
        `[web-reverse] 检测到活跃逆向任务 '${taskId}'（artifacts/tasks/${taskId}）。` +
          `正式分析前先续跑：node ${path.join(toolDir, "task-boot.mjs")} ${taskId}`
      );
    } else {
      // 没有活跃任务时强制提醒初始化——防止模型跳过 Startup Gate
      emitContext(
        `[web-reverse] ⚠️ 当前目录没有活跃逆向任务。任何分析/浏览器操作/写文件前，` +
          `必须先执行初始化：node ${path.join(toolDir, "task-boot.mjs")} <task-id>。` +
          `task-boot 幂等：有任务则续跑，无任务则新建。跳过初始化将导致所有产物散落根目录。`
      );
    }
    return;
  }

  if (!taskId) {
    return; // 没有活跃任务，stop/evidence 无需动作
  }

  if (event === "stop") {
    runSnapshot(taskId, true); // 回复边界：推进 progressionRounds
    return;
  }
  if (event === "evidence") {
    runSnapshot(taskId, false); // 证据断点：只刷 report，不推进轮次
    return;
  }
}

try {
  main();
} catch {
  // hook 绝不阻断主流程
}
process.exit(0);
