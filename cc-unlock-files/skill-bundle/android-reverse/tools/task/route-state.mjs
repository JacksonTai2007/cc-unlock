import fs from "node:fs";
import {
  ensureDir,
  normalizeNewlines,
  nowIso,
  safeReadText,
  taskFile,
  templateTaskDir
} from "./common.mjs";

export const routeStateSchemaVersion = 3;

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
  "needs-tool-preflight",
  "needs-evidence",
  "needs-state-repair",
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
const maxApproachHistoryInWorkingSet = 25;
const maxPatchCandidatesInWorkingSet = 10;
const maxValidationRunsInWorkingSet = 10;
const validVmTriageResults = new Set([
  "not-applicable",
  "not-started",
  "blackbox",
  "deep-analysis"
]);
const validAttemptKinds = new Set(["probe", "patch", "verify", "tool", "retrospective", "other"]);
const validAttemptStatuses = new Set(["success", "failed", "blocked", "invalid", "inconclusive"]);
const validValidationRunStatuses = new Set(["valid", "invalid", "inconclusive", "failed"]);
const validPatchCandidateStatuses = new Set(["proposed", "built", "installed", "verified", "failed", "blocked", "rolled-back"]);
const validToolReadinessStatuses = new Set(["unknown", "verified", "blocked", "unavailable", "skipped"]);

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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
        "执行 EP-001 的最小 probe：做一次最小观测，确认当前主阻塞更像 壳、动态 Dex、JNI、运行时防护或协议链路 还是协议编排问题。",
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
        hypothesis: "先用一个最便宜的观察性探针判断当前主阻塞更像 壳、动态 Dex、JNI、运行时防护或协议链路 还是协议编排问题。",
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
        updatedAt: ""
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

/**
 * External search tracking state for a task.
 *
 * - searchRounds: cumulative number of external search rounds executed via WebSearch.
 *   Each invocation of WebSearch increments this by 1. A value of 0 means no external
 *   search has been performed. The completion gate (SKILL.md L96) uses this to block
 *   zero-search deliveries when protectionTier >= A2 and execution rounds >= 3.
 *
 * - lastSearchRound: the task execution round number when the most recent search was
 *   performed. Used by the search gate (SKILL.md L70-78) to track timing.
 *
 * - searchDecision: one-line conclusion from the most recent search (e.g., "identified
 *   as 360 jiagu, public dump tools available"). Written to external-research.md.
 *
 * - externalResearchPath: relative path to the file where search results are summarized.
 */
export function defaultSearchState() {
  return {
    searchRounds: 0,
    lastSearchRound: 0,
    searchDecision: "",
    externalResearchPath: "state/external-research.md"
  };
}

export function normalizeSearchState(search) {
  const base = defaultSearchState();
  if (!search || typeof search !== "object") {
    return base;
  }
  return {
    searchRounds: Number(search.searchRounds) || 0,
    lastSearchRound: Number(search.lastSearchRound) || 0,
    searchDecision: cleanText(search.searchDecision) || "",
    externalResearchPath: cleanText(search.externalResearchPath) || base.externalResearchPath
  };
}

export function defaultAttemptCounters() {
  return {
    totalAttempts: 0,
    successCount: 0,
    failedCount: 0,
    blockedCount: 0,
    sameStrategyFailureCount: 0,
    tombstoneCount: 0,
    userNegativeSignalCount: 0,
    failurePatterns: [],
    exhaustedFamilies: [],
    deadEndObjects: [],
    updatedAt: ""
  };
}

export function normalizeAttemptCounters(counters) {
  const base = defaultAttemptCounters();
  if (!counters || typeof counters !== "object") {
    return base;
  }
  const successCount = Number(counters.successCount) || 0;
  const failedCount = Number(counters.failedCount) || 0;
  const blockedCount = Number(counters.blockedCount) || 0;
  const sameStrategyFailureCount = Number(counters.sameStrategyFailureCount) || 0;
  const tombstoneCount = Number(counters.tombstoneCount) || 0;
  const userNegativeSignalCount = Number(counters.userNegativeSignalCount) || 0;
  const declaredTotal = Number(counters.totalAttempts) || 0;
  const computedTotal = successCount + failedCount + blockedCount;
  return {
    totalAttempts: Math.max(declaredTotal, computedTotal),
    successCount,
    failedCount,
    blockedCount,
    sameStrategyFailureCount,
    tombstoneCount,
    userNegativeSignalCount,
    failurePatterns: ensureArray(counters.failurePatterns).map((item) => cleanText(item)),
    exhaustedFamilies: ensureArray(counters.exhaustedFamilies).map((item) => cleanText(item)),
    deadEndObjects: ensureArray(counters.deadEndObjects).map((item) => cleanText(item)),
    updatedAt: cleanText(counters.updatedAt) || ""
  };
}

