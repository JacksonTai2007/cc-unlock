import fs from "node:fs";
import {
  ensureDir,
  normalizeNewlines,
  nowIso,
  safeReadText,
  taskFile,
  templateTaskDir
} from "./common.mjs";
import {
  buildWebShellRuntimeTemplateReportBody,
  buildWebShellSuggestedAction
} from "./web-shell-triage-state.mjs";

export const routeStateSchemaVersion = 2;

const defaultTrackStatus = "PENDING";
const validStatuses = new Set(["PENDING", "IN_PROGRESS", "BLOCKED", "DONE"]);
const defaultEntrypointStatus = "CANDIDATE";
const validEntrypointStatuses = new Set([
  "CANDIDATE",
  "PROBING",
  "EXPANDED",
  "PARKED",
  "EXHAUSTED",
  "SUCCESS"
]);
const defaultExecutionStatus = "not-evaluated";
const validExecutionStatuses = new Set([
  "not-evaluated",
  "ready-to-continue",
  "needs-route-rebuild",
  "needs-retrospective",
  "blocked-on-user",
  "blocked-on-risk",
  "completed"
]);
const defaultPauseCategory = "none";
const validPauseCategories = new Set(["none", "user", "risk", "internal"]);
const reportRuntimeTemplateHeadingPatterns = [
  /^##\s*(?:Runtime 专用后续动作模板摘要|Web 套壳技术路线摘要|Runtime Template Summary)\s*[：:]?\s*$/i
];
const reportRuntimeTemplateHeadingCanonical = "## Runtime 专用后续动作模板摘要";
const maxEntrypointsInWorkingSet = 5;
const maxRetrospectivesInWorkingSet = 5;
const validVmTriageResults = new Set([
  "not-applicable",
  "not-started",
  "blackbox",
  "deep-analysis"
]);

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

function normalizeTrackStatus(value) {
  const text = cleanText(value).toUpperCase();
  const map = new Map([
    ["ACTIVE", "IN_PROGRESS"],
    ["IN-PROGRESS", "IN_PROGRESS"],
    ["IN_PROGRESS", "IN_PROGRESS"],
    ["BLOCKED", "BLOCKED"],
    ["DONE", "DONE"],
    ["COMPLETED", "DONE"],
    ["SUCCESS", "DONE"],
    ["PENDING", "PENDING"],
    ["TODO", "PENDING"]
  ]);
  return map.get(text) || (validStatuses.has(text) ? text : defaultTrackStatus);
}

function normalizeEntrypointStatus(value) {
  const text = cleanText(value).toUpperCase();
  const map = new Map([
    ["ACTIVE", "PROBING"],
    ["PROBING", "PROBING"],
    ["EXPANDED", "EXPANDED"],
    ["PARKED", "PARKED"],
    ["EXHAUSTED", "EXHAUSTED"],
    ["DONE", "SUCCESS"],
    ["COMPLETED", "SUCCESS"],
    ["SUCCESS", "SUCCESS"],
    ["CANDIDATE", "CANDIDATE"],
    ["TODO", "CANDIDATE"]
  ]);
  return map.get(text) || (validEntrypointStatuses.has(text) ? text : defaultEntrypointStatus);
}

function normalizeExecutionStatusValue(value) {
  const text = cleanText(value);
  const lowered = text.toLowerCase();
  const map = new Map([
    ["done", "completed"],
    ["complete", "completed"],
    ["completed", "completed"],
    ["ready", "ready-to-continue"],
    ["active", "ready-to-continue"],
    ["continue", "ready-to-continue"],
    ["paused-user", "blocked-on-user"],
    ["paused-risk", "blocked-on-risk"]
  ]);
  return map.get(lowered) || (validExecutionStatuses.has(text) ? text : defaultExecutionStatus);
}

