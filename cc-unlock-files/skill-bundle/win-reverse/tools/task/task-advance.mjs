import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

function runComplianceCheck(taskDir) {
  const crashFlagPath = path.join(taskDir, "run/crash_state.flag");
  const diagnosticsPath = path.join(taskDir, "run/crash_diagnostics.md");

  // 1. 物理检查：如果目标处于崩溃闪退状态
  if (fs.existsSync(crashFlagPath)) {
    if (!fs.existsSync(diagnosticsPath)) {
      console.error("\x1b[31m[RULE VIOLATION] 物理阻断：检测到目标处于崩溃闪退状态，但您未提供硬件诊断日志（run/crash_diagnostics.md）。\n请挂载调试器（如 Windbg/x64dbg）或抓取操作系统事件查看器日志，填入诊断文件后再尝试推进任务！\x1b[0m");
      process.exit(1);
    }

    const content = fs.readFileSync(diagnosticsPath, "utf8");
    if (content.length < 200) {
      console.error("\x1b[31m[RULE VIOLATION] 物理阻断：检测到您的 run/crash_diagnostics.md 诊断日志体积过小（少于 200 字符）。\n请不要进行简单的文字敷衍与自我合理化辩解，必须填入第一手的寄存器状态或操作系统报错日志！\x1b[0m");
      process.exit(1);
    }

    // 正则特征审计：必须含有寄存器、地址、调试工具或 Exception 字眼，防止文字敷衍
    const regex = /(eip|rip|exception|0x[0-9a-fA-F]+|windbg|eventvwr|x64dbg|addr|crash|dump)/i;
    if (!regex.test(content)) {
      console.error("\x1b[31m[RULE VIOLATION] 物理阻断：检测到您的 run/crash_diagnostics.md 诊断报告中未包含任何硬件调试器、崩溃堆栈或寄存器相关的客观特征数据（如 EIP/RIP、十六进制地址 0x...、exception、windbg、eventvwr等）。\n请老老实实获取并填入底层调试证据，拒绝空洞的非合规自我合理化文字！\x1b[0m");
      process.exit(1);
    }
  }

  // 2. 动态哈希一致性交叉核对（自动支持 Typora 的 exe 和 asar 等文件备份）
  const runDir = path.join(taskDir, "run");
  if (fs.existsSync(runDir)) {
    const files = fs.readdirSync(runDir);
    const backupFiles = files.filter((f) => f.endsWith(".clean.bak"));

    for (const backupName of backupFiles) {
      let originalPath = "";
      if (backupName.includes("typora.exe")) {
        originalPath = "C:/Program Files/Typora/typora.exe";
      } else if (backupName.includes("app.asar")) {
        originalPath = "C:/Program Files/Typora/resources/app.asar";
      }

      // 如果能在物理上定位到原始文件，执行哈希校验
      if (originalPath && fs.existsSync(originalPath)) {
        const backupPath = path.join(runDir, backupName);
        const currentHash = crypto.createHash("sha256").update(fs.readFileSync(originalPath)).digest("hex");
        const backupHash = crypto.createHash("sha256").update(fs.readFileSync(backupPath)).digest("hex");

        if (currentHash !== backupHash) {
          const authFlagPath = path.join(runDir, "hash_mismatch_authorized.flag");
          if (!fs.existsSync(authFlagPath)) {
            console.error(`\x1b[31m[RULE VIOLATION] 物理阻断：检测到原始文件 [${path.basename(originalPath)}] 的当前 SHA256 哈希值与干净备份不一致！\n这说明您的工作环境现场处于受损、盲改或未完全恢复的脏状态。\n为了防止对分析现场的二次污染，系统已锁死推进。请重新执行物理还原，或在确认修改合理时创建 run/hash_mismatch_authorized.flag 进行哈希豁免！\x1b[0m`);
            process.exit(1);
          }
        }
      }
    }
  }
}

function main() {
  const { taskRef, pauseCategory, pauseReason, json } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);

  // 物理守门人立体拦截门禁
  runComplianceCheck(taskDir);

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
