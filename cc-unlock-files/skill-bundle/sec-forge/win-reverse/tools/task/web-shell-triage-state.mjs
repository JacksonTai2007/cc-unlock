import {
  exists,
  readJsonFile,
  safeReadText,
  taskFile,
  taskFileMatchesTemplate,
  writeJsonFile,
  writeTextFile
} from "./common.mjs";
import { detect as detectWebShellTech } from "./detect-web-shell-tech.mjs";
import {
  buildRuntimeSpecificNextSteps,
  describeWebShellRouting,
  inferDownstreamTopicsFromWebShellResult,
  topWebShellKeys
} from "./web-shell-routing.mjs";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
    )
  );
}

function topScoredLabel(values = []) {
  const first = Array.isArray(values) ? values[0] : null;
  if (!first) {
    return "";
  }
  if (typeof first === "string") {
    return first;
  }
  return cleanText(first.key);
}

function toScoredKeys(values = []) {
  return uniqStrings(values).map((key, index, items) => ({
    key,
    score: Math.max(1, items.length - index)
  }));
}

function synthesizeResultFromTask(task) {
  const triage = task?.webShellTriage || {};
  const looksLikeWebShell =
    triage.present === true &&
    cleanText(triage.status) !== "scanned-no-hit";

  return {
    scannedRoot:
      cleanText(task?.targetContext?.targetBinaryPath) ||
      cleanText(task?.targetContext?.inputTarget) ||
      "",
    summary: {
      looksLikeWebShell,
      confidence: looksLikeWebShell ? "derived-from-task-state" : "not-applicable",
      probableRuntimes: toScoredKeys(triage.probableRuntimes || []),
      probableFrontend: toScoredKeys(triage.probableFrontend || []),
      probablePackagers: toScoredKeys(triage.probablePackagers || [])
    },
    entryHints: uniqStrings(triage.entryHints || []),
    recommendedNextSteps: uniqStrings([
      cleanText(triage.downstreamSummary)
    ])
  };
}

export function readWebShellTechResult(taskDir) {
  const relPath = "run/web-shell-tech.json";
  const fullPath = taskFile(taskDir, relPath);
  if (!exists(fullPath) || taskFileMatchesTemplate(taskDir, relPath)) {
    return null;
  }

  try {
    return readJsonFile(fullPath);
  } catch {
    return null;
  }
}

export function webShellTechLooksMeaningful(result) {
  if (!result || typeof result !== "object") {
    return false;
  }
  return Boolean(
    result.summary?.looksLikeWebShell === true ||
    (result.summary?.probableRuntimes || []).length > 0 ||
    (result.summary?.probableFrontend || []).length > 0 ||
    (result.summary?.probablePackagers || []).length > 0 ||
    (result.entryHints || []).length > 0
  );
}

function pickBestResult(results = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const score = (result) => {
    const runtime = (result?.summary?.probableRuntimes || []).reduce((sum, item) => sum + Number(item?.score || 0), 0);
    const frontend = (result?.summary?.probableFrontend || []).reduce((sum, item) => sum + Number(item?.score || 0), 0);
    const packager = (result?.summary?.probablePackagers || []).reduce((sum, item) => sum + Number(item?.score || 0), 0);
    return runtime + frontend + packager + (result?.summary?.looksLikeWebShell ? 100 : 0);
  };

  return [...results].sort((left, right) => score(right) - score(left))[0] || null;
}

function taskHasWebShellTopic(task) {
  return (
    (task.taskPacks?.selectedTopics || []).includes("web-shell-triage") ||
    (task.taskPacks?.explicitTopics || []).includes("web-shell-triage") ||
    task.webShellTriage?.present === true
  );
}

function collectAutoDetectionCandidates(task) {
  const candidates = [];
  const pushIfPresent = (value) => {
    const text = cleanText(value);
    if (!text) {
      return;
    }
    if (!exists(text)) {
      return;
    }
    candidates.push(text);
  };

  pushIfPresent(task.targetContext?.targetBinaryPath);
  pushIfPresent(task.targetContext?.inputTarget);

  for (const value of task.targetContext?.samplePaths || []) {
    pushIfPresent(value);
  }

  return uniqStrings(candidates);
}

