import fs from "node:fs";
import {
  ensureTaskRuntimeShape,
  nowIso,
  readTaskJson,
  taskFile,
  writeTaskJson
} from "./common.mjs";
import {
  applyRouteStateToTask,
  normalizeRouteStateDocument,
  readRouteStateDocument,
  syncMarkdownViews,
  writeRouteStateDocument
} from "./route-state.mjs";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

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

function upsertMarkdownSection(markdown, headingLine, body) {
  const source = String(markdown || "");
  const sections = splitMarkdownSections(source);
  const normalizedBody = String(body || "").trimEnd();
  const replacement = `${headingLine}\n\n${normalizedBody}\n`;

  for (const section of sections) {
    if (section.headingLine.trim() === headingLine.trim()) {
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

function syncCloseoutReport(taskDir, task, routeState, options = {}) {
  const reportPath = taskFile(taskDir, "report.md");
  if (!fs.existsSync(reportPath)) {
    return;
  }

  const summary = cleanText(options.summary) || "closeout 已完成，无需继续执行。";
  const phase = cleanText(task.phase) || cleanText(routeState.phase) || "Port";
  let report = fs.readFileSync(reportPath, "utf8");

  report = upsertMarkdownSection(
    report,
    "## 当前阶段",
    [`- 当前阶段：\`${phase}\``, "- 收尾状态：`completed`", "- 已完成 `closeout`。"].join("\n")
  );

  report = upsertMarkdownSection(
    report,
    "## 自动续跑决策",
    [
      "- 执行状态：`completed`",
      "- 暂停类别：`none`",
      "- 暂停原因：无",
      `- 下一可执行动作：\`${summary}\``
    ].join("\n")
  );

  report = upsertMarkdownSection(
    report,
    "## 下一步",
    ["- `closeout` 已完成，无需继续执行。", "- 若需继续深挖，请另开新路线或新任务。"].join("\n")
  );

  fs.writeFileSync(reportPath, report);
}

export function synchronizeCloseoutState(taskDir, taskInput, options = {}) {
  const completedAt = cleanText(options.completedAt) || nowIso();
  const summary = cleanText(options.summary) || "closeout 已完成，无需继续执行。";
  const task = ensureTaskRuntimeShape(taskInput ? structuredClone(taskInput) : readTaskJson(taskDir));
  const existingRouteState = readRouteStateDocument(taskDir, task);
  const routeState = normalizeRouteStateDocument(existingRouteState || {}, task);
  const previousActiveTracks = new Set((routeState.activeTracks || []).map((item) => cleanText(item)).filter(Boolean));
  const previousActiveEntrypoints = new Set(
    (routeState.activeEntrypoints || []).map((item) => cleanText(item)).filter(Boolean)
  );
  const nextEntrypointId = cleanText(routeState.execution?.nextEntrypointId);
  if (nextEntrypointId) {
    previousActiveEntrypoints.add(nextEntrypointId);
  }

  const completedTracks = new Set(previousActiveTracks);
  routeState.entrypoints = (routeState.entrypoints || []).map((entrypoint) => {
    const entrypointId = cleanText(entrypoint.id);
    if (!previousActiveEntrypoints.has(entrypointId)) {
      return entrypoint;
    }
    if (cleanText(entrypoint.targetTrack)) {
      completedTracks.add(cleanText(entrypoint.targetTrack));
    }
    return {
      ...entrypoint,
      status: "SUCCESS",
      resultSummary: cleanText(entrypoint.resultSummary) || summary,
      updatedAt: completedAt
    };
  });

  routeState.tracks = (routeState.tracks || []).map((track) => {
    const title = cleanText(track.title);
    if (!completedTracks.has(title)) {
      return track;
    }
    return {
      ...track,
      status: "DONE",
      nextStep: summary,
      updatedAt: completedAt
    };
  });

  routeState.syncStatus = "closeout-completed";
  routeState.activeTracks = [];
  routeState.activeEntrypoints = [];
  routeState.execution = {
    status: "completed",
    autoAdvanceEligible: false,
    pauseCategory: "none",
    pauseReason: "",
    nextEntrypointId: "",
    nextPhase: cleanText(task.phase) || cleanText(routeState.phase) || "Port",
    nextExecutableAction: "",
    summary,
    updatedAt: completedAt
  };
  routeState.updatedAt = completedAt;

  const persistedRouteState = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, persistedRouteState);
  applyRouteStateToTask(task, persistedRouteState);
  writeTaskJson(taskDir, task);
  syncCloseoutReport(taskDir, task, persistedRouteState, { summary });

  return {
    task,
    routeState: persistedRouteState
  };
}
