import fs from "node:fs";
import {
  ensureDir,
  normalizeNewlines,
  nowIso,
  safeReadText,
  taskFile,
  templateTaskDir
} from "./common.mjs";

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
const maxEntrypointsInWorkingSet = 5;
const maxRetrospectivesInWorkingSet = 5;
const validVmTriageResults = new Set([
  "not-applicable",
  "not-started",
  "blackbox",
  "browser-controlled",
  "deep-analysis"
]);

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeExecutionDiscipline(discipline, task = {}, execution = {}) {
  const workspaceRoot = cleanText(discipline?.workspaceRoot || task?.roots?.workspaceRoot);
  const skillRoot = cleanText(discipline?.skillRoot || task?.roots?.skillRoot);
  const taskLocalRoot = cleanText(discipline?.taskLocalRoot || task?.roots?.taskLocalRoot || task?.__taskDir);
  const artifactTruthRoot =
    cleanText(discipline?.artifactTruthRoot) || taskLocalRoot || workspaceRoot || skillRoot;
  const workspaceMode =
    cleanText(discipline?.workspaceMode) ||
    (workspaceRoot && skillRoot && workspaceRoot !== skillRoot ? "external-workspace" : "skill-workspace");
  const workspaceKind = cleanText(discipline?.workspaceKind) || workspaceMode;
  const mustExecuteNowStatuses = new Set(["ready-to-continue", "needs-route-rebuild", "needs-retrospective"]);
  const executionStatus = cleanText(execution?.status);
  const pauseCategory = cleanText(execution?.pauseCategory || "none");
  const mustExecuteNow =
    mustExecuteNowStatuses.has(executionStatus) &&
    !["user", "risk"].includes(pauseCategory) &&
    executionStatus !== "completed";
  const summary =
    cleanText(discipline?.summary) ||
    (mustExecuteNow
      ? "当前禁止只做状态汇报；必须先执行 nextExecutableAction，再汇报新的证据或结果。"
      : "当前可以根据 execution.status 与 pauseCategory 判断是否继续、修路由或等待用户。");

  // 浏览器 MCP 锁定：把 task.browserSession.pinnedMcp 提升为每轮 discipline 硬信号，
  // 阻止跨轮上下文衰减后模型按能力表「调试 API 更全」自行漂移到别的浏览器 MCP。
  const pinnedBrowserMcp = cleanText(discipline?.pinnedBrowserMcp || task?.browserSession?.pinnedMcp);

  return {
    workspaceRoot,
    skillRoot,
    taskLocalRoot,
    artifactTruthRoot,
    workspaceKind,
    workspaceMode,
    mustExecuteNow,
    statusOnlyReplyForbidden: mustExecuteNow,
    promiseOnlyReplyForbidden: mustExecuteNow,
    artifactClaimRequiresVerification: true,
    successClaimRequiresVerification: true,
    highSemanticHookFirst: true,
    sameFamilyHookRetryCap: 2,
    lowLevelSurfaceSwitchIsNotPivot: true,
    acceptanceBoundaryFirst: true,
    pinnedBrowserMcp,
    summary
  };
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
  const attemptCount = Math.max(0, Number(entrypoint?.attemptCount) || 0);
  const lastProductiveRound = cleanText(entrypoint?.lastProductiveRound);
  const productiveEvidenceCount = Math.max(0, Number(entrypoint?.productiveEvidenceCount) || 0);
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
    updatedAt: cleanText(entrypoint?.updatedAt),
    attemptCount,
    lastProductiveRound,
    productiveEvidenceCount
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
  const normalized = {
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
  normalized.discipline = normalizeExecutionDiscipline(execution?.discipline, task, normalized);
  return normalized;
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
    normalizeTrack({ title: "A", nextStep: "A1" }, 0),
    normalizeTrack({ title: "B", nextStep: "B1" }, 1)
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
        "执行 EP-001 的最小 probe：做一次最小观测，确认当前主阻塞更像 signer、session、env、vm 还是协议编排问题。",
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
        hypothesis: "先用一个最便宜的观察性探针判断当前主阻塞更像 signer、session、env、vm 还是协议编排问题。",
        boundTopics: [],
        targetTrack: "A",
        rationale: "复合场景先做中性分诊，避免一开始就把某个 topic 误当成唯一主线。",
        cost: "low",
        expectedGain: "high",
        probe: "做一次最小观测：hook / input-boundary diff / request initiator trace 三选一，先确认下一刀切在哪条链路。",
        successCriteria: "能明确缩窄主阻塞点，或激活下一条更高价值的切入点。",
        failureCriteria: "没有带来新的可执行分歧，且不能支持下一步判断。",
        status: "CANDIDATE",
        nextOnSuccess: "扩展该切入点并绑定更具体的 topic。",
        nextOnFailure: "切到下一个候选切入点。",
        updatedAt: "",
        attemptCount: 0,
        lastProductiveRound: "",
        productiveEvidenceCount: 0
      },
      0
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

const LEGACY_CLUE_FIELD_LABELS = [
  "来源线路", "来源切入点", "发现时间", "线索内容", "验证方式", "影响范围", "行动建议", "置信度",
  "Source Track", "Source Entrypoint", "Discovered At", "Content", "Verification", "Impact", "Action", "Confidence"
];

// clues.md 已是线索唯一真源（模型直接用 Edit 追加，task-note 也追加到此）。
// 解析「## 线索」段下的自由 bullet：`- [置信度] 内容 {EP-00N}`，置信度/切入点可选。
// 与旧的 `## CLUE-00N` + 字段 bullet 重格式并存，两者合并。
function parseFlatClueBullets(cluesText) {
  const clues = [];
  let inClueSection = false;
  for (const rawLine of String(cluesText || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      // 只在「## 线索」段内解析自由 bullet；记录规则段、legacy `## CLUE-NNN` 段都不算。
      inClueSection = cleanText(heading[1]) === "线索";
      continue;
    }
    if (!inClueSection || line.startsWith(">")) {
      continue; // 段外内容 / 引用块格式示例不是线索
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (!bullet) {
      continue;
    }
    let content = cleanText(bullet[1]);
    if (!content || LEGACY_CLUE_FIELD_LABELS.some((label) => new RegExp(`^${label}\\s*[:：]`).test(content))) {
      continue;
    }
    let confidence = "";
    let sourceEntrypoint = "";
    const confMatch = content.match(/^\[([^\]]+)\]\s*/);
    if (confMatch) {
      confidence = cleanText(confMatch[1]);
      content = content.slice(confMatch[0].length);
    }
    const epMatch = content.match(/\{([^}]+)\}\s*$/);
    if (epMatch) {
      sourceEntrypoint = cleanText(epMatch[1]);
      content = content.slice(0, epMatch.index);
    }
    content = cleanText(content);
    if (content) {
      clues.push({ content, confidence, sourceEntrypoint });
    }
  }
  return clues;
}