export function autoDetectWebShellTechFromTaskContext(taskDir, task, options = {}) {
  const existing = readWebShellTechResult(taskDir);
  if (existing && !taskFileMatchesTemplate(taskDir, "run/web-shell-tech.json")) {
    return {
      result: existing,
      source: "existing"
    };
  }

  const candidates = collectAutoDetectionCandidates(task);
  if (candidates.length === 0) {
    return {
      result: null,
      source: "no-local-target-path"
    };
  }

  const results = [];
  for (const candidate of candidates.slice(0, 3)) {
    try {
      results.push(
        detectWebShellTech(candidate, {
          maxDepth: options.maxDepth || 4,
          maxFiles: options.maxFiles || 6000,
          maxReadBytes: options.maxReadBytes || 256 * 1024
        })
      );
    } catch {
      // ignore scan failures and continue probing other candidates
    }
  }

  const best = pickBestResult(results);
  if (!best) {
    return {
      result: null,
      source: "scan-failed"
    };
  }

  const shouldPersist = webShellTechLooksMeaningful(best) || taskHasWebShellTopic(task);
  if (!shouldPersist) {
    return {
      result: best,
      source: "auto-scan-no-hit"
    };
  }

  writeJsonFile(taskFile(taskDir, "run/web-shell-tech.json"), best);
  return {
    result: best,
    source: "auto-scan"
  };
}

function renderWebShellNotes(result) {
  const runtime = topWebShellKeys(result.summary?.probableRuntimes).join(", ");
  const frontend = topWebShellKeys(result.summary?.probableFrontend).join(", ");
  const packager = topWebShellKeys(result.summary?.probablePackagers).join(", ");
  const entryHints = uniqStrings(result.entryHints || []).slice(0, 8).join(", ");
  const routing = describeWebShellRouting(result);
  const nextStep = cleanText(routing.nextAction || (result.recommendedNextSteps || [])[0]);
  const downstreamTopics = routing.downstreamTopics.join(", ");

  return [
    "# Web Shell / WebView Notes",
    "",
    `- 安装目录 / 样本根目录：${cleanText(result.scannedRoot)}`,
    `- wrapper/runtime 候选：${runtime || ""}`,
    `- 前端框架候选：${frontend || ""}`,
    `- bundler / 打包方式候选：${packager || ""}`,
    `- 关键入口资源：${entryHints || ""}`,
    `- bridge / preload / host API 线索：${entryHints || ""}`,
    "- 与 native 宿主的交界点：待结合 preload / invoke / host object / 资源装载链继续确认",
    `- 自动分流 topic：${downstreamTopics || ""}`,
    `- 下一步更应转入的线路：${nextStep || ""}`,
    ""
  ].join("\n");
}

function ensureWebShellNotes(taskDir, result) {
  const relPath = "run/web-shell-notes.md";
  const fullPath = taskFile(taskDir, relPath);
  const shouldWrite =
    !exists(fullPath) ||
    taskFileMatchesTemplate(taskDir, relPath) ||
    cleanText(safeReadText(fullPath)) === "";

  if (!shouldWrite) {
    return;
  }

  writeTextFile(fullPath, renderWebShellNotes(result));
}

function ensureWebShellNextSteps(taskDir, result) {
  const relPath = "run/web-shell-next-steps.md";
  const fullPath = taskFile(taskDir, relPath);
  const shouldWrite =
    !exists(fullPath) ||
    taskFileMatchesTemplate(taskDir, relPath) ||
    cleanText(safeReadText(fullPath)) === "";

  if (!shouldWrite) {
    return;
  }

  writeTextFile(fullPath, buildRuntimeSpecificNextSteps(result));
}

function buildKeyFindings(result) {
  const findings = [];
  const runtime = topScoredLabel(result.summary?.probableRuntimes);
  const frontend = topScoredLabel(result.summary?.probableFrontend);
  const packager = topScoredLabel(result.summary?.probablePackagers);
  const entryHint = cleanText((result.entryHints || [])[0]);
  const downstreamTopics = inferDownstreamTopicsFromWebShellResult(result).filter((topic) => topic !== "web-shell-triage");

  if (runtime) {
    findings.push(`wrapper/runtime 候选：${runtime}`);
  }
  if (frontend) {
    findings.push(`前端框架候选：${frontend}`);
  }
  if (packager) {
    findings.push(`bundler 候选：${packager}`);
  }
  if (entryHint) {
    findings.push(`关键入口线索：${entryHint}`);
  }
  if (downstreamTopics.length > 0) {
    findings.push(`自动分流 topic：${downstreamTopics.join(", ")}`);
  }
  if (result.summary?.looksLikeWebShell === false && findings.length === 0) {
    findings.push("目录与二进制尚未发现高置信 Web 套壳证据");
  }

  return uniqStrings(findings);
}