function normalizeEvidenceRefs(value) {
  return uniq(ensureArray(value).map((item) => cleanText(item)).filter(Boolean));
}

function normalizeAttemptKind(value) {
  const text = cleanText(value).toLowerCase();
  return validAttemptKinds.has(text) ? text : "other";
}

function normalizeAttemptStatus(value) {
  const text = cleanText(value).toLowerCase();
  return validAttemptStatuses.has(text) ? text : "inconclusive";
}

function normalizeApproachRecord(record, index) {
  return {
    id: cleanText(record?.id) || `ATT-${String(index + 1).padStart(3, "0")}`,
    kind: normalizeAttemptKind(record?.kind || record?.type),
    status: normalizeAttemptStatus(record?.status || record?.result),
    strategy: cleanText(record?.strategy || record?.method),
    tool: cleanText(record?.tool),
    entrypointId: cleanText(record?.entrypointId || record?.entrypoint),
    candidateId: cleanText(record?.candidateId || record?.candidate),
    hypothesis: cleanText(record?.hypothesis),
    expectedObservation: cleanText(record?.expectedObservation || record?.expected),
    actualObservation: cleanText(record?.actualObservation || record?.actual || record?.summary),
    classification: cleanText(record?.classification || record?.failedPattern || record?.failurePattern),
    evidenceRefs: normalizeEvidenceRefs(record?.evidenceRefs || record?.evidence),
    validity: cleanText(record?.validity),
    invalidReason: cleanText(record?.invalidReason),
    rollbackPlan: cleanText(record?.rollbackPlan),
    createdAt: cleanText(record?.createdAt || record?.timestamp)
  };
}

export function normalizeApproachHistory(history) {
  return ensureArray(history)
    .map((record, index) => normalizeApproachRecord(record, index))
    .slice(-maxApproachHistoryInWorkingSet);
}

function normalizePatchCandidate(candidate, index) {
  const status = cleanText(candidate?.status).toLowerCase();
  return {
    id: cleanText(candidate?.id || candidate?.candidateId) || `PATCH-${String(index + 1).padStart(3, "0")}`,
    baseApk: cleanText(candidate?.baseApk),
    parentCandidate: cleanText(candidate?.parentCandidate),
    hypothesis: cleanText(candidate?.hypothesis),
    rootCauseEvidenceRefs: normalizeEvidenceRefs(candidate?.rootCauseEvidenceRefs || candidate?.evidenceRefs),
    expectedObservation: cleanText(candidate?.expectedObservation),
    rollbackPlan: cleanText(candidate?.rollbackPlan),
    status: validPatchCandidateStatuses.has(status) ? status : "proposed",
    resultSummary: cleanText(candidate?.resultSummary),
    createdAt: cleanText(candidate?.createdAt),
    updatedAt: cleanText(candidate?.updatedAt)
  };
}

export function normalizePatchCandidates(candidates) {
  return ensureArray(candidates)
    .map((candidate, index) => normalizePatchCandidate(candidate, index))
    .slice(-maxPatchCandidatesInWorkingSet);
}

function normalizeValidationRun(run, index) {
  const status = cleanText(run?.status || run?.validity).toLowerCase();
  return {
    id: cleanText(run?.id) || `VAL-${String(index + 1).padStart(3, "0")}`,
    candidateId: cleanText(run?.candidateId || run?.candidate),
    status: validValidationRunStatuses.has(status) ? status : "inconclusive",
    scope: cleanText(run?.scope),
    expectedObservation: cleanText(run?.expectedObservation || run?.expected),
    actualObservation: cleanText(run?.actualObservation || run?.actual || run?.summary),
    evidenceRefs: normalizeEvidenceRefs(run?.evidenceRefs || run?.evidence),
    invalidReason: cleanText(run?.invalidReason),
    createdAt: cleanText(run?.createdAt || run?.timestamp)
  };
}