function uniq(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
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

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function toTrackId(title, fallback = "track") {
  const normalized = cleanText(title)
    .toLowerCase()
    .replace(/[`*#]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function parseLabeledValue(block, labels) {
  for (const label of labels) {
    const match = new RegExp(`^-\\s*${label}:[^\\S\\r\\n]*(.*)$`, "gim").exec(String(block || ""));
    if (match) {
      return cleanText(match[1]);
    }
  }
  return "";
}

function parseCheckpoints(value) {
  const text = cleanText(value);
  if (!text || text === "-" || text === "—" || text === "未记录" || text === "none") {
    return [];
  }
  return uniq(
    text
      .split(/[;,，；]/)
      .map((item) => cleanText(item))
      .filter(Boolean)
  );
}

function normalizeTrack(track, index) {
  const title = cleanText(track?.title || track?.name || track?.track || track?.id || `线路 ${index + 1}`);
  return {
    id: cleanText(track?.id) || toTrackId(title, `track-${index + 1}`),
    title,
    target: cleanText(track?.target),
    inputs: cleanText(track?.inputs),
    output: cleanText(track?.output),
    priority: cleanText(track?.priority),
    checkpoints: ensureArray(track?.checkpoints).map((item) => cleanText(item)).filter(Boolean),
    status: normalizeTrackStatus(track?.status),
    nextStep: cleanText(track?.nextStep),
    updatedAt: cleanText(track?.updatedAt)
  };
}

function normalizeEntrypoint(entrypoint, index) {
  const title = cleanText(
    entrypoint?.title || entrypoint?.name || entrypoint?.hypothesis || entrypoint?.id || `切入点 ${index + 1}`
  );
  return {
    id: cleanText(entrypoint?.id) || `EP-${String(index + 1).padStart(3, "0")}`,
    title,
    hypothesis: cleanText(entrypoint?.hypothesis),
    boundTopics: uniq(ensureArray(entrypoint?.boundTopics).map((item) => cleanText(item))),
    targetTrack: cleanText(entrypoint?.targetTrack),
    rationale: cleanText(entrypoint?.rationale),
    cost: cleanText(entrypoint?.cost),
    expectedGain: cleanText(entrypoint?.expectedGain),
    probe: cleanText(entrypoint?.probe),
    successCriteria: cleanText(entrypoint?.successCriteria),
    failureCriteria: cleanText(entrypoint?.failureCriteria),
    status: normalizeEntrypointStatus(entrypoint?.status),
    resultSummary: cleanText(entrypoint?.resultSummary),
    evidenceRefs: uniq(ensureArray(entrypoint?.evidenceRefs).map((item) => cleanText(item))),
    nextOnSuccess: cleanText(entrypoint?.nextOnSuccess),
    nextOnFailure: cleanText(entrypoint?.nextOnFailure),
    updatedAt: cleanText(entrypoint?.updatedAt)
  };
}

function normalizeRetrospective(retrospective, index) {
  return {
    id: cleanText(retrospective?.id) || `RETRO-${String(index + 1).padStart(3, "0")}`,
    triggeredByEntrypoints: uniq(
      ensureArray(retrospective?.triggeredByEntrypoints).map((item) => cleanText(item))
    ),
    summary: cleanText(retrospective?.summary),
    failedBecause: cleanText(retrospective?.failedBecause),
    newEntrypoints: uniq(ensureArray(retrospective?.newEntrypoints).map((item) => cleanText(item))),
    decision: cleanText(retrospective?.decision),
    nextFocus: cleanText(retrospective?.nextFocus),
    createdAt: cleanText(retrospective?.createdAt)
  };
}

function normalizeClue(clue, index) {
  return {
    id: cleanText(clue?.id) || `CLUE-${String(index + 1).padStart(3, "0")}`,
    sourceTrack: cleanText(clue?.sourceTrack),
    sourceEntrypoint: cleanText(clue?.sourceEntrypoint),
    discoveredAt: cleanText(clue?.discoveredAt),
    content: cleanText(clue?.content),
    verification: cleanText(clue?.verification),
    impact: cleanText(clue?.impact),
    action: cleanText(clue?.action),
    confidence: cleanText(clue?.confidence)
  };
}

function normalizeExecutionState(execution, task = {}) {
  return {
    status: normalizeExecutionStatusValue(execution?.status),
    autoAdvanceEligible: execution?.autoAdvanceEligible === true,
    pauseCategory: validPauseCategories.has(cleanText(execution?.pauseCategory))
      ? cleanText(execution?.pauseCategory)
      : defaultPauseCategory,
    pauseReason: cleanText(execution?.pauseReason),
    nextEntrypointId: cleanText(execution?.nextEntrypointId),
    nextPhase: cleanText(execution?.nextPhase) || cleanText(task.phase) || "Observe",
    nextExecutableAction: cleanText(execution?.nextExecutableAction),
    summary: cleanText(execution?.summary),
    updatedAt: cleanText(execution?.updatedAt)
  };
}

function normalizeVmTriage(vmTriage, task = {}) {
  const taskVm = task.vm || {};
  const rawResult = cleanText(vmTriage?.triageResult || taskVm.triageResult);
  const triageResult = validVmTriageResults.has(rawResult)
    ? rawResult
    : taskVm.present === true
      ? "not-started"
      : "not-applicable";

  return {
    triageResult,
    blackboxApi: cleanText(vmTriage?.blackboxApi || taskVm.blackboxApi),
    rationale: cleanText(vmTriage?.rationale || taskVm.triageReason),
    notes: uniq(
      ensureArray(vmTriage?.notes ?? taskVm.triageNotes)
        .map((item) => cleanText(item))
        .filter(Boolean)
    ),
    updatedAt: cleanText(vmTriage?.updatedAt)
  };
}

function defaultTracks() {
  return [
    normalizeTrack(
      {
        title: "A",
        target: "原生入口 / PE 头 / 节区 / 导入 / 资源分诊",
        inputs: "目标 EXE/DLL/SYS、基础文件信息、导入面、资源面",
        output: "先判断是否继续进入 static-triage / dotnet / driver / packer-unpack",
        priority: "high",
        checkpoints: ["PE 头", "入口点", "导入面", "资源面"],
        nextStep: "A1 静态入口与导入面分诊"
      },
      0
    ),
    normalizeTrack(
      {
        title: "B",
        target: "保护 / 装载 / 异常 / 运行时控制链分诊",
        inputs: "壳迹象、异常链、线程/模块加载、反分析信号",
        output: "先判断是否继续进入 anti-analysis / loader-injection / exception-runtime / memory-forensics",
        priority: "high",
        checkpoints: ["壳迹象", "异常门", "装载链", "运行时保护"],
        nextStep: "B1 保护与运行时路径探针"
      },
      1
    ),
    normalizeTrack(
      {
        title: "C",
        target: "Web 套壳 / WebView / 前端技术路线指纹",
        inputs: "安装目录、资源目录、JS/HTML 包、PE 依赖、运行时字符串",
        output: "快速确定 wrapper/runtime、前端框架、bundler，并给出后续入口线索",
        priority: "high",
        checkpoints: ["wrapper/runtime", "前端框架", "bundler", "入口资源"],
        nextStep: "C1 安装目录与二进制技术指纹扫描"
      },
      2
    )
  ];
}

function defaultClues() {
  return [normalizeClue({ id: "CLUE-001" }, 0)];
}

function defaultExecutionState(task = {}) {
  return normalizeExecutionState(
    {
      status: "ready-to-continue",
      autoAdvanceEligible: true,
      pauseCategory: "none",
      pauseReason: "",
      nextEntrypointId: "EP-001",
      nextPhase: cleanText(task.phase) || "Observe",
      nextExecutableAction:
        "执行 EP-001 的最小 probe：做一次最小观测，确认当前主阻塞更像 PE 分诊、壳、反分析、.NET、驱动或网络链路问题。",
      summary: "恢复或初始化完成后不能停在状态汇报；当前应直接执行 EP-001 的最小 probe。"
    },
    task
  );
}

function defaultEntrypoints() {
  return [
    normalizeEntrypoint(
      {
        id: "EP-001",
        title: "先做最小成本分诊",
        hypothesis: "先用一个最便宜的观察性探针判断当前主阻塞更像 PE 分诊、壳、反分析、.NET、驱动、网络链路，还是 Web 套壳 / WebView 技术路线问题。",
        boundTopics: [],
        targetTrack: "A",
        rationale: "复合场景先做中性分诊，避免一开始就把某个 topic 误当成唯一主线。",
        cost: "low",
        expectedGain: "high",
        probe: "做一次最小观测：PE/导入分诊、字符串/导入表交叉引用分析、内存保护变化观察、安装目录 Web 套壳技术指纹扫描 四选一，先确认下一刀切在哪条链路。",
        successCriteria: "能明确缩窄主阻塞点，或激活下一条更高价值的切入点。",
        failureCriteria: "没有带来新的可执行分歧，且不能支持下一步判断。",
        status: "CANDIDATE",
        nextOnSuccess: "扩展该切入点并绑定更具体的 topic。",
        nextOnFailure: "切到下一个候选切入点。",
        updatedAt: ""
      },
      0
    ),
    normalizeEntrypoint(
      {
        id: "EP-002",
        title: "判定是否为 Web 套壳 / WebView 应用",
        hypothesis: "若安装目录携带大量 JS/HTML/asar/pak/前端资源，目标可能是 Electron / CEF / WebView2 / Tauri / Wails / NW.js 等套壳应用，先判定技术路线可显著缩短后续定位路径。",
        boundTopics: ["web-shell-triage"],
        targetTrack: "C",
        rationale: "很多 Windows EXE 本质是 Web 应用套壳；先做 wrapper/runtime 指纹识别，比直接深挖 IDA 更快收敛到主资源、桥接层和 API 入口。",
        cost: "low",
        expectedGain: "high",
        probe: "扫描安装目录、资源目录、PE 依赖和二进制字符串：优先识别 Electron / CEF / WebView2 / Tauri / Wails / NW.js / Qt WebEngine / Neutralino / Flutter Web 资产，并记录前端框架与 bundler 线索。",
        successCriteria: "至少得到一个高置信 wrapper/runtime 候选，或定位到 package.json / app.asar / index.html / preload.js / WebView2Loader.dll / libcef.dll 等关键入口。",
        failureCriteria: "目录与二进制都未提供可信 Web 套壳证据，且不能缩窄到任何 wrapper/runtime 候选。",
        status: "CANDIDATE",
        nextOnSuccess: "转入对应入口：asar/package.json/HTML/bridge API/网络 client/配置文件。",
        nextOnFailure: "回到原生 PE/导入面和运行时装载链继续分诊。",
        updatedAt: ""
      },
      1
    )
  ];
}

function defaultRetrospectives() {
  return [];
}

function mergeTracks(routeTracks, progressRows) {
  const map = new Map(routeTracks.map((track) => [track.title.toLowerCase(), track]));
  for (const row of progressRows) {
    const key = cleanText(row.track).toLowerCase();
    const track = map.get(key) || normalizeTrack({ title: row.track }, map.size);
    track.status = validStatuses.has(row.status) ? row.status : defaultTrackStatus;
    track.checkpoints = parseCheckpoints(row.checkpoints);
    track.nextStep = cleanText(row.nextStep);
    map.set(key, track);
  }
  return Array.from(map.values());
}

function entrypointRecoveredMeaningfully(entrypoint) {
  return Boolean(
    cleanText(entrypoint?.hypothesis) ||
    cleanText(entrypoint?.rationale) ||
    cleanText(entrypoint?.probe) ||
    cleanText(entrypoint?.successCriteria) ||
    cleanText(entrypoint?.failureCriteria) ||
    cleanText(entrypoint?.resultSummary)
  );
}

function collectHeadingSections(text, headingPattern) {
  const source = String(text || "");
  const matches = Array.from(source.matchAll(headingPattern));
  return matches.map((match, index) => {
    const headingEnd = match.index + match[0].length;
    let bodyStart = headingEnd;
    if (source.slice(bodyStart, bodyStart + 2) === "\r\n") {
      bodyStart += 2;
    } else if (source[bodyStart] === "\n") {
      bodyStart += 1;
    }
    const nextStart = index + 1 < matches.length ? matches[index + 1].index : source.length;
    return {
      match,
      body: source.slice(bodyStart, nextStart).trimEnd()
    };
  });
}

export function parseRoutePlan(routePlanText) {
  return Array.from(String(routePlanText || "").matchAll(/^###\s+(.+)$/gm)).map((match) => match[1].trim());
}

export function parseProgress(progressText) {
  const rows = [];
  for (const line of String(progressText || "").split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) {
      continue;
    }
    if (cells[0] === "线路" || cells[0] === "Track" || cells[0] === "---") {
      continue;
    }
    if (cells[1] && validStatuses.has(cells[1])) {
      rows.push({
        track: cells[0],
        status: cells[1],
        checkpoints: cells[2],
        nextStep: cells[3]
      });
    }
  }
  return rows;
}

export function parseRoutePlanMarkdown(routePlanText) {
  const sections = collectHeadingSections(routePlanText, /^###\s+(.+)$/gm);
  return sections.map(({ match, body }, index) =>
    normalizeTrack(
      {
        id: toTrackId(match[1], `track-${index + 1}`),
        title: cleanText(match[1]),
        target: parseLabeledValue(body, ["目标", "Target"]),
        inputs: parseLabeledValue(body, ["输入依赖", "Inputs"]),
        output: parseLabeledValue(body, ["输出格式", "Output"]),
        priority: parseLabeledValue(body, ["优先级", "Priority"]),
        checkpoints: parseCheckpoints(parseLabeledValue(body, ["检查点", "Checkpoints"]))
      },
      index
    )
  );
}

export function parseCluesMarkdown(cluesText) {
  const sections = collectHeadingSections(cluesText, /^##\s+(CLUE-\d+)$/gm);
  return sections.map(({ match, body }, index) =>
    normalizeClue(
      {
        id: cleanText(match[1]),
        sourceTrack: parseLabeledValue(body, ["来源线路", "Source Track"]),
        sourceEntrypoint: parseLabeledValue(body, ["来源切入点", "Source Entrypoint"]),
        discoveredAt: parseLabeledValue(body, ["发现时间", "Discovered At"]),
        content: parseLabeledValue(body, ["线索内容", "Content"]),
        verification: parseLabeledValue(body, ["验证方式", "Verification"]),
        impact: parseLabeledValue(body, ["影响范围", "Impact"]),
        action: parseLabeledValue(body, ["行动建议", "Action"]),
        confidence: parseLabeledValue(body, ["置信度", "Confidence"])
      },
      index
    )
  );
}

export function parseEntrypointsMarkdown(routePlanText) {
  const sections = collectHeadingSections(routePlanText, /^####\s+(EP-\d+)\s+(.+)$/gm);
  return sections.map(({ match, body }, index) =>
    normalizeEntrypoint(
      {
        id: cleanText(match[1]),
        title: cleanText(match[2]),
        hypothesis: parseLabeledValue(body, ["假设", "Hypothesis"]),
        boundTopics: parseCheckpoints(parseLabeledValue(body, ["关联专题", "Bound Topics"])),
        targetTrack: parseLabeledValue(body, ["对应线路", "Target Track"]),
        rationale: parseLabeledValue(body, ["选择理由", "Rationale"]),
        cost: parseLabeledValue(body, ["启动成本", "Cost"]),
        expectedGain: parseLabeledValue(body, ["预期收益", "Expected Gain"]),
        probe: parseLabeledValue(body, ["最小探针", "Probe"]),
        successCriteria: parseLabeledValue(body, ["成功判据", "Success Criteria"]),
        failureCriteria: parseLabeledValue(body, ["失败判据", "Failure Criteria"]),
        status: parseLabeledValue(body, ["当前状态", "Status"]),
        resultSummary: parseLabeledValue(body, ["当前结论", "Result Summary"]),
        nextOnSuccess: parseLabeledValue(body, ["成功后", "Next On Success"]),
        nextOnFailure: parseLabeledValue(body, ["失败后", "Next On Failure"]),
        updatedAt: parseLabeledValue(body, ["更新时间", "Updated At"])
      },
      index
    )
  );
}

export function parseRetrospectivesMarkdown(routePlanText) {
  const sections = collectHeadingSections(routePlanText, /^####\s+(RETRO-\d+)$/gm);
  return sections.map(({ match, body }, index) =>
    normalizeRetrospective(
      {
        id: cleanText(match[1]),
        triggeredByEntrypoints: parseCheckpoints(
          parseLabeledValue(body, ["触发切入点", "Triggered By Entrypoints"])
        ),
        summary: parseLabeledValue(body, ["复盘结论", "Summary"]),
        failedBecause: parseLabeledValue(body, ["失败原因", "Failed Because"]),
        newEntrypoints: parseCheckpoints(parseLabeledValue(body, ["新生切入点", "New Entrypoints"])),
        decision: parseLabeledValue(body, ["路线决策", "Decision"]),
        nextFocus: parseLabeledValue(body, ["下一焦点", "Next Focus"]),
        createdAt: parseLabeledValue(body, ["创建时间", "Created At"])
      },
      index
    )
  );
}

export function defaultRouteStateDocument(task = {}) {
  return {
    schemaVersion: routeStateSchemaVersion,
    updatedAt: nowIso(),
    taskId: cleanText(task.taskId),
    phase: cleanText(task.phase),
    syncStatus: cleanText(task.routeState?.syncStatus) || "not-started",
    activeTracks: uniq(ensureArray(task.routeState?.activeTracks).map((item) => cleanText(item))),
    activeEntrypoints: uniq(ensureArray(task.routeState?.activeEntrypoints).map((item) => cleanText(item))),
    vmTriage: normalizeVmTriage(task.routeState?.vmTriage, task),
    execution: defaultExecutionState(task),
    tracks: defaultTracks(),
    entrypoints: defaultEntrypoints(),
    retrospectives: defaultRetrospectives(),
    clues: defaultClues()
  };
}

export function normalizeRouteStateDocument(doc, task = {}) {
  const base = defaultRouteStateDocument(task);
  const tracks = (ensureArray(doc?.tracks).length > 0 ? ensureArray(doc?.tracks) : base.tracks).map((track, index) =>
    normalizeTrack(track, index)
  );
  const entrypoints = (ensureArray(doc?.entrypoints).length > 0 ? ensureArray(doc?.entrypoints) : base.entrypoints)
    .map((entrypoint, index) => normalizeEntrypoint(entrypoint, index))
    .slice(0, maxEntrypointsInWorkingSet);
  const retrospectives = (
    ensureArray(doc?.retrospectives).length > 0 ? ensureArray(doc?.retrospectives) : base.retrospectives
  )
    .map((retrospective, index) => normalizeRetrospective(retrospective, index))
    .slice(-maxRetrospectivesInWorkingSet);
  const clues = (ensureArray(doc?.clues).length > 0 ? ensureArray(doc?.clues) : base.clues).map((clue, index) =>
    normalizeClue(clue, index)
  );

  const inFlightTracks = tracks
    .filter((track) => track.status === "IN_PROGRESS" || track.status === "BLOCKED")
    .map((track) => track.title);
  const pendingTracks = tracks.filter((track) => track.status === "PENDING").map((track) => track.title);
  const explicitActiveTracks = Array.isArray(doc?.activeTracks)
    ? ensureArray(doc?.activeTracks).map((item) => cleanText(item))
    : null;
  const activeTracks = uniq(
    (explicitActiveTracks ?? ensureArray(task.routeState?.activeTracks).map((item) => cleanText(item)))
      .concat(inFlightTracks.length > 0 ? inFlightTracks : pendingTracks.slice(0, 1))
  );

  const explicitActiveEntrypoints = Array.isArray(doc?.activeEntrypoints)
    ? ensureArray(doc?.activeEntrypoints).map((item) => cleanText(item))
    : null;
  const activeEntrypoints = uniq(
    (explicitActiveEntrypoints ?? ensureArray(task.routeState?.activeEntrypoints).map((item) => cleanText(item)))
      .concat(
        entrypoints
          .filter((entrypoint) => entrypoint.status === "PROBING" || entrypoint.status === "EXPANDED")
          .map((entrypoint) => entrypoint.id)
      )
      .concat(
        entrypoints
          .filter((entrypoint) => entrypoint.status === "CANDIDATE")
          .slice(0, 1)
          .map((entrypoint) => entrypoint.id)
      )
  ).slice(0, 2);
  const execution = normalizeExecutionState(doc?.execution ?? base.execution, task);
  const vmTriage = normalizeVmTriage(doc?.vmTriage ?? base.vmTriage, task);

  return {
    schemaVersion: Number(doc?.schemaVersion) || routeStateSchemaVersion,
    updatedAt: cleanText(doc?.updatedAt) || nowIso(),
    taskId: cleanText(doc?.taskId) || cleanText(task.taskId),
    phase: cleanText(doc?.phase) || cleanText(task.phase),
    syncStatus: cleanText(doc?.syncStatus) || cleanText(task.routeState?.syncStatus) || "not-started",
    activeTracks,
    activeEntrypoints,
    vmTriage,
    execution,
    tracks,
    entrypoints,
    retrospectives,
    clues
  };
}

export function buildRouteStateFromMarkdown(taskDir, task = {}) {
  const routePlanText = safeReadText(taskFile(taskDir, task.routeState?.planPath || "state/route-plan.md"));
  const progressText = safeReadText(taskFile(taskDir, task.routeState?.progressPath || "state/progress.md"));
  const cluesText = safeReadText(taskFile(taskDir, task.routeState?.cluesPath || "state/clues.md"));

  const mergedTracks = mergeTracks(parseRoutePlanMarkdown(routePlanText), parseProgress(progressText));
  const clues = parseCluesMarkdown(cluesText);
  const entrypoints = parseEntrypointsMarkdown(routePlanText);
  const retrospectives = parseRetrospectivesMarkdown(routePlanText);

  const routePlanHasEntrypointMarkers = /EP-\d+/i.test(routePlanText) || /切入点|Entrypoint Loop/i.test(routePlanText);
  const routePlanHasRetroMarkers = /RETRO-\d+/i.test(routePlanText) || /复盘|Retrospectives/i.test(routePlanText);
  const missingEntrypoints = routePlanHasEntrypointMarkers && entrypoints.length === 0;
  const shallowEntrypoints =
    entrypoints.length > 0 && entrypoints.every((entrypoint) => !entrypointRecoveredMeaningfully(entrypoint));
  const missingRetrospectives = routePlanHasRetroMarkers && retrospectives.length === 0;

  return normalizeRouteStateDocument(
    {
      tracks: mergedTracks.length > 0 ? mergedTracks : defaultTracks(),
      clues: clues.length > 0 ? clues : defaultClues(),
      entrypoints: entrypoints.length > 0 ? entrypoints : defaultEntrypoints(),
      retrospectives: retrospectives.length > 0 ? retrospectives : defaultRetrospectives(),
      activeTracks: [],
      activeEntrypoints: [],
      syncStatus:
        missingEntrypoints || shallowEntrypoints || missingRetrospectives
          ? "backfilled-from-markdown-lossy"
          : "backfilled-from-markdown"
    },
    task
  );
}

export function readRouteStateDocument(taskDir, task = {}) {
  const relPath = task.routeState?.statePath || "state/route-state.json";
  const filePath = taskFile(taskDir, relPath);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return normalizeRouteStateDocument(JSON.parse(fs.readFileSync(filePath, "utf8")), task);
}

function findEntrypointById(routeState, entrypointId) {
  return (routeState.entrypoints || []).find((entrypoint) => cleanText(entrypoint.id) === cleanText(entrypointId)) || null;
}

function firstEntrypointWithStatuses(routeState, statuses) {
  return (routeState.entrypoints || []).find((entrypoint) => statuses.includes(cleanText(entrypoint.status))) || null;
}

export function resolveExecutionState(task, routeState) {
  const current = normalizeExecutionState(routeState?.execution, task);
  const nextPhase = cleanText(task.phase) || cleanText(routeState?.phase) || "Observe";
  const stamp = (execution) => normalizeExecutionState({ ...execution, updatedAt: nowIso() }, task);
  const allEntrypoints = ensureArray(routeState?.entrypoints);
  const latestRetrospective = ensureArray(routeState?.retrospectives).slice(-1)[0] || null;
  const webShellAction = buildWebShellSuggestedAction(task);
  const webShellTopicSelected = uniqStrings(task.taskPacks?.selectedTopics || []).includes("web-shell-triage");
  const webShellPresent = task.webShellTriage?.present === true;
  const webShellPriorityEntrypoint = (routeState?.entrypoints || []).find(
    (entrypoint) =>
      cleanText(entrypoint?.id).toUpperCase() === "EP-002" &&
      ["PROBING", "EXPANDED", "CANDIDATE"].includes(cleanText(entrypoint?.status))
  );
  const activeCandidates = ensureArray(routeState?.activeEntrypoints)
    .map((entrypointId) => findEntrypointById(routeState, entrypointId))
    .filter(Boolean)
    .filter((entrypoint) => ["PROBING", "EXPANDED", "CANDIDATE"].includes(cleanText(entrypoint.status)));
  const nextEntrypoint =
    ((webShellTopicSelected || (webShellPresent && !cleanText(task.webShellTriage?.status || "").match(/^scanned-no-hit$/i)))
      ? webShellPriorityEntrypoint
      : null) ||
    activeCandidates[0] ||
    firstEntrypointWithStatuses(routeState, ["PROBING", "EXPANDED"]) ||
    firstEntrypointWithStatuses(routeState, ["CANDIDATE"]);
  const allEntrypointsExhausted =
    allEntrypoints.length > 0 &&
    allEntrypoints.every((entrypoint) => ["PARKED", "EXHAUSTED"].includes(cleanText(entrypoint.status)));

  if (routeState?.syncStatus === "backfilled-from-markdown-lossy") {
    return stamp(
      {
        status: "needs-route-rebuild",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: "route-state 由 Markdown 有损回填，当前切入点集合不可信。",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "先人工重建 entrypoints / retrospectives，再继续推进当前活跃阶段。",
        summary: "当前不能停在状态汇报，但也不能盲目续跑；应先修复 route-state 的结构化切入点集合。"
      },
    );
  }

  if (current.pauseCategory === "user") {
    return stamp(
      {
        ...current,
        status: "blocked-on-user",
        autoAdvanceEligible: false,
        pauseCategory: "user",
        pauseReason: current.pauseReason || "需要用户协作后才能继续。",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "等待用户完成登录、补样本或其他协作动作后，再回到当前活跃阶段。",
        summary: "当前允许暂停，因为继续执行需要用户协作。"
      },
    );
  }

  if (current.pauseCategory === "risk") {
    return stamp(
      {
        ...current,
        status: "blocked-on-risk",
        autoAdvanceEligible: false,
        pauseCategory: "risk",
        pauseReason: current.pauseReason || "继续执行前需要风险确认。",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "等待风险确认；确认后立刻恢复到当前活跃阶段执行。",
        summary: "当前允许暂停，因为继续执行前需要风险确认。"
      },
    );
  }

  if (allEntrypoints.length === 0) {
    return stamp(
      {
        status: "needs-route-rebuild",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: "route-state 缺少可恢复的 entrypoints。",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "先重建 2 到 5 个候选 entrypoints，再激活 1 到 2 个继续推进。",
        summary: "当前不能直接续跑，因为没有可执行的切入点 working set。"
      },
    );
  }

  if (allEntrypointsExhausted && !latestRetrospective) {
    return stamp(
      {
        status: "needs-retrospective",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: "现有 entrypoints 已全部 PARKED / EXHAUSTED，但缺少 retrospective。",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "先补一次 retrospective，基于失败证据生成新的 entrypoints，再继续执行。",
        summary: "当前不能停在“本轮失败”；应先复盘，再生成新切入点。"
      },
    );
  }

  if (!nextEntrypoint) {
    const retroNextFocus = cleanText(latestRetrospective?.nextFocus);
    return stamp(
      {
        status: "needs-route-rebuild",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: "当前 working set 没有可执行的 active / candidate entrypoint。",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction:
          retroNextFocus
            ? `根据最近一次 retrospective 的 nextFocus 重建切入点：${retroNextFocus}`
            : "重建 active entrypoints working set，并明确下一条最小 probe。",
        summary: "当前不能仅做状态汇报；应先恢复可执行的切入点。"
      },
    );
  }

  const nextExecutableAction =
    (cleanText(nextEntrypoint?.id).toUpperCase() === "EP-002" && cleanText(webShellAction)) ||
    (cleanText(task.webShellTriage?.status || "") && cleanText(webShellAction)) ||
    cleanText(nextEntrypoint.probe) ||
    cleanText(nextEntrypoint.nextOnSuccess) ||
    cleanText(nextEntrypoint.nextOnFailure) ||
    `围绕 ${nextEntrypoint.id} ${nextEntrypoint.title} 明确并执行最小 probe。`;

  return stamp(
    {
      status: "ready-to-continue",
      autoAdvanceEligible: true,
      pauseCategory: "none",
      pauseReason: "",
      nextEntrypointId: nextEntrypoint.id,
      nextPhase,
      nextExecutableAction,
      summary: `当前应直接执行 ${nextEntrypoint.id} 的下一动作，不要停在状态汇报。`
    }
  );
}

export function writeRouteStateDocument(taskDir, task, routeState) {
  const relPath = task.routeState?.statePath || "state/route-state.json";
  const filePath = taskFile(taskDir, relPath);
  ensureDir(taskFile(taskDir, "state"));
  const persisted = normalizeRouteStateDocument({ ...routeState, updatedAt: nowIso() }, task);
  fs.writeFileSync(filePath, JSON.stringify(persisted, null, 2) + "\n");
  return persisted;
}

export function applyRouteStateToTask(task, routeState) {
  task.routeState.activeTracks = routeState.activeTracks.slice();
  task.routeState.activeEntrypoints = routeState.activeEntrypoints.slice();
  task.routeState.syncStatus = routeState.syncStatus;
  task.routeState.executionStatus = routeState.execution.status;
  task.routeState.nextEntrypointId = routeState.execution.nextEntrypointId;
  task.routeState.nextExecutableAction = routeState.execution.nextExecutableAction;
  task.routeState.pauseCategory = routeState.execution.pauseCategory;
  task.routeState.pauseReason = routeState.execution.pauseReason;
  task.routeState.lastAdvancedAt = routeState.execution.updatedAt;
  task.routeState.vmTriage = {
    ...routeState.vmTriage,
    notes: (routeState.vmTriage?.notes || []).slice()
  };
  if (task.vm || routeState.vmTriage?.triageResult !== "not-applicable") {
    task.vm ||= {};
    task.vm.present ||= routeState.vmTriage?.triageResult !== "not-applicable";
    task.vm.triageResult = routeState.vmTriage?.triageResult || "not-started";
    task.vm.blackboxApi = routeState.vmTriage?.blackboxApi || "";
    task.vm.triageReason = routeState.vmTriage?.rationale || "";
    task.vm.triageNotes = (routeState.vmTriage?.notes || []).slice();
  }
  return task;
}

export function renderRoutePlanMarkdown(routeState, task = {}) {
  const lines = [
    "<!-- generated: route-plan; source=state/route-state.json; do-not-edit-directly -->",
    "",
    "# Route Plan",
    "",
    `Generated At: ${routeState.updatedAt || nowIso()}`,
    `Task Summary: ${routeState.taskId || task.taskId || ""}`,
    "Final Deliverable: report.md + run/*",
    "",
    "## Current Status",
    "",
    `- Active Tracks: ${routeState.activeTracks.join(", ") || "(none)"}`,
    `- Active Entrypoints: ${routeState.activeEntrypoints.join(", ") || "(none)"}`,
    `- VM Triage: ${routeState.vmTriage?.triageResult || "not-applicable"}`,
    `- Execution Status: ${routeState.execution.status || defaultExecutionStatus}`,
    `- Auto Advance Eligible: ${routeState.execution.autoAdvanceEligible ? "yes" : "no"}`,
    `- Next Executable Action: ${routeState.execution.nextExecutableAction || "(none)"}`,
    `- Pause Category: ${routeState.execution.pauseCategory || defaultPauseCategory}`,
    `- Pause Reason: ${routeState.execution.pauseReason || "(none)"}`,
    `- Sync Status: ${routeState.syncStatus || "not-started"}`,
    "",
    "## Track Definitions",
    ""
  ];

  for (const track of routeState.tracks) {
    lines.push(`### ${track.title}`);
    lines.push("");
    lines.push(`- Target: ${track.target || ""}`);
    lines.push(`- Inputs: ${track.inputs || ""}`);
    lines.push(`- Output: ${track.output || ""}`);
    lines.push(`- Priority: ${track.priority || ""}`);
    lines.push(`- Checkpoints: ${track.checkpoints.join(", ") || ""}`);
    lines.push("");
  }

  lines.push("## Entrypoint Loop");
  lines.push("");
  lines.push("- Principle: topics provide capabilities; entrypoints decide what to probe first.");
  lines.push("- Parallel Limit: keep at most 1 to 2 active entrypoints.");
  lines.push("- Pivot Rule: if a probe is ineffective, park or exhaust it, then switch or retrospective.");
  lines.push("");

  for (const entrypoint of routeState.entrypoints) {
    lines.push(`#### ${entrypoint.id} ${entrypoint.title}`);
    lines.push("");
    lines.push(`- Hypothesis: ${entrypoint.hypothesis || ""}`);
    lines.push(`- Bound Topics: ${entrypoint.boundTopics.join(", ") || ""}`);
    lines.push(`- Target Track: ${entrypoint.targetTrack || ""}`);
    lines.push(`- Rationale: ${entrypoint.rationale || ""}`);
    lines.push(`- Cost: ${entrypoint.cost || ""}`);
    lines.push(`- Expected Gain: ${entrypoint.expectedGain || ""}`);
    lines.push(`- Probe: ${entrypoint.probe || ""}`);
    lines.push(`- Success Criteria: ${entrypoint.successCriteria || ""}`);
    lines.push(`- Failure Criteria: ${entrypoint.failureCriteria || ""}`);
    lines.push(`- Status: ${entrypoint.status || defaultEntrypointStatus}`);
    lines.push(`- Result Summary: ${entrypoint.resultSummary || ""}`);
    lines.push(`- Next On Success: ${entrypoint.nextOnSuccess || ""}`);
    lines.push(`- Next On Failure: ${entrypoint.nextOnFailure || ""}`);
    lines.push(`- Updated At: ${entrypoint.updatedAt || ""}`);
    lines.push("");
  }

  if (routeState.retrospectives.length > 0) {
    lines.push("## Retrospectives");
    lines.push("");
    for (const retrospective of routeState.retrospectives) {
      lines.push(`#### ${retrospective.id}`);
      lines.push("");
      lines.push(`- Triggered By Entrypoints: ${retrospective.triggeredByEntrypoints.join(", ") || ""}`);
      lines.push(`- Summary: ${retrospective.summary || ""}`);
      lines.push(`- Failed Because: ${retrospective.failedBecause || ""}`);
      lines.push(`- New Entrypoints: ${retrospective.newEntrypoints.join(", ") || ""}`);
      lines.push(`- Decision: ${retrospective.decision || ""}`);
      lines.push(`- Next Focus: ${retrospective.nextFocus || ""}`);
      lines.push(`- Created At: ${retrospective.createdAt || ""}`);
      lines.push("");
    }
  }

  lines.push("## Coordination Rules");
  lines.push("");
  lines.push("- Update clues.md whenever a high-value clue or decisive evidence appears.");
  lines.push("- Use route-state.json as the machine source of truth; markdown is a rendered view.");
  lines.push("- Composite tasks should rank candidate entrypoints by cost and expected gain before expanding topics.");
  lines.push("- task-sync / task-advance 之后若 execution.status=ready-to-continue，必须继续执行 nextExecutableAction，而不是停在状态汇报。");
  lines.push("- 只有 execution.pauseCategory=user/risk 时才允许等待用户；其余状态要么继续推进，要么先修复 route-state working set。");
  lines.push("");
  return lines.join("\n");
}

export function renderProgressMarkdown(routeState) {
  const lines = [
    "<!-- generated: progress; source=state/route-state.json; do-not-edit-directly -->",
    "",
    "# Progress",
    "",
    `Last Updated: ${routeState.updatedAt || nowIso()}`,
    "",
    "| Track | Status | Completed Checkpoints | Next Step |",
    "|---|---|---|---|"
  ];

  for (const track of routeState.tracks) {
    lines.push(
      `| ${track.title} | ${track.status || defaultTrackStatus} | ${track.checkpoints.join(", ") || "—"} | ${track.nextStep || "—"} |`
    );
  }

  lines.push("");
  lines.push("## Entrypoint Progress");
  lines.push("");
  lines.push(`- Active Entrypoints: ${routeState.activeEntrypoints.join(", ") || "(none)"}`);
  lines.push(`- Execution Status: ${routeState.execution.status || defaultExecutionStatus}`);
  lines.push(`- Auto Advance Eligible: ${routeState.execution.autoAdvanceEligible ? "yes" : "no"}`);
  lines.push(`- Next Executable Action: ${routeState.execution.nextExecutableAction || "(none)"}`);
  lines.push(`- Pause: ${routeState.execution.pauseCategory || defaultPauseCategory} | ${routeState.execution.pauseReason || "(none)"}`);
  for (const entrypoint of routeState.entrypoints) {
    lines.push(
      `- ${entrypoint.id} [${entrypoint.status || defaultEntrypointStatus}] ${entrypoint.title} | probe=${entrypoint.probe || "—"} | result=${entrypoint.resultSummary || "—"}`
    );
  }

  if (routeState.retrospectives.length > 0) {
    lines.push("");
    lines.push("## Recent Retrospectives");
    lines.push("");
    for (const retrospective of routeState.retrospectives.slice(-3)) {
      lines.push(
        `- ${retrospective.id}: ${retrospective.summary || "—"} | new=${retrospective.newEntrypoints.join(", ") || "—"} | next=${retrospective.nextFocus || "—"}`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function renderCluesMarkdown(routeState) {
  const lines = [
    "<!-- generated: clues; source=state/route-state.json; do-not-edit-directly -->",
    "",
    "# Clues",
    "",
    "## Usage Rules",
    "",
    "- Only record high-value clues.",
    "- Every clue should be verifiable.",
    "- Low-confidence noise does not belong here.",
    ""
  ];

  for (const clue of routeState.clues) {
    lines.push(`## ${clue.id}`);
    lines.push("");
    lines.push(`- Source Track: ${clue.sourceTrack || ""}`);
    lines.push(`- Source Entrypoint: ${clue.sourceEntrypoint || ""}`);
    lines.push(`- Discovered At: ${clue.discoveredAt || ""}`);
    lines.push(`- Content: ${clue.content || ""}`);
    lines.push(`- Verification: ${clue.verification || ""}`);
    lines.push(`- Impact: ${clue.impact || ""}`);
    lines.push(`- Action: ${clue.action || ""}`);
    lines.push(`- Confidence: ${clue.confidence || ""}`);
    lines.push("");
  }

  return lines.join("\n");
}

function syncReportMarkdown(taskDir, task, routeState) {
  const reportPath = taskFile(taskDir, "report.md");
  if (!fs.existsSync(reportPath)) {
    return;
  }

  const report = fs.readFileSync(reportPath, "utf8");
  const runtimeTemplateBody = buildWebShellRuntimeTemplateReportBody(taskDir, task, routeState);
  const updatedReport = upsertMarkdownSection(
    report,
    reportRuntimeTemplateHeadingPatterns,
    reportRuntimeTemplateHeadingCanonical,
    runtimeTemplateBody
  );

  if (updatedReport !== report) {
    fs.writeFileSync(reportPath, updatedReport);
  }
}

export function syncMarkdownViews(taskDir, task, routeState) {
  fs.writeFileSync(taskFile(taskDir, task.routeState.planPath), renderRoutePlanMarkdown(routeState, task));
  fs.writeFileSync(taskFile(taskDir, task.routeState.progressPath), renderProgressMarkdown(routeState));
  fs.writeFileSync(taskFile(taskDir, task.routeState.cluesPath), renderCluesMarkdown(routeState));
  syncReportMarkdown(taskDir, task, routeState);
}

export function artifactTouchedAgainstTemplate(taskDir, relPath) {
  const currentPath = taskFile(taskDir, relPath);
  if (!fs.existsSync(currentPath)) {
    return false;
  }
  if (taskDir === templateTaskDir) {
    return true;
  }
  const templatePath = taskFile(templateTaskDir, relPath);
  if (!fs.existsSync(templatePath)) {
    return true;
  }
  return normalizeNewlines(fs.readFileSync(currentPath, "utf8")) !==
    normalizeNewlines(fs.readFileSync(templatePath, "utf8"));
}
