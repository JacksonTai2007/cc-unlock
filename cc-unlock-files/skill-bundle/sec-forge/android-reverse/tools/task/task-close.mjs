import fs from "node:fs";
import path from "node:path";
import {
  ensureTaskScaffold,
  ensureTaskRuntimeShape,
  ensureTaskWorkspaceBridges,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  skillRoot,
  taskFile,
  taskFileMatchesTemplate,
  templateTaskCoreDir,
  templateTaskDir,
  workspaceRoot,
  writeTaskJson
} from "./common.mjs";
import { synchronizeCloseoutState } from "./closeout-state.mjs";
import { applyRouteStateToTask, readRouteStateDocument, syncMarkdownViews } from "./route-state.mjs";
import { cleanupTaskArtifacts } from "./task-cleanup.mjs";
import { evaluateCloseoutGate, persistValidation, runFormalValidation } from "./validation.mjs";

const headingAliases = {
  current: [/^##\s*(?:当前阶段|当前进度|当前状态)\s*[：:]?\s*$/i],
  execution: [/^##\s*(?:自动续跑决策|续跑决策|Continuation Decision)\s*[：:]?\s*$/i],
  next: [/^##\s*(?:下一步|后续动作|next step)\s*[：:]?\s*$/i],
  localRepro: [/^##\s*(?:本地复现交付|Local Reproduction Deliverables)\s*[：:]?\s*$/i],
  entrypoint: [/^##\s*(?:切入点循环|Entrypoint Loop)\s*[：:]?\s*$/i],
  artifacts: [/^##\s*(?:产物路径|Artifacts?)\s*[：:]?\s*$/i]
};

function splitMarkdownSections(markdown) {
  const source = String(markdown || "");
  const headings = Array.from(source.matchAll(/^##\s+.+$/gm));
  if (headings.length === 0) {
    return [];
  }

  return headings.map((match, index) => {
    const headingStart = match.index;
    const headingLine = match[0];
    const bodyStart = headingStart + headingLine.length + (source[headingStart + headingLine.length] === "\r" ? 2 : 1);
    const nextHeadingStart = index + 1 < headings.length ? headings[index + 1].index : source.length;
    return {
      headingStart,
      headingLine,
      bodyStart,
      end: nextHeadingStart
    };
  });
}

function matchesHeading(headingLine, patterns) {
  const normalized = String(headingLine || "").trim();
  return patterns.some((pattern) => pattern.test(normalized));
}

function upsertMarkdownSection(markdown, patterns, canonicalHeading, body) {
  const source = String(markdown || "");
  const sections = splitMarkdownSections(source);
  const normalizedBody = String(body || "").trimEnd();
  const replacement = `${canonicalHeading}\n\n${normalizedBody}\n`;

  for (const section of sections) {
    if (matchesHeading(section.headingLine, patterns)) {
      return `${source.slice(0, section.headingStart)}${replacement}${
        source.slice(section.end).replace(/^\s*/, "\n")
      }`;
    }
  }

  if (!source.trim()) {
    return `${replacement}\n`;
  }

  return `${source.trimEnd()}\n\n${replacement}\n`;
}

function readJsonIfExists(taskDir, relPath) {
  const filePath = taskFile(taskDir, relPath);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function ensureReportExists(taskDir) {
  const reportPath = taskFile(taskDir, "report.md");
  if (fs.existsSync(reportPath)) {
    return;
  }

  const templatePath = taskFile(templateTaskDir, "report.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.copyFileSync(templatePath, reportPath);
}

function renderEntrypointLoopBody(routeState) {
  const entrypoints = routeState?.entrypoints || [];
  const candidateIds = entrypoints.map((entrypoint) => entrypoint.id).join(", ");
  const activeEntrypointId =
    routeState?.execution?.nextEntrypointId ||
    routeState?.activeEntrypoints?.[0] ||
    entrypoints[0]?.id ||
    "";
  const activeEntrypoint = entrypoints.find((entrypoint) => entrypoint.id === activeEntrypointId) || null;
  const latestRetro = (routeState?.retrospectives || []).slice(-1)[0] || null;

  return [
    `- 候选切入点: ${candidateIds}`,
    `- 本轮实际验证的切入点: ${activeEntrypointId}`,
    `- 为什么先试它: ${activeEntrypoint?.rationale || ""}`,
    `- 成功或失败的判据: ${[activeEntrypoint?.successCriteria, activeEntrypoint?.failureCriteria].filter(Boolean).join(" / ")}`,
    `- 切换理由 / 复盘: ${latestRetro?.summary || ""}`
  ].join("\n");
}

function renderLocalReproBody(taskDir, task) {
  const spec = readJsonIfExists(taskDir, "run/verification.spec.json");
  const result = readJsonIfExists(taskDir, "run/verification-result.json");
  const cases = Array.isArray(spec?.cases) ? spec.cases : [];
  const localCase = cases.find((item) => item?.role === "local-reproduction") || cases[0] || null;
  const apiCase = cases.find((item) => item?.role === "api-call") || null;
  const recordedCase = (result?.cases || []).find((item) => item?.id === localCase?.id) || null;
  const command = localCase
    ? [localCase.runner, localCase.entrypoint, ...(localCase.args || []).map((item) => JSON.stringify(item))].join(" ")
    : "(未声明；先填写 run/verification.spec.json)";
  const summary = result?.ok === true
    ? `验证通过，详见 run/verification-result.json（${result.cases?.length || 0} 个 case）`
    : "尚无通过且与当前产物哈希一致的验证结果";
  return [
    `- 本地算法实现: ${localCase?.entrypoint || "(未声明)"}`,
    `- 调用示例: ${localCase ? `run/verification.spec.json#${localCase.id}` : "(未声明)"}`,
    `- API 调用示例: ${task.deliveryRequirements?.apiCallExampleRequired === true ? (apiCase ? `run/verification.spec.json#${apiCase.id}` : "(未声明)") : "(不适用)"}`,
    `- 运行命令: ${command}`,
    `- 样例输入: ${localCase ? JSON.stringify(localCase.args || []) : "(未声明)"}`,
    `- 输出 / 响应摘要: ${summary}${recordedCase?.stdout ? `；stdout=${JSON.stringify(recordedCase.stdout.trim().slice(0, 160))}` : ""}`
  ].join("\n");
}

function renderArtifactsBody(taskDir, task) {
  const rel = (relPath) => relFromRepo(taskFile(taskDir, relPath), taskDir);

  return [
    `- report: ${rel("report.md")}`,
    `- fixtures: ${rel("run/fixtures.json")}`,
    `- route-state: ${rel(task.routeState.statePath)}`,
    `- route-plan: ${rel(task.routeState.planPath)}`,
    `- clues: ${rel(task.routeState.cluesPath)}`,
    `- progress: ${rel(task.routeState.progressPath)}`
  ].join("\n");
}

function autoFixCloseoutArtifacts(taskDir, task) {
  ensureReportExists(taskDir);
  const routeState = readRouteStateDocument(taskDir, task);

  if (routeState) {
    syncMarkdownViews(taskDir, task, routeState);
    applyRouteStateToTask(task, routeState);
    writeTaskJson(taskDir, task);
  }

  const reportPath = taskFile(taskDir, "report.md");
  let report = taskFileMatchesTemplate(taskDir, "report.md")
    ? "# 逆向报告\n"
    : fs.readFileSync(reportPath, "utf8");
  const execution = routeState?.execution || {};
  const nextAction = execution.nextExecutableAction || "";

  report = upsertMarkdownSection(
    report,
    headingAliases.current,
    "## 当前阶段",
    [`- 当前阶段：\`${task.phase}\``, `- 活跃切入点：${routeState?.activeEntrypoints?.join(", ") || ""}`].join("\n")
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.execution,
    "## 自动续跑决策",
    [
      `- 执行状态：\`${execution.status || task.routeState.executionStatus || "not-evaluated"}\``,
      `- 暂停类别: ${execution.pauseCategory || task.routeState.pauseCategory || "none"}`,
      `- 暂停原因: ${execution.pauseReason || task.routeState.pauseReason || ""}`,
      `- 下一可执行动作：\`${nextAction}\``
    ].join("\n")
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.next,
    "## 下一步",
    `- ${nextAction}`
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.artifacts,
    "## 产物路径",
    renderArtifactsBody(taskDir, task)
  );

  if ((routeState?.entrypoints || []).length > 1 || (routeState?.retrospectives || []).length > 0) {
    report = upsertMarkdownSection(
      report,
      headingAliases.entrypoint,
      "## 切入点循环",
      renderEntrypointLoopBody(routeState)
    );
  }

  if (task.deliveryRequirements?.localReproductionRequested === true) {
    report = upsertMarkdownSection(
      report,
      headingAliases.localRepro,
      "## 本地复现交付",
      renderLocalReproBody(taskDir, task)
    );
  }

  fs.writeFileSync(reportPath, report);
}

function printValidationWarnings(prefix, warnings) {
  for (const warning of warnings || []) {
    console.warn(`${prefix}: WARNING - ${warning}`);
  }
}

async function main() {
  const taskRef = process.argv[2];
  if (!taskRef) {
    console.error("usage: node tools/task/task-close.mjs <task-id|task-path>");
    process.exit(1);
  }

  const taskDir = resolveTaskDir(taskRef);
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  const taskSkillRoot = path.resolve(task.roots?.skillRoot || skillRoot);
  const taskWorkspaceRoot = path.resolve(task.roots?.workspaceRoot || workspaceRoot);
  process.env.ANDROID_REVERSE_SKILL_ROOT = taskSkillRoot;
  process.env.ANDROID_REVERSE_WORKSPACE_ROOT = taskWorkspaceRoot;

  const existingRouteState = readRouteStateDocument(taskDir, task);
  if (existingRouteState?.execution?.status === "completed") {
    const existingValidation = runFormalValidation(taskDir);
    const existingGate = evaluateCloseoutGate(taskDir);
    if (existingValidation.ok && existingGate.ok) {
      console.log(`task-close: already completed ${relFromRepo(taskDir)}`);
      return;
    }
  }

  ensureTaskScaffold(taskDir, task);
  ensureTaskWorkspaceBridges(taskDir, task);
  writeTaskJson(taskDir, task);
  autoFixCloseoutArtifacts(taskDir, task);

  const validationResult = runFormalValidation(taskDir);
  persistValidation(taskDir, validationResult);
  printValidationWarnings("verify-once", validationResult.warnings);
  if (!validationResult.ok) {
    console.error("verify-once: FAILED");
    for (const finding of validationResult.errors || validationResult.findings || []) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
  }
  console.log("verify-once: passed");

  const gate = evaluateCloseoutGate(taskDir);
  printValidationWarnings("closeout", gate.warnings);
  if (!gate.ok) {
    console.error("closeout: FAILED");
    for (const finding of gate.errors || gate.findings || []) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
  }

  const updatedTask = ensureTaskRuntimeShape(readTaskJson(taskDir));
  const rollbackFiles = [
    "task.json",
    "report.md",
    "state/route-state.json",
    "state/route-plan.md",
    "state/progress.md",
    "state/clues.md"
  ].map((relPath) => ({
    relPath,
    content: fs.existsSync(taskFile(taskDir, relPath)) ? fs.readFileSync(taskFile(taskDir, relPath)) : null
  }));
  synchronizeCloseoutState(taskDir, updatedTask);

  const finalValidation = runFormalValidation(taskDir);
  persistValidation(taskDir, finalValidation);
  const finalGate = evaluateCloseoutGate(taskDir);
  if (!finalValidation.ok || !finalGate.ok) {
    for (const snapshot of rollbackFiles) {
      const filePath = taskFile(taskDir, snapshot.relPath);
      if (snapshot.content == null) {
        fs.rmSync(filePath, { force: true });
      } else {
        fs.writeFileSync(filePath, snapshot.content);
      }
    }
    console.error("task-close: final persisted state failed validation; closeout was rolled back");
    for (const finding of [...(finalValidation.errors || []), ...(finalGate.errors || [])]) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
  }

  const removed = cleanupTaskArtifacts(taskDir);
  for (const relPath of removed) {
    console.log(`[cleanup] removed ${relPath}`);
  }

  console.log(`task-close: completed ${relFromRepo(taskDir)}`);
}

await main();