export function normalizeValidationRuns(runs) {
  return ensureArray(runs)
    .map((run, index) => normalizeValidationRun(run, index))
    .slice(-maxValidationRunsInWorkingSet);
}

function normalizeCompletionGate(gate) {
  const criteriaStatus = ensureArray(gate?.criteriaStatus).map((item, index) => ({
    id: cleanText(item?.id) || `CRIT-${String(index + 1).padStart(3, "0")}`,
    label: cleanText(item?.label || item?.text || item?.criteria),
    status: cleanText(item?.status || "pending").toLowerCase(),
    evidenceRefs: normalizeEvidenceRefs(item?.evidenceRefs || item?.evidence)
  }));
  return {
    status: cleanText(gate?.status || "not-started").toLowerCase(),
    criteriaStatus,
    missingEvidence: normalizeEvidenceRefs(gate?.missingEvidence),
    updatedAt: cleanText(gate?.updatedAt)
  };
}

function normalizeToolReadinessEntry(entry = {}) {
  const status = cleanText(entry.status).toLowerCase();
  return {
    status: validToolReadinessStatuses.has(status) ? status : "unknown",
    endpoint: cleanText(entry.endpoint),
    foregroundVerified: entry.foregroundVerified === true,
    toolsListed: entry.toolsListed === true,
    apkOpened: entry.apkOpened === true,
    reason: cleanText(entry.reason),
    evidenceRefs: normalizeEvidenceRefs(entry.evidenceRefs || entry.evidence),
    updatedAt: cleanText(entry.updatedAt)
  };
}