export function parseCluesMarkdown(cluesText) {
  const legacy = collectHeadingSections(cluesText, /^##\s+(CLUE-\d+)$/gm).map(({ match, body }) => ({
    sourceTrack: parseLabeledValue(body, ["来源线路", "Source Track"]),
    sourceEntrypoint: parseLabeledValue(body, ["来源切入点", "Source Entrypoint"]),
    discoveredAt: parseLabeledValue(body, ["发现时间", "Discovered At"]),
    content: parseLabeledValue(body, ["线索内容", "Content"]),
    verification: parseLabeledValue(body, ["验证方式", "Verification"]),
    impact: parseLabeledValue(body, ["影响范围", "Impact"]),
    action: parseLabeledValue(body, ["行动建议", "Action"]),
    confidence: parseLabeledValue(body, ["置信度", "Confidence"])
  }));
  // 只保留有实际内容的线索（丢弃模板空占位），按出现顺序重排 CLUE-00N。
  return [...legacy, ...parseFlatClueBullets(cluesText)]
    .filter((clue) => cleanText(clue.content))
    .map((clue, index) => normalizeClue(clue, index));
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
  const routeState = normalizeRouteStateDocument(JSON.parse(fs.readFileSync(filePath, "utf8")), task);
  // clues.md 是线索唯一真源：每次读取都用它覆盖 route-state.clues（json 里的 clues 仅为缓存，
  // 不再反向写回 clues.md）。这样模型用 Edit 手编的线索在所有下游门禁/报告里立即生效，不会丢。
  const cluesFromMd = parseCluesMarkdown(
    safeReadText(taskFile(taskDir, task.routeState?.cluesPath || "state/clues.md"))
  );
  if (cluesFromMd.length > 0) {
    routeState.clues = cluesFromMd;
  }
  return routeState;
}

function findEntrypointById(routeState, entrypointId) {
  return (routeState.entrypoints || []).find((entrypoint) => cleanText(entrypoint.id) === cleanText(entrypointId)) || null;
}

function firstEntrypointWithStatuses(routeState, statuses) {
  return (routeState.entrypoints || []).find((entrypoint) => statuses.includes(cleanText(entrypoint.status))) || null;
}

function collectIntelSignalTexts(task, routeState, nextEntrypoint) {
  return [
    ...(task.validation?.notes || []),
    ...(task.targetContext?.symptoms || []),
    ...(task.firstDivergence?.notes || []),
    ...(routeState?.clues || []).map((item) => item?.text || item?.summary || item),
    nextEntrypoint?.resultSummary,
    nextEntrypoint?.failureCriteria,
    nextEntrypoint?.nextOnFailure,
    routeState?.execution?.summary
  ]
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function collectRouteHints(task, routeState, nextEntrypoint) {
  return uniq([
    ...(task.routeState?.activeTracks || []),
    ...(routeState?.activeTracks || []),
    ...(task.taskPacks?.selectedTopics || []),
    ...(nextEntrypoint?.boundTopics || [])
  ]
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean));
}

function isSignatureLikeRoute(hints) {
  const set = new Set(hints || []);
  return ["signature", "session", "storage", "instrumentation-hooking"].some((key) => set.has(key));
}

function isVmWasmCompositeRoute(hints) {
  const set = new Set(hints || []);
  const hasVmLike = set.has("jsvmp") || set.has("vm");
  const hasWasm = set.has("wasm");
  return hasVmLike && hasWasm;
}

function containsRejectSignal(text) {
  return /baseline_ok_generated_rejected|verify_check|200\s*\+\s*(?:空体|empty body)|empty body|空体/i.test(
    cleanText(text)
  );
}