function ensureTrackC(routeState, result) {
  const track = (routeState.tracks || []).find((item) => cleanText(item?.title) === "C");
  if (!track) {
    return;
  }
  const nextStep = cleanText((result?.recommendedNextSteps || [])[0]);
  if (webShellTechLooksMeaningful(result)) {
    track.status = "IN_PROGRESS";
    track.checkpoints = uniqStrings([
      ...(track.checkpoints || []),
      "wrapper/runtime",
      "入口资源"
    ]);
    if (nextStep) {
      track.nextStep = nextStep;
    }
    return;
  }

  track.status = track.status === "DONE" ? "DONE" : "PENDING";
  if (nextStep) {
    track.nextStep = nextStep;
  }
}

function ensureEntrypoint2(routeState, result) {
  const entrypoint = (routeState.entrypoints || []).find((item) => cleanText(item?.id).toUpperCase() === "EP-002");
  if (!entrypoint) {
    return;
  }

  entrypoint.boundTopics = uniqStrings([...(entrypoint.boundTopics || []), "web-shell-triage"]);
  entrypoint.evidenceRefs = uniqStrings([...(entrypoint.evidenceRefs || []), "run/web-shell-tech.json", "run/web-shell-notes.md"]);

  if (webShellTechLooksMeaningful(result)) {
    entrypoint.status = "SUCCESS";
    entrypoint.resultSummary = buildKeyFindings(result).join("；");
    const nextStep = cleanText(describeWebShellRouting(result).nextAction || (result?.recommendedNextSteps || [])[0]);
    if (nextStep) {
      entrypoint.nextOnSuccess = nextStep;
    }
    routeState.activeEntrypoints = uniqStrings(["EP-002", ...(routeState.activeEntrypoints || [])]).slice(0, 2);
    routeState.activeTracks = uniqStrings(["C", ...(routeState.activeTracks || [])]).slice(0, 2);
    return;
  }

  if (result) {
    entrypoint.status = "EXHAUSTED";
    entrypoint.resultSummary = "目录与二进制未发现可信 Web 套壳证据，应回到原生 PE/导入面与运行时装载链。";
  }
}

export function buildWebShellSuggestedAction(task) {
  const topicSelected = (task.taskPacks?.selectedTopics || []).includes("web-shell-triage");
  const topicPresent = task.webShellTriage?.present === true;
  if (!topicSelected && !topicPresent) {
    return "";
  }

  const status = cleanText(task.webShellTriage?.status || "not-started");
  const probableRuntime = cleanText((task.webShellTriage?.probableRuntimes || [])[0]);
  const probableFrontend = cleanText((task.webShellTriage?.probableFrontend || [])[0]);
  const probablePackager = cleanText((task.webShellTriage?.probablePackagers || [])[0]);
  const entryHint = cleanText((task.webShellTriage?.entryHints || [])[0]);
  const downstreamTopics = uniqStrings(task.webShellTriage?.downstreamTopics || []);
  const targetPath =
    cleanText(task.targetContext?.targetBinaryPath) ||
    cleanText(task.targetContext?.inputTarget) ||
    "<install-dir-or-binary>";

  if (!status || status === "not-started") {
    return `先执行 Web 套壳技术指纹扫描：node tools/task/detect-web-shell-tech.mjs ${targetPath} --output artifacts/tasks/${task.taskId}/run/web-shell-tech.json，然后把 wrapper/runtime、frontend、bundler、entry hints 回填到 run/web-shell-notes.md。`;
  }

  if (status === "fingerprinted" || status === "triaged") {
    const labels = uniqStrings([probableRuntime, probableFrontend, probablePackager]).join(" / ");
    const focus = cleanText(task.webShellTriage?.downstreamSummary) ||
      (entryHint
        ? `优先检查 ${entryHint}`
        : "优先检查主资源入口、bridge API 与网络/配置客户端");
    return `已完成 Web 套壳定性${labels ? `（${labels}）` : ""}，自动分流到 ${downstreamTopics.join(", ") || "后续子主线"}：${focus}`;
  }

  if (status === "scanned-no-hit") {
    return "Web 套壳探针未命中可信证据，回到原生 PE/导入面、运行时装载链和网络/配置主线继续推进。";
  }

  return "";
}