export function normalizeToolReadiness(toolReadiness) {
  const tools = {};
  const inputTools = toolReadiness?.tools && typeof toolReadiness.tools === "object" ? toolReadiness.tools : {};
  for (const [toolName, entry] of Object.entries(inputTools)) {
    const name = cleanText(toolName);
    if (name) {
      tools[name] = normalizeToolReadinessEntry(entry);
    }
  }
  return { tools };
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
    search: normalizeSearchState(task.routeState?.search),
    attemptCounters: normalizeAttemptCounters(task.routeState?.attemptCounters),
    toolReadiness: normalizeToolReadiness(task.routeState?.toolReadiness),
    approachHistory: normalizeApproachHistory(task.routeState?.approachHistory),
    patchCandidates: normalizePatchCandidates(task.routeState?.patchCandidates),
    validationRuns: normalizeValidationRuns(task.routeState?.validationRuns),
    completionGate: normalizeCompletionGate(task.routeState?.completionGate),
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
  const search = normalizeSearchState(doc?.search ?? base.search);
  const attemptCounters = normalizeAttemptCounters(doc?.attemptCounters ?? base.attemptCounters);
  const toolReadiness = normalizeToolReadiness(doc?.toolReadiness ?? base.toolReadiness);
  const approachHistory = normalizeApproachHistory(doc?.approachHistory ?? base.approachHistory);
  const patchCandidates = normalizePatchCandidates(doc?.patchCandidates ?? base.patchCandidates);
  const validationRuns = normalizeValidationRuns(doc?.validationRuns ?? base.validationRuns);
  const completionGate = normalizeCompletionGate(doc?.completionGate ?? base.completionGate);

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
    search,
    attemptCounters,
    toolReadiness,
    approachHistory,
    patchCandidates,
    validationRuns,
    completionGate,
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

function stopLossReason(routeState, latestRetrospective) {
  const counters = normalizeAttemptCounters(routeState?.attemptCounters);
  const updatedAt = cleanText(counters.updatedAt);
  const retrospectiveCreatedAt = cleanText(latestRetrospective?.createdAt);
  const coveredByRetrospective =
    latestRetrospective &&
    (!updatedAt || (retrospectiveCreatedAt && retrospectiveCreatedAt >= updatedAt));

  if (coveredByRetrospective) {
    return "";
  }

  if (counters.sameStrategyFailureCount >= 3) {
    return `同一工具链 + 同一策略连续失败 ${counters.sameStrategyFailureCount} 次`;
  }
  if (counters.tombstoneCount >= 5) {
    return `累计 tombstone/SIGSEGV/SIGABRT ${counters.tombstoneCount} 次`;
  }
  if (counters.userNegativeSignalCount > 0) {
    return `用户负面反馈信号 ${counters.userNegativeSignalCount} 次`;
  }
  if (counters.failedCount >= 12) {
    return `累计失败尝试 ${counters.failedCount} 次`;
  }
  if (counters.totalAttempts >= 30 && counters.successCount < 3) {
    return `累计尝试 ${counters.totalAttempts} 次但成功不足 3 次`;
  }
  if (counters.exhaustedFamilies.length > 0) {
    return `已耗尽方法族: ${counters.exhaustedFamilies.join(", ")}`;
  }
  if (counters.deadEndObjects.length > 0) {
    return `已标记死路目标: ${counters.deadEndObjects.join(", ")}`;
  }
  return "";
}

function taskPrefersTool(task, toolName) {
  const preferredTools = ensureArray(task?.toolchain?.preferredTools).map((item) => cleanText(item).toLowerCase());
  return preferredTools.includes(cleanText(toolName).toLowerCase());
}

function preferredToolPreflight(routeState, task) {
  if (!taskPrefersTool(task, "mt-mcp")) {
    return null;
  }
  const mtStatus = normalizeToolReadiness(routeState?.toolReadiness).tools["mt-mcp"]?.status || "unknown";
  if (["verified", "blocked", "unavailable", "skipped"].includes(mtStatus)) {
    return null;
  }
  return {
    reason: "用户声明 mt-mcp 为优先工具，但 route-state.toolReadiness 尚未记录 verified/blocked/unavailable/skipped。",
    action:
      "先完成 MT 预检：确认 MT 管理器前台，若用户提供 HTTP MCP endpoint 则执行 JSON-RPC initialize 和 tools/list，再用 task-record-attempt --kind=tool 记录结果。"
  };
}

function latestInvalidValidation(routeState) {
  const latest = ensureArray(routeState?.validationRuns).slice(-1)[0] || null;
  return latest?.status === "invalid" ? latest : null;
}

function weakProposedPatchCandidate(routeState) {
  return ensureArray(routeState?.patchCandidates).find((candidate) =>
    candidate.status === "proposed" &&
    (!cleanText(candidate.hypothesis) ||
      !cleanText(candidate.expectedObservation) ||
      normalizeEvidenceRefs(candidate.rootCauseEvidenceRefs).length === 0 ||
      !cleanText(candidate.rollbackPlan))
  ) || null;
}

function taskRequiresPatchBaseline(task) {
  return cleanText(task?.deliverableTier).toUpperCase() === "T3" ||
    ensureArray(task?.deliverables).some((item) => item?.required !== false && cleanText(item?.tier).toUpperCase() === "T3");
}

function patchBaselinePassed(task) {
  const baseline = task?.patchBaseline || {};
  return cleanText(baseline.status).toLowerCase() === "passed" &&
    baseline.signatureVerified === true &&
    baseline.installed === true &&
    baseline.launched === true &&
    ensureArray(baseline.evidenceRefs).length > 0;
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
  const stopLoss = stopLossReason(routeState, latestRetrospective);
  const toolPreflight = preferredToolPreflight(routeState, task);
  const invalidValidation = latestInvalidValidation(routeState);
  const weakPatchCandidate = weakProposedPatchCandidate(routeState);

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

  if (current.pauseCategory === "user" || task.executionContext?.userActionRequired === true) {
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

  if (toolPreflight) {
    return stamp(
      {
        status: "needs-tool-preflight",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: toolPreflight.reason,
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: toolPreflight.action,
        summary: "用户优先工具未被结构化验证前，不允许静默降级到 adb / Frida / rg。"
      },
    );
  }

  if (taskRequiresPatchBaseline(task) && nextPhase === "Patch" && !patchBaselinePassed(task)) {
    return stamp(
      {
        status: "needs-evidence",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: "T3 尚未建立 no-op 重打包、重签、安装和冷启动基线。",
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "先完成 no-op re-sign baseline 并用 task-baseline 记录签名、安装、启动及证据，再应用首个业务 patch。",
        summary: "构建成功不等于重签基线；基线失败时不能把后续失败归因于业务 patch。"
      }
    );
  }

  if (invalidValidation) {
    return stamp(
      {
        status: "needs-evidence",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: `最近一次验证 ${invalidValidation.id} 被标记为 invalid：${invalidValidation.invalidReason || "未记录原因"}`,
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "先修复验证环境或重新执行有效验证；invalid run 不能作为 patch 或完成依据。",
        summary: "验证无效时不能继续基于该结果推进。"
      },
    );
  }

  if (weakPatchCandidate) {
    return stamp(
      {
        status: "needs-evidence",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: `patch candidate ${weakPatchCandidate.id} 缺少根因假设、证据、预期观察或回滚计划。`,
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: "先补齐 patch candidate 的 rootCauseEvidenceRefs / expectedObservation / rollbackPlan，再允许构建或安装验证。",
        summary: "T3 patch 必须是最小根因候选，不能只靠聊天推断推进。"
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

  if (stopLoss) {
    return stamp(
      {
        status: "needs-retrospective",
        autoAdvanceEligible: false,
        pauseCategory: "internal",
        pauseReason: stopLoss,
        nextEntrypointId: "",
        nextPhase,
        nextExecutableAction: `先补一次 retrospective：说明 ${stopLoss} 的根因、已放弃的同策略路径、下一条不同层级 probe，再继续执行。`,
        summary: "stop-loss 已触发；当前不能继续同策略迭代。"
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
  task.routeState.search = { ...routeState.search };
  task.routeState.attemptCounters = {
    ...routeState.attemptCounters,
    failurePatterns: (routeState.attemptCounters?.failurePatterns || []).slice(),
    exhaustedFamilies: (routeState.attemptCounters?.exhaustedFamilies || []).slice(),
    deadEndObjects: (routeState.attemptCounters?.deadEndObjects || []).slice()
  };
  task.routeState.toolReadiness = {
    tools: Object.fromEntries(
      Object.entries(routeState.toolReadiness?.tools || {}).map(([toolName, entry]) => [toolName, { ...entry }])
    )
  };
  task.routeState.approachHistory = (routeState.approachHistory || []).slice(-5).map((record) => ({ ...record }));
  task.routeState.patchCandidates = (routeState.patchCandidates || []).slice(-3).map((candidate) => ({ ...candidate }));
  task.routeState.validationRuns = (routeState.validationRuns || []).slice(-3).map((run) => ({ ...run }));
  task.routeState.completionGate = {
    ...routeState.completionGate,
    criteriaStatus: (routeState.completionGate?.criteriaStatus || []).slice()
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
  const latestAttempt = (routeState.approachHistory || []).slice(-1)[0] || null;
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
    `- Tool Readiness: ${
      Object.entries(routeState.toolReadiness?.tools || {})
        .map(([toolName, entry]) => `${toolName}:${entry.status}`)
        .join(", ") || "(none)"
    }`,
    `- Latest Attempt: ${latestAttempt ? `${latestAttempt.id} ${latestAttempt.kind}/${latestAttempt.status}` : "(none)"}`,
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
  lines.push(
    `- Tool Readiness: ${
      Object.entries(routeState.toolReadiness?.tools || {})
        .map(([toolName, entry]) => `${toolName}:${entry.status}`)
        .join(", ") || "(none)"
    }`
  );
  const latestAttempt = (routeState.approachHistory || []).slice(-1)[0];
  lines.push(`- Latest Attempt: ${latestAttempt ? `${latestAttempt.id} ${latestAttempt.kind}/${latestAttempt.status}` : "(none)"}`);
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

export function syncMarkdownViews(taskDir, task, routeState) {
  fs.writeFileSync(taskFile(taskDir, task.routeState.planPath), renderRoutePlanMarkdown(routeState, task));
  fs.writeFileSync(taskFile(taskDir, task.routeState.progressPath), renderProgressMarkdown(routeState));
  fs.writeFileSync(taskFile(taskDir, task.routeState.cluesPath), renderCluesMarkdown(routeState));
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
