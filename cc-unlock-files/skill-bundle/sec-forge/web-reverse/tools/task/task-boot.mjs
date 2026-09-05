import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listWorkspaceHistoryFiles, relFromRepo, skillRoot } from "./common.mjs";

// task-boot：唯一开机入口。把「发现工具目录 + 判定 new/resume + 跑完整链路 +
// 向子进程传播 workspace 根」收敛成一条幂等命令，解决「任务开始不能正常初始化」。
//
//   node <TOOL_DIR>/task-boot.mjs <task-id> [--topic=...] [--task-input=...] \
//        [--force-new-task] [--resume-from-user] [--allow-skill-dir]
//
// 设计要点：
//   1. 自身位于 $TOOL_DIR，无需模型手工 ls/realpath 发现工具目录。
//   2. 始终向所有子工具传递 WEB_REVERSE_WORKSPACE_ROOT=cwd —— 这是过去 task-sync/
//      task-advance 从独立 SKILL 包被调用时 ENOENT 的根因。
//   3. 干净目录 → 自动 init；已有任务 → 自动 sync+advance 续跑，退出码语义化
//      （0=就绪，无论 new/resume），不再用吓人的 exit 1 误导模型「初始化失败」。

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

const bootOnlyFlags = new Set(["--allow-skill-dir", "--resume-from-user"]);

function listTaskIds(workspace) {
  const tasksRoot = path.join(workspace, "artifacts", "tasks");
  if (!fs.existsSync(tasksRoot)) {
    return [];
  }
  return fs
    .readdirSync(tasksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_TEMPLATE")
    .filter((entry) => fs.existsSync(path.join(tasksRoot, entry.name, "task.json")))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function runTool(scriptName, args) {
  const result = spawnSync(process.execPath, [path.join(toolDir, scriptName), ...args], {
    cwd,
    env: { ...process.env, WEB_REVERSE_WORKSPACE_ROOT: cwd },
    stdio: "inherit"
  });
  return result.status ?? 1;
}

function writeToolDirPointer() {
  try {
    fs.writeFileSync(path.join(cwd, ".web-reverse-tool-dir"), `${path.resolve(toolDir)}\n`);
  } catch {
    // 元数据写入失败不阻断开机。
  }
}

function writeWorkspaceRootPointer() {
  try {
    fs.writeFileSync(path.join(cwd, ".web-reverse-workspace-root"), `${path.resolve(cwd)}\n`);
  } catch {
    // 元数据写入失败不阻断开机。
  }
}

function isSkillPackageDir() {
  if (path.resolve(cwd) === path.resolve(skillRoot)) {
    return true;
  }
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg?.name === "web-reverse-skill-framework") {
        return true;
      }
    } catch {
      // ignore malformed package.json
    }
  }
  return false;
}

function main() {
  const args = process.argv.slice(2);
  const allowSkillDir = args.includes("--allow-skill-dir");
  const resumeFromUser = args.includes("--resume-from-user");
  const forceNewTask = args.includes("--force-new-task");
  const taskId = args.find((item) => !item.startsWith("--"));
  // 转发给 task-init 的 flag（去掉 boot 自己消费的 flag）。
  const initFlags = args.filter((item) => item.startsWith("--") && !bootOnlyFlags.has(item));

  if (isSkillPackageDir() && !allowSkillDir) {
    console.error("[task-boot] 当前工作目录看起来是 SKILL 包目录（含 web-reverse-skill-framework / SKILL.md）。");
    console.error("[task-boot] 按 Startup Gate 纪律，默认不在此创建任务，以免把交付物写进 SKILL 包。");
    console.error("[task-boot] 请切换到你的项目目录后重试；若确实要在包目录内自测，追加 --allow-skill-dir。");
    process.exit(3);
  }

  writeToolDirPointer();
  writeWorkspaceRootPointer();
  console.log(`[task-boot] toolDir=${path.resolve(toolDir)}`);
  console.log(`[task-boot] workspaceRoot=${cwd}`);

  const historyFiles = listWorkspaceHistoryFiles(cwd);
  const existingTaskIds = listTaskIds(cwd);

  const wantNew = historyFiles.length === 0 || forceNewTask;
  let effectiveTaskId = taskId;

  if (wantNew) {
    if (!taskId) {
      console.error("[task-boot] 新任务需要一个 <task-id>，例如：node <TOOL_DIR>/task-boot.mjs my-task --topic=signature");
      process.exit(1);
    }
    console.log(`[task-boot] mode=new-task taskId=${taskId}`);
    const initStatus = runTool("task-init.mjs", [taskId, ...initFlags.filter((flag) => flag !== taskId)]);
    if (initStatus !== 0) {
      console.error("[task-boot] task-init failed; aborting boot.");
      process.exit(initStatus);
    }
  } else {
    // resume：确定要续跑哪个 task-id
    if (!effectiveTaskId) {
      if (existingTaskIds.length === 1) {
        effectiveTaskId = existingTaskIds[0];
      } else if (existingTaskIds.length === 0) {
        console.error("[task-boot] history files exist but no task.json could be located; inspect artifacts/tasks/.");
        process.exit(1);
      } else {
        console.error(`[task-boot] 多个已有任务，请显式指定 <task-id>：${existingTaskIds.join(", ")}`);
        process.exit(1);
      }
    } else if (!existingTaskIds.includes(effectiveTaskId)) {
      console.error(`[task-boot] 任务 '${effectiveTaskId}' 不存在。已有任务：${existingTaskIds.join(", ") || "(none)"}`);
      console.error("[task-boot] 若要在同一 workspace 新开任务，请加 --force-new-task。");
      process.exit(1);
    }
    console.log(`[task-boot] mode=resume taskId=${effectiveTaskId}`);
  }

  const syncStatus = runTool("task-sync.mjs", [effectiveTaskId]);
  if (syncStatus !== 0) {
    console.error("[task-boot] task-sync failed.");
    process.exit(syncStatus);
  }

  const advanceArgs = resumeFromUser ? [effectiveTaskId, "--resume-from-user"] : [effectiveTaskId];
  const advanceStatus = runTool("task-advance.mjs", advanceArgs);
  if (advanceStatus !== 0) {
    console.error("[task-boot] task-advance failed.");
    process.exit(advanceStatus);
  }

  const taskLocalRoot = path.join(cwd, "artifacts", "tasks", effectiveTaskId);
  console.log(`[task-boot] ready taskId=${effectiveTaskId} (${relFromRepo(taskLocalRoot, cwd)})`);
  // 硬锚点（技P0#1 / 技实战建议）：明确打印「所有脚本/样本/中间数据必须写到的绝对路径」，
  // 杜绝把脚本写进 cwd 根（红线2 违规、close 时会被门禁拦下）。
  console.log("[task-boot] 产物写入锚点（红线2，违者 task-close 门禁会 BLOCK）：");
  console.log(`[task-boot]   脚本/样本/成品 → ${path.join(taskLocalRoot, "run")}`);
  console.log(`[task-boot]   状态/中间数据 → ${path.join(taskLocalRoot, "state")}`);
  console.log(`[task-boot]   逆向报告      → ${path.join(taskLocalRoot, "report.md")}`);
  console.log(`[task-boot]   ✗ 不要写进 cwd 根：${cwd}`);
  console.log("[task-boot] 接下来按 task-advance 输出的 nextExecutableAction 执行；发现线索用 task-note，停下前用 task-snapshot 刷新 report.md。");
}

main();