export function buildWebShellRuntimeTemplateReportBody(taskDir, task, routeState = null) {
  const selectedTopics = uniqStrings(task?.taskPacks?.selectedTopics || []);
  const triage = task?.webShellTriage || {};
  const status = cleanText(triage.status || "not-applicable");
  const hasArtifacts = [
    "run/web-shell-tech.json",
    "run/web-shell-notes.md",
    "run/web-shell-next-steps.md"
  ].some((relPath) => exists(taskFile(taskDir, relPath)));
  const applicable =
    selectedTopics.includes("web-shell-triage") ||
    triage.present === true ||
    hasArtifacts;

  if (!applicable) {
    return [
      "- 状态：`not-applicable`",
      "- 说明：当前任务未命中 Web 套壳 / WebView runtime 专用分流，无需生成专用后续动作模板摘要。",
      "- 关联产物：无"
    ].join("\n");
  }

  const result = readWebShellTechResult(taskDir) || synthesizeResultFromTask(task);
  const routing = describeWebShellRouting(result);
  const runtime = topWebShellKeys(result.summary?.probableRuntimes).join(", ");
  const frontend = topWebShellKeys(result.summary?.probableFrontend).join(", ");
  const packager = topWebShellKeys(result.summary?.probablePackagers).join(", ");
  const entryHints = uniqStrings(result.entryHints || []).slice(0, 8);
  const downstreamTopics = uniqStrings(
    triage.downstreamTopics?.length > 0
      ? triage.downstreamTopics
      : routing.downstreamTopics || []
  );
  const nextAction = cleanText(routeState?.execution?.nextExecutableAction) ||
    cleanText(buildWebShellSuggestedAction(task)) ||
    cleanText(triage.downstreamSummary) ||
    cleanText(routing.nextAction);
  const artifactRefs = [
    "run/web-shell-tech.json",
    "run/web-shell-notes.md",
    "run/web-shell-next-steps.md"
  ].filter((relPath) => exists(taskFile(taskDir, relPath)));
  const lines = [
    `- 状态：\`${status || "not-applicable"}\``,
    `- 运行时画像：\`${cleanText(routing.profile || "generic-web-shell")}\``,
    `- wrapper/runtime 候选：${runtime || "未判定"}`,
    `- 前端框架候选：${frontend || "未判定"}`,
    `- bundler / 打包方式候选：${packager || "未判定"}`,
    `- 关键入口线索：${entryHints.join(", ") || "未记录"}`,
    `- 自动分流 topic：${downstreamTopics.join(", ") || "未分流"}`,
    `- 摘要动作：${nextAction || "待补充"}`
  ];

  if (artifactRefs.length === 0) {
    lines.push("- 关联产物：无");
  } else {
    lines.push("- 关联产物：");
    for (const relPath of artifactRefs) {
      lines.push(`  - \`${relPath}\``);
    }
  }

  return lines.join("\n");
}

export function applyWebShellTechResultToTask(taskDir, task, routeState = null) {
  const result = readWebShellTechResult(taskDir);
  if (!task.webShellTriage) {
    return {
      task,
      routeState,
      result: null
    };
  }

  if (!result) {
    return {
      task,
      routeState,
      result: null
    };
  }

  const meaningful = webShellTechLooksMeaningful(result);
  task.webShellTriage.present = true;
  task.webShellTriage.status = meaningful ? "fingerprinted" : "scanned-no-hit";
  task.webShellTriage.keyFindings = buildKeyFindings(result);
  const routing = describeWebShellRouting(result);
  task.webShellTriage.notes = uniqStrings([
    ...(task.webShellTriage.notes || []),
    `confidence=${cleanText(result.summary?.confidence || "unknown")}`,
    `scannedRoot=${cleanText(result.scannedRoot)}`
  ]);
  task.webShellTriage.probableRuntimes = topWebShellKeys(result.summary?.probableRuntimes);
  task.webShellTriage.probableFrontend = topWebShellKeys(result.summary?.probableFrontend);
  task.webShellTriage.probablePackagers = topWebShellKeys(result.summary?.probablePackagers);
  task.webShellTriage.entryHints = uniqStrings(result.entryHints || []).slice(0, 24);
  task.webShellTriage.downstreamTopics = uniqStrings(routing.downstreamTopics || []);
  task.webShellTriage.downstreamSummary = cleanText(routing.nextAction);
  task.webShellTriage.artifacts = uniqStrings([
    ...(task.webShellTriage.artifacts || []),
    "run/web-shell-notes.md",
    "run/web-shell-tech.json"
    ,
    "run/web-shell-next-steps.md"
  ]);

  task.targetContext ||= {};
  task.targetContext.targetKeywords = uniqStrings([
    ...(task.targetContext.targetKeywords || []),
    ...task.webShellTriage.probableRuntimes,
    ...task.webShellTriage.probableFrontend,
    ...task.webShellTriage.probablePackagers,
    ...task.webShellTriage.downstreamTopics
  ]);

  ensureWebShellNotes(taskDir, result);
  ensureWebShellNextSteps(taskDir, result);

  if (routeState) {
    ensureTrackC(routeState, result);
    ensureEntrypoint2(routeState, result);
  }

  return {
    task,
    routeState,
    result
  };
}