function containsVmWasmStallSignal(text) {
  return /(jsvmp|vm\s*\+\s*wasm|dispatcher|handler table|bytecode|instantiateStreaming|wasm imports|wasm exports|memory bridge|卡住|停滞|无进展|无法推进|stuck|stalled|no progress)/i.test(
    cleanText(text)
  );
}

function hasVmWasmBacklog(task) {
  const vm = task?.vm || {};
  const wasm = task?.wasmAnalysis || {};
  const vmPresent = vm.present === true || cleanText(vm.triageResult) === "deep-analysis";
  const wasmPresent = task?.runtime?.wasmPresent === true || wasm.present === true;
  const vmNotStarted = ["not-started", "", "unknown"].includes(cleanText(vm.boundaryStatus));
  const vmDecodeNotStarted = ["not-started", "", "unknown"].includes(cleanText(vm.decodeStatus));
  const vmTraceNotStarted = ["not-started", "", "unknown"].includes(cleanText(vm.traceStatus));
  const vmBridgeNotStarted = ["not-started", "", "unknown"].includes(cleanText(vm.bridgeStatus));
  const wasmLoaderNotStarted = ["not-started", "", "unknown"].includes(cleanText(wasm.loaderStatus));
  const wasmHookNotStarted = ["not-started", "", "unknown"].includes(cleanText(wasm.hookStatus));
  const wasmMemoryNotStarted = ["not-started", "", "unknown"].includes(cleanText(wasm.memoryStatus));
  const vmBacklog = vmPresent && (vmNotStarted || vmDecodeNotStarted || vmTraceNotStarted || vmBridgeNotStarted);
  const wasmBacklog = wasmPresent && (wasmLoaderNotStarted || wasmHookNotStarted || wasmMemoryNotStarted);
  return vmBacklog || wasmBacklog;
}

function shouldPreferIntelRefresh(task, routeState, nextEntrypoint) {
  const searchStatus = cleanText(task.externalRefs?.searchStatus || "").toLowerCase();
  const hasRecentIntel =
    ["searched", "matched"].includes(searchStatus) &&
    Boolean(cleanText(task.externalRefs?.lastAppliedAt || task.externalRefs?.policy?.lastEvaluatedAt));
  if (hasRecentIntel) {
    return false;
  }
  const signalTexts = collectIntelSignalTexts(task, routeState, nextEntrypoint);
  if (signalTexts.some((item) => containsRejectSignal(item))) {
    return true;
  }

  const routeHints = collectRouteHints(task, routeState, nextEntrypoint);
  if (!isVmWasmCompositeRoute(routeHints)) {
    return false;
  }

  const executionStatus = cleanText(routeState?.execution?.status || task?.routeState?.executionStatus).toLowerCase();
  const routeUnstable = ["needs-route-rebuild", "needs-retrospective", "not-evaluated"].includes(executionStatus);
  const hasStallSignal = signalTexts.some((item) => containsVmWasmStallSignal(item));
  return routeUnstable || hasStallSignal || hasVmWasmBacklog(task);
}

function buildIntelAction(task, routeState, nextEntrypoint) {
  const entrypointHint = cleanText(nextEntrypoint?.id)
    ? `；完成后回到 ${cleanText(nextEntrypoint.id)}`
    : "";
  const routeHints = collectRouteHints(task, routeState, nextEntrypoint);
  if (isVmWasmCompositeRoute(routeHints)) {
    return `把 jsvmp + wasm + dynamic-code + worker 设为主线${entrypointHint}；本轮最小目标是补齐“bytecode decode -> dispatcher -> wasm imports/exports -> memory bridge -> request-use”证据链。`;
  }
  if (isSignatureLikeRoute(routeHints)) {
    return `把 signature + session + storage + instrumentation-hooking 设为主线${entrypointHint}。`;
  }
  return `基于候选 entrypoints 重排当前主线${entrypointHint}。`;
}

export function resolveExecutionState(task, routeState) {
  const current = normalizeExecutionState(routeState?.execution, task);
  const nextPhase = cleanText(task.phase) || cleanText(routeState?.phase) || "Observe";
  const stamp = (execution) => normalizeExecutionState({ ...execution, updatedAt: nowIso() }, task);
  const allEntrypoints = ensureArray(routeState?.entrypoints);
  const latestRetrospective = ensureArray(routeState?.retrospectives).slice(-1)[0] || null;
  const activeCandidates = ensureArray(routeState?.activeEntrypoints)
    .map((entrypointId) => findEntrypointById(routeState, entrypointId))
    .filter(Boolean)
    .filter((entrypoint) => ["PROBING", "EXPANDED", "CANDIDATE"].includes(cleanText(entrypoint.status)));
  const nextEntrypoint =
    activeCandidates[0] ||
    firstEntrypointWithStatuses(routeState, ["PROBING", "EXPANDED"]) ||
    firstEntrypointWithStatuses(routeState, ["CANDIDATE"]);
  const allEntrypointsExhausted =
    allEntrypoints.length > 0 &&
    allEntrypoints.every((entrypoint) => ["PARKED", "EXHAUSTED"].includes(cleanText(entrypoint.status)));

  if (routeState?.syncStatus === "closeout-completed") {
    return stamp(
      {
        status: "completed",
        autoAdvanceEligible: false,
        pauseCategory: "none",
        pauseReason: "",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "",
        summary: cleanText(current.summary) || "closeout 已完成，无需继续执行。"
      }
    );
  }

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

  if (current.pauseCategory === "user" || task.browserSession?.reloginRequired === true) {
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

  // Hook retry cap enforcement: if any active entrypoint has reached sameFamilyHookRetryCap
  // without productive evidence, force it to EXHAUSTED and trigger retrospective need
  const hookRetryCap = current.discipline?.sameFamilyHookRetryCap || 2;
  const exhaustedByRetryCap = allEntrypoints.filter(
    (entrypoint) =>
      ["PROBING", "EXPANDED", "CANDIDATE"].includes(cleanText(entrypoint.status)) &&
      Number(entrypoint.attemptCount || 0) >= hookRetryCap &&
      Number(entrypoint.productiveEvidenceCount || 0) === 0
  );
  if (exhaustedByRetryCap.length > 0) {
    const ids = exhaustedByRetryCap.map((ep) => ep.id).join(", ");
    return stamp(
      {
        status: "needs-retrospective",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: `以下 entrypoint 已连续 ${hookRetryCap} 轮未产出有效证据，已被自动标记为 EXHAUSTED：${ids}。`,
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: `先补 retrospective：分析 ${ids} 的失败原因，生成新 entrypoints 后再继续。`,
        summary: "同族 hook 重试已达上限且无有效推进，必须先复盘再续跑。"
      }
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

  const nextExecutableAction = shouldPreferIntelRefresh(task, routeState, nextEntrypoint)
    ? buildIntelAction(task, routeState, nextEntrypoint)
    : cleanText(nextEntrypoint.probe) ||
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
  task.routeState.executionDiscipline = {
    ...(routeState.execution?.discipline || {})
  };
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
  const externalRefs = ensureArray(task?.externalRefs?.matchedRefs);
  const externalQueries = ensureArray(task?.externalRefs?.lastQueries);
  const externalEntrypointDrafts = ensureArray(task?.externalRefs?.entrypointDrafts);
  const lines = [
    "<!-- generated: route-plan; source=state/route-state.json; do-not-edit-directly -->",
    "",
    "# 路线计划",
    "",
    `生成时间: ${routeState.updatedAt || nowIso()}`,
    `任务摘要: ${routeState.taskId || task.taskId || ""}`,
    "最终交付: report.md + run/*",
    "",
    "## 当前状态",
    "",
    `- 活跃线路: ${routeState.activeTracks.join(", ") || "(none)"}`,
    `- 活跃切入点: ${routeState.activeEntrypoints.join(", ") || "(none)"}`,
    `- VM 分诊: ${routeState.vmTriage?.triageResult || "not-applicable"}`,
    `- 执行状态: ${routeState.execution.status || defaultExecutionStatus}`,
    `- 可自动续跑: ${routeState.execution.autoAdvanceEligible ? "yes" : "no"}`,
    `- 下一可执行动作: ${routeState.execution.nextExecutableAction || "(none)"}`,
    `- 工作区根目录: ${routeState.execution?.discipline?.workspaceRoot || task?.roots?.workspaceRoot || "(none)"}`,
    `- task-local 根目录: ${routeState.execution?.discipline?.taskLocalRoot || task?.roots?.taskLocalRoot || "(none)"}`,
    `- 产物真源根目录: ${routeState.execution?.discipline?.artifactTruthRoot || "(none)"}`,
    `- 工作区模式: ${routeState.execution?.discipline?.workspaceMode || "skill-workspace"}`,
    `- 当前必须执行: ${routeState.execution?.discipline?.mustExecuteNow ? "yes" : "no"}`,
    `- 暂停类别: ${routeState.execution.pauseCategory || defaultPauseCategory}`,
    `- 暂停原因: ${routeState.execution.pauseReason || "(none)"}`,
    `- 外部情报状态: ${cleanText(task?.externalRefs?.searchStatus) || "not-started"}`,
    `- 外部情报查询: ${externalQueries.join(" | ") || "(none)"}`,
    `- 外部情报引用数: ${externalRefs.length}`,
    `- 外部情报草案数: ${externalEntrypointDrafts.length}`,
    `- 同步状态: ${routeState.syncStatus || "not-started"}`,
    `- claimLevel: ${cleanText(task?.acceptanceModel?.claimLevel) || "provisional"}`,
    `- acceptanceGap: ${cleanText(task?.acceptanceModel?.acceptanceGap) || "(none)"}`,
    `- 下一证据门: ${cleanText(task?.acceptanceModel?.nextEvidenceGate) || "(none)"}`,
    "",
    "## 线路定义",
    ""
  ];

  for (const track of routeState.tracks) {
    lines.push(`### ${track.title}`);
    lines.push("");
    lines.push(`- 目标: ${track.target || ""}`);
    lines.push(`- 输入依赖: ${track.inputs || ""}`);
    lines.push(`- 输出格式: ${track.output || ""}`);
    lines.push(`- 优先级: ${track.priority || ""}`);
    lines.push(`- 检查点: ${track.checkpoints.join(", ") || ""}`);
    lines.push("");
  }

  lines.push("## 切入点循环");
  lines.push("");
  lines.push("- 原则: topic 提供能力边界，entrypoint 决定当前优先探哪一刀。");
  lines.push("- 并行上限: 同时只保留 1 到 2 个活跃切入点。");
  lines.push("- Pivot 规则: 若最小 probe 无效，则 park / exhaust 后切换或进入 retrospective。");
  lines.push("");

  for (const entrypoint of routeState.entrypoints) {
    lines.push(`#### ${entrypoint.id} ${entrypoint.title}`);
    lines.push("");
    lines.push(`- 假设: ${entrypoint.hypothesis || ""}`);
    lines.push(`- 关联专题: ${entrypoint.boundTopics.join(", ") || ""}`);
    lines.push(`- 对应线路: ${entrypoint.targetTrack || ""}`);
    lines.push(`- 选择理由: ${entrypoint.rationale || ""}`);
    lines.push(`- 启动成本: ${entrypoint.cost || ""}`);
    lines.push(`- 预期收益: ${entrypoint.expectedGain || ""}`);
    lines.push(`- 最小探针: ${entrypoint.probe || ""}`);
    lines.push(`- 成功判据: ${entrypoint.successCriteria || ""}`);
    lines.push(`- 失败判据: ${entrypoint.failureCriteria || ""}`);
    lines.push(`- 当前状态: ${entrypoint.status || defaultEntrypointStatus}`);
    lines.push(`- 当前结论: ${entrypoint.resultSummary || ""}`);
    lines.push(`- 成功后: ${entrypoint.nextOnSuccess || ""}`);
    lines.push(`- 失败后: ${entrypoint.nextOnFailure || ""}`);
    lines.push(`- 更新时间: ${entrypoint.updatedAt || ""}`);
    lines.push("");
  }

  if (routeState.retrospectives.length > 0) {
    lines.push("## 复盘记录");
    lines.push("");
    for (const retrospective of routeState.retrospectives) {
      lines.push(`#### ${retrospective.id}`);
      lines.push("");
      lines.push(`- 触发切入点: ${retrospective.triggeredByEntrypoints.join(", ") || ""}`);
      lines.push(`- 复盘结论: ${retrospective.summary || ""}`);
      lines.push(`- 失败原因: ${retrospective.failedBecause || ""}`);
      lines.push(`- 新生切入点: ${retrospective.newEntrypoints.join(", ") || ""}`);
      lines.push(`- 路线决策: ${retrospective.decision || ""}`);
      lines.push(`- 下一焦点: ${retrospective.nextFocus || ""}`);
      lines.push(`- 创建时间: ${retrospective.createdAt || ""}`);
      lines.push("");
    }
  }

  lines.push("## 协同规则");
  lines.push("");
  lines.push("- 一旦出现高价值线索或决定性证据，立即更新 clues.md。");
  lines.push("- route-state.json 是机器真源，Markdown 只是渲染视图。");
  lines.push("- 复合任务要先按成本与预期收益排序候选切入点，再扩展 topic。");
  lines.push("- task-sync / task-advance 之后若 execution.status=ready-to-continue，必须继续执行 nextExecutableAction，而不是停在状态汇报。");
  lines.push("- 只有 execution.pauseCategory=user/risk 时才允许等待用户；其余状态要么继续推进，要么先修复 route-state working set。");
  lines.push("- 一切“已落盘 / 已更新 / 已成功”声明，都必须先以 artifactTruthRoot 下的真实文件或最新验证结果自检。");
  lines.push("- 若 当前必须执行=yes，则禁止用“我会继续 / 下一步继续”代替动作。");
  lines.push("");
  return lines.join("\n");
}

export function renderProgressMarkdown(routeState) {
  const lines = [
    "<!-- generated: progress; source=state/route-state.json; do-not-edit-directly -->",
    "",
    "# 进展",
    "",
    `最后更新时间: ${routeState.updatedAt || nowIso()}`,
    "",
    "| 线路 | 状态 | 已完成检查点 | 下一步 |",
    "|---|---|---|---|"
  ];

  for (const track of routeState.tracks) {
    lines.push(
      `| ${track.title} | ${track.status || defaultTrackStatus} | ${track.checkpoints.join(", ") || "—"} | ${track.nextStep || "—"} |`
    );
  }

  lines.push("");
  lines.push("## 切入点进展");
  lines.push("");
  lines.push(`- 活跃切入点: ${routeState.activeEntrypoints.join(", ") || "(none)"}`);
  lines.push(`- 执行状态: ${routeState.execution.status || defaultExecutionStatus}`);
  lines.push(`- 可自动续跑: ${routeState.execution.autoAdvanceEligible ? "yes" : "no"}`);
  lines.push(`- 下一可执行动作: ${routeState.execution.nextExecutableAction || "(none)"}`);
  lines.push(`- 产物真源根目录: ${routeState.execution?.discipline?.artifactTruthRoot || "(none)"}`);
  lines.push(`- 工作区模式: ${routeState.execution?.discipline?.workspaceMode || "skill-workspace"}`);
  lines.push(`- 当前必须执行: ${routeState.execution?.discipline?.mustExecuteNow ? "yes" : "no"}`);
  lines.push(`- 暂停: ${routeState.execution.pauseCategory || defaultPauseCategory} | ${routeState.execution.pauseReason || "(none)"}`);
  for (const entrypoint of routeState.entrypoints) {
    lines.push(
      `- ${entrypoint.id} [${entrypoint.status || defaultEntrypointStatus}] ${entrypoint.title} | probe=${entrypoint.probe || "—"} | result=${entrypoint.resultSummary || "—"}`
    );
  }

  if (routeState.retrospectives.length > 0) {
    lines.push("");
    lines.push("## 最近复盘");
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

function normalizeExternalResearchSnapshot(task = {}) {
  const externalRefs = task?.externalRefs || {};
  const policy = externalRefs.policy || {};
  const featureBundle = externalRefs.featureBundle || {};
  const reconciliation = externalRefs.reconciliation || {};
  const summary = reconciliation.summary || {};
  return {
    generatedAt: cleanText(reconciliation.generatedAt || externalRefs.lastAppliedAt || policy.lastEvaluatedAt) || nowIso(),
    status: cleanText(externalRefs.searchStatus) || "not-started",
    provider: cleanText(externalRefs.searchProvider),
    mode: cleanText(externalRefs.searchMode) || cleanText(policy.mode) || "auto",
    searchRounds: Math.max(0, Number(externalRefs.searchRounds) || 0),
    triggerSignals: uniq(ensureArray(externalRefs.triggerSignals).map((item) => cleanText(item)).filter(Boolean)),
    sourceTypesPreferred: uniq(ensureArray(externalRefs.sourceTypesPreferred).map((item) => cleanText(item)).filter(Boolean)),
    sourceTypesUsed: uniq(ensureArray(externalRefs.sourceTypesUsed).map((item) => cleanText(item)).filter(Boolean)),
    confidence: Math.max(0, Number(externalRefs.confidence) || 0),
    lastDecisionSummary: cleanText(externalRefs.lastDecisionSummary),
    lastAppliedAt: cleanText(externalRefs.lastAppliedAt),
    policy: {
      policyPath: cleanText(policy.policyPath),
      policyVersion: cleanText(policy.policyVersion),
      lastEvaluatedAt: cleanText(policy.lastEvaluatedAt),
      mode: cleanText(policy.mode) || cleanText(externalRefs.searchMode) || "auto",
      decision: cleanText(policy.decision) || "not-evaluated",
      reasons: uniq(ensureArray(policy.reasons).map((item) => cleanText(item)).filter(Boolean)),
      searchabilityScore: Math.max(0, Number(policy.searchabilityScore) || 0),
      metrics: policy.metrics && typeof policy.metrics === "object" ? policy.metrics : {}
    },
    queries: uniq(ensureArray(externalRefs.lastQueries).map((item) => cleanText(item)).filter(Boolean)),
    queryStats: ensureArray(externalRefs.queryStats),
    featureBundle: {
      hosts: uniq(ensureArray(featureBundle.hosts).map((item) => cleanText(item)).filter(Boolean)),
      urlPathHints: uniq(ensureArray(featureBundle.urlPathHints).map((item) => cleanText(item)).filter(Boolean)),
      keywords: uniq(ensureArray(featureBundle.keywords).map((item) => cleanText(item)).filter(Boolean)),
      functionNames: uniq(ensureArray(featureBundle.functionNames).map((item) => cleanText(item)).filter(Boolean)),
      routeTracks: uniq(ensureArray(featureBundle.routeTracks).map((item) => cleanText(item)).filter(Boolean)),
      topicHints: uniq(ensureArray(featureBundle.topicHints).map((item) => cleanText(item)).filter(Boolean))
    },
    results: ensureArray(externalRefs.matchedRefs),
    resultDigest: uniq(ensureArray(externalRefs.resultDigest).map((item) => cleanText(item)).filter(Boolean)),
    adoptedFindings: uniq(ensureArray(externalRefs.adoptedFindings).map((item) => cleanText(item)).filter(Boolean)),
    rejectedFindings: uniq(ensureArray(externalRefs.rejectedFindings).map((item) => cleanText(item)).filter(Boolean)),
    openQuestions: uniq(ensureArray(externalRefs.openQuestions).map((item) => cleanText(item)).filter(Boolean)),
    candidateEntrypoints: ensureArray(externalRefs.entrypointDrafts),
    probeDrafts: ensureArray(externalRefs.probeDrafts),
    reconciliation: {
      generatedAt: cleanText(reconciliation.generatedAt),
      summary: {
        merge: Math.max(0, Number(summary.merge) || 0),
        review: Math.max(0, Number(summary.review) || 0),
        reject: Math.max(0, Number(summary.reject) || 0)
      },
      suggestions: ensureArray(reconciliation.suggestions)
    },
    notes: uniq(ensureArray(externalRefs.notes).map((item) => cleanText(item)).filter(Boolean))
  };
}

function renderBulletList(lines, values, emptyText = "- （无）") {
  if (!values || values.length === 0) {
    lines.push(emptyText);
    return;
  }
  for (const value of values) {
    lines.push(`- ${value}`);
  }
}

function renderObjectList(lines, values, formatter, emptyText = "- （无）") {
  if (!values || values.length === 0) {
    lines.push(emptyText);
    return;
  }
  for (const value of values) {
    const rendered = cleanText(formatter(value));
    lines.push(`- ${rendered || "（空条目）"}`);
  }
}

export function renderExternalResearchMarkdown(task = {}) {
  const snapshot = normalizeExternalResearchSnapshot(task);
  const lines = [
    "<!-- generated: external-research; source=task.externalRefs; do-not-edit-directly -->",
    "",
    "# 外部检索",
    "",
    `- 状态: ${snapshot.status}`,
    `- 提供方: ${snapshot.provider || "(none)"}`,
    `- 模式: ${snapshot.mode}`,
    `- 搜索轮次: ${snapshot.searchRounds}`,
    `- 查询: ${snapshot.queries.join(" | ") || "(none)"}`,
    `- 最后应用时间: ${snapshot.lastAppliedAt || "(none)"}`,
    `- 最后决策摘要: ${snapshot.lastDecisionSummary || "(none)"}`,
    `- 置信度: ${snapshot.confidence}`,
    "",
    "## 策略评估",
    "",
    `- 策略路径: ${snapshot.policy.policyPath || "(none)"}`,
    `- 策略版本: ${snapshot.policy.policyVersion || "(none)"}`,
    `- 评估时间: ${snapshot.policy.lastEvaluatedAt || "(none)"}`,
    `- 模式: ${snapshot.policy.mode}`,
    `- 决策: ${snapshot.policy.decision}`,
    `- 原因: ${snapshot.policy.reasons.join(" | ") || "(none)"}`,
    `- 可检索性评分: ${snapshot.policy.searchabilityScore}`,
    "",
    "## 触发信号",
    ""
  ];

  renderBulletList(lines, snapshot.triggerSignals);
  lines.push("");
  lines.push("## 特征束");
  lines.push("");
  lines.push(`- Hosts: ${snapshot.featureBundle.hosts.join(", ") || "(none)"}`);
  lines.push(`- URL Path Hints: ${snapshot.featureBundle.urlPathHints.join(", ") || "(none)"}`);
  lines.push(`- Keywords: ${snapshot.featureBundle.keywords.join(", ") || "(none)"}`);
  lines.push(`- Function Names: ${snapshot.featureBundle.functionNames.join(", ") || "(none)"}`);
  lines.push(`- Route Tracks: ${snapshot.featureBundle.routeTracks.join(", ") || "(none)"}`);
  lines.push(`- Topic Hints: ${snapshot.featureBundle.topicHints.join(", ") || "(none)"}`);
  lines.push("");
  lines.push("## 结果摘要");
  lines.push("");
  renderBulletList(lines, snapshot.resultDigest);
  lines.push("");
  lines.push("## 命中参考");
  lines.push("");
  renderObjectList(lines, snapshot.results, (item) => {
    if (typeof item === "string") return item;
    const title = cleanText(item?.title || item?.name || item?.url || item?.path);
    const url = cleanText(item?.url || item?.path);
    const adopted = item?.adopted === true ? "adopted" : item?.adopted === false ? "rejected" : "review";
    return [title, url && url !== title ? url : "", `status=${adopted}`].filter(Boolean).join(" | ");
  });
  lines.push("");
  lines.push("## 已采纳结论");
  lines.push("");
  renderBulletList(lines, snapshot.adoptedFindings);
  lines.push("");
  lines.push("## 已拒绝结论");
  lines.push("");
  renderBulletList(lines, snapshot.rejectedFindings);
  lines.push("");
  lines.push("## 未决问题");
  lines.push("");
  renderBulletList(lines, snapshot.openQuestions);
  lines.push("");
  lines.push("## 候选切入点草案");
  lines.push("");
  renderObjectList(lines, snapshot.candidateEntrypoints, (item) => {
    if (typeof item === "string") return item;
    return [cleanText(item?.id || item?.title || item?.name), cleanText(item?.rationale || item?.summary || item?.probe)].filter(Boolean).join(" | ");
  });
  lines.push("");
  lines.push("## Probe 草案");
  lines.push("");
  renderObjectList(lines, snapshot.probeDrafts, (item) => {
    if (typeof item === "string") return item;
    return [cleanText(item?.id || item?.title || item?.name), cleanText(item?.probe || item?.summary || item?.goal)].filter(Boolean).join(" | ");
  });
  lines.push("");
  lines.push("## 草案对账");
  lines.push("");
  lines.push(`- Merge: ${snapshot.reconciliation.summary.merge}`);
  lines.push(`- Review: ${snapshot.reconciliation.summary.review}`);
  lines.push(`- Reject: ${snapshot.reconciliation.summary.reject}`);
  renderObjectList(lines, snapshot.reconciliation.suggestions, (item) => {
    if (typeof item === "string") return item;
    return [cleanText(item?.type || item?.decision || item?.id), cleanText(item?.title || item?.summary || item?.reason)].filter(Boolean).join(" | ");
  });
  lines.push("");
  lines.push("## 备注");
  lines.push("");
  renderBulletList(lines, snapshot.notes);
  lines.push("");
  return lines.join("\n");
}


export function writeExternalResearchArtifacts(taskDir, task = {}) {
  const snapshot = normalizeExternalResearchSnapshot(task);
  const jsonPath = taskFile(taskDir, "state/external-research.json");
  const mdPath = taskFile(taskDir, "state/external-research.md");
  ensureDir(taskFile(taskDir, "state"));
  fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2) + "\n");
  fs.writeFileSync(mdPath, renderExternalResearchMarkdown(task));
  return snapshot;
}

// clues.md 是线索唯一真源：本函数只产出「初始脚手架」，绝不枚举/覆盖已有线索。
// 模型用 Edit 直接往「## 线索」下追加 bullet；syncMarkdownViews 仅在文件缺失时写入本脚手架。
export function renderCluesMarkdown() {
  return [
    "<!-- source-of-truth: 本文件就是线索唯一真源。直接用 Edit 在「## 线索」下追加 bullet；task-note 也追加到这里。不要等「之后一起写」。 -->",
    "",
    "# 线索",
    "",
    "## 记录规则",
    "",
    "- 发现一条可复用线索就**立即**追加一行，成本极低；未落盘的线索 = 任务中断后必须重新分析。",
    "- 格式（置信度、切入点可选）：`- [置信度] 内容 {EP-00N}`",
    "  例：`- [route-ready] cb 由 load.min.js 的 t() 生成，自定义 base64 表 {EP-002}`",
    "- 置信度取值：provisional / route-ready / acceptance-ready / delivered。",
    "- 只记高价值、可验证线索；低置信度噪音不要写。最终 report.md 由本文件渲染，不记录 = 交付物为空。",
    "",
    "## 线索",
    ""
  ].join("\n");
}

export function renderTaskContractMarkdown(task = {}) {
  const contract = task.taskContract || {};
  const acceptance = task.acceptanceModel || {};
  const lines = [
    "<!-- generated: task-contract; source=task.taskContract; do-not-edit-directly -->",
    "",
    "# 任务契约",
    "",
    `- 目标: ${cleanText(contract.objective) || "(none)"}`,
    `- 不可退让约束: ${(contract.nonNegotiables || []).join(" | ") || "(none)"}`,
    `- 当前交付层级: ${cleanText(contract.deliverableTier) || "(none)"}`,
    `- 完成判据: ${(contract.completionCriteria || []).join(" | ") || "(none)"}`,
    `- 禁止回退 / workaround: ${(contract.disallowedFallbacks || []).join(" | ") || "(none)"}`,
    `- 禁止冒充完成的替代态: ${(contract.intermediateStatesNotDelivery || []).join(" | ") || "(none)"}`,
    `- 当前 claimLevel: ${cleanText(acceptance.claimLevel) || "provisional"}`,
    `- 契约状态: ${cleanText(contract.status) || "draft"}`,
    ""
  ];
  return lines.join("\n");
}

export function renderAcceptanceChecklistMarkdown(task = {}) {
  const acceptance = task.acceptanceModel || {};
  const executionModel = task.executionModel || {};
  const lines = [
    "<!-- generated: acceptance-checklist; source=task.acceptanceModel; do-not-edit-directly -->",
    "",
    "# 验收检查",
    "",
    `- claimLevel: ${cleanText(acceptance.claimLevel) || "provisional"}`,
    `- acceptanceGap: ${cleanText(acceptance.acceptanceGap) || "(none)"}`,
    `- nextEvidenceGate: ${cleanText(acceptance.nextEvidenceGate) || "(none)"}`,
    `- acceptancePath: ${cleanText(acceptance.acceptancePath) || "(none)"}`,
    `- validators: ${(acceptance.validators || []).join(", ") || "(none)"}`,
    `- completionBlockedBy: ${(acceptance.completionBlockedBy || []).join(" | ") || "(none)"}`,
    `- userRejectedApproaches: ${(acceptance.userRejectedApproaches || []).join(" | ") || "(none)"}`,
    `- prohibitedIntermediateSignals: ${(acceptance.prohibitedIntermediateSignals || []).join(" | ") || "(none)"}`,
    `- 当前微路线: ${cleanText(executionModel.microRoute) || "(none)"}`,
    `- 当前实验类别: ${cleanText(executionModel.experimentClass) || "(none)"}`,
    `- 停损条件: ${cleanText(executionModel.stopLossCondition) || "(none)"}`,
    ""
  ];
  return lines.join("\n");
}

export function syncMarkdownViews(taskDir, task, routeState) {
  fs.writeFileSync(taskFile(taskDir, task.routeState.planPath), renderRoutePlanMarkdown(routeState, task));
  fs.writeFileSync(taskFile(taskDir, task.routeState.progressPath), renderProgressMarkdown(routeState));
  // clues.md 是线索唯一真源（模型 / task-note 直接编辑），不从 route-state 覆盖渲染；
  // 仅在文件缺失时写入脚手架，已存在则保留手编内容。
  const cluesFile = taskFile(taskDir, task.routeState.cluesPath);
  if (!fs.existsSync(cluesFile)) {
    fs.writeFileSync(cluesFile, renderCluesMarkdown());
  }
  fs.writeFileSync(taskFile(taskDir, "state/task-contract.md"), renderTaskContractMarkdown(task));
  fs.writeFileSync(taskFile(taskDir, "state/acceptance-checklist.md"), renderAcceptanceChecklistMarkdown(task));
  writeExternalResearchArtifacts(taskDir, task);
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
