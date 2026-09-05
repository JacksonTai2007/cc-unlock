import {
  ensureTaskRuntimeShape,
  nowIso,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  writeTaskJson
} from "./common.mjs";
import {
  applyRouteStateToTask,
  normalizeApproachHistory,
  normalizeAttemptCounters,
  normalizePatchCandidates,
  normalizeRouteStateDocument,
  normalizeToolReadiness,
  normalizeValidationRuns,
  readRouteStateDocument,
  resolveExecutionState,
  syncMarkdownViews,
  writeRouteStateDocument
} from "./route-state.mjs";

const validKinds = new Set(["probe", "patch", "verify", "tool", "retrospective", "other"]);
const validStatuses = new Set(["success", "failed", "blocked", "invalid", "inconclusive"]);
const failingStatuses = new Set(["failed", "invalid", "inconclusive"]);

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitList(value) {
  return String(value || "")
    .split(/[;,，；]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) {
    console.error(
      "usage: node tools/task/task-record-attempt.mjs <task-id|task-path> --kind=probe|patch|verify|tool --status=success|failed|blocked|invalid|inconclusive [--proposal] [--strategy=...] [--tool=...] [--entrypoint=EP-001] [--candidate=PATCH-001] [--evidence=path1,path2] [--summary=...] [--hypothesis=...] [--expected=...] [--actual=...] [--classification=...] [--json]"
    );
    process.exit(1);
  }

  const options = {};
  for (const arg of args.filter((item) => item.startsWith("--"))) {
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) {
      options[body] = true;
    } else {
      options[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }
  return { taskRef, options };
}

function nextId(prefix, records) {
  const max = records.reduce((current, record) => {
    const match = cleanText(record?.id).match(/(\d+)$/);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function requireForPatch(record, findings) {
  if (record.kind !== "patch" || record.status === "blocked") {
    return;
  }
  if (!record.strategy) findings.push("patch attempt requires --strategy");
  if (!record.hypothesis) findings.push("patch attempt requires --hypothesis");
  if (!record.expectedObservation) findings.push("patch attempt requires --expected");
  if (record.evidenceRefs.length === 0) findings.push("patch attempt requires --evidence with at least one task-local reference");
  if (!record.rollbackPlan) findings.push("patch attempt requires --rollback");
}

function taskRequiresPatchBaseline(task) {
  return cleanText(task?.deliverableTier).toUpperCase() === "T3" ||
    (task?.deliverables || []).some((item) => item?.required !== false && cleanText(item?.tier).toUpperCase() === "T3");
}

function patchBaselinePassed(task) {
  const baseline = task?.patchBaseline || {};
  return cleanText(baseline.status).toLowerCase() === "passed" &&
    baseline.signatureVerified === true &&
    baseline.installed === true &&
    baseline.launched === true &&
    Array.isArray(baseline.evidenceRefs) && baseline.evidenceRefs.length > 0;
}

function updateAttemptCounters(routeState, record, options) {
  const counters = normalizeAttemptCounters(routeState.attemptCounters);
  counters.totalAttempts += 1;
  if (record.status === "success") {
    counters.successCount += 1;
  } else if (record.status === "blocked") {
    counters.blockedCount += 1;
  } else {
    counters.failedCount += 1;
  }
  if (options.tombstone === true) {
    counters.tombstoneCount += 1;
  }
  if (options["user-negative"] === true || options.userNegative === true) {
    counters.userNegativeSignalCount += 1;
  }
  if (record.classification && failingStatuses.has(record.status)) {
    counters.failurePatterns = Array.from(new Set([...counters.failurePatterns, record.classification]));
  }

  const history = normalizeApproachHistory([...(routeState.approachHistory || []), record]);
  const keyOf = (item) => [item.kind, item.tool, item.strategy, item.entrypointId, item.candidateId].join("|");
  const currentKey = keyOf(record);
  let sameStrategyFailures = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (keyOf(item) !== currentKey || !failingStatuses.has(item.status)) {
      break;
    }
    sameStrategyFailures += 1;
  }
  counters.sameStrategyFailureCount = sameStrategyFailures;
  counters.updatedAt = record.createdAt;
  routeState.attemptCounters = counters;
  routeState.approachHistory = history;
}

function upsertToolReadiness(routeState, record, options) {
  if (record.kind !== "tool") {
    return;
  }
  const tool = record.tool;
  if (!tool) {
    throw new Error("tool attempt requires --tool");
  }
  const readinessStatus = cleanText(options.readiness).toLowerCase() ||
    (record.status === "success" ? "verified" : record.status === "blocked" ? "blocked" : "unavailable");
  const toolReadiness = normalizeToolReadiness(routeState.toolReadiness);
  toolReadiness.tools[tool] = {
    status: ["verified", "blocked", "unavailable", "skipped"].includes(readinessStatus)
      ? readinessStatus
      : "unavailable",
    endpoint: cleanText(options.endpoint),
    foregroundVerified: options.foreground === true || options["foreground-verified"] === true,
    toolsListed: options["tools-listed"] === true,
    apkOpened: options["apk-opened"] === true,
    reason: record.actualObservation,
    evidenceRefs: record.evidenceRefs.slice(),
    updatedAt: record.createdAt
  };
  routeState.toolReadiness = toolReadiness;
}

function upsertPatchCandidate(routeState, record, options) {
  if (record.kind !== "patch" || !record.candidateId) {
    return;
  }
  const candidates = normalizePatchCandidates(routeState.patchCandidates);
  const existing = candidates.find((candidate) => candidate.id === record.candidateId);
  const statusMap = new Map([
    ["success", "verified"],
    ["failed", "failed"],
    ["invalid", "failed"],
    ["blocked", "blocked"],
    ["inconclusive", "built"]
  ]);
  const next = {
    ...(existing || {}),
    id: record.candidateId,
    baseApk: cleanText(options.baseApk || options.base),
    parentCandidate: cleanText(options.parent),
    hypothesis: record.hypothesis || existing?.hypothesis || "",
    rootCauseEvidenceRefs: record.evidenceRefs.length > 0 ? record.evidenceRefs : existing?.rootCauseEvidenceRefs || [],
    expectedObservation: record.expectedObservation || existing?.expectedObservation || "",
    rollbackPlan: record.rollbackPlan || cleanText(options.rollback || options["rollback-plan"] || existing?.rollbackPlan),
    status: options.proposal === true ? "proposed" : statusMap.get(record.status) || existing?.status || "proposed",
    resultSummary: record.actualObservation || existing?.resultSummary || "",
    createdAt: existing?.createdAt || record.createdAt,
    updatedAt: record.createdAt
  };
  routeState.patchCandidates = normalizePatchCandidates([
    ...candidates.filter((candidate) => candidate.id !== record.candidateId),
    next
  ]);
}

function appendValidationRun(routeState, record, options) {
  if (record.kind !== "verify") {
    return;
  }
  const status = cleanText(options.validity).toLowerCase() ||
    (record.status === "success" ? "valid" : record.status === "invalid" ? "invalid" : record.status);
  const runs = normalizeValidationRuns(routeState.validationRuns);
  routeState.validationRuns = normalizeValidationRuns([
    ...runs,
    {
      id: nextId("VAL", runs),
      candidateId: record.candidateId,
      status,
      scope: cleanText(options.scope),
      expectedObservation: record.expectedObservation,
      actualObservation: record.actualObservation,
      evidenceRefs: record.evidenceRefs,
      invalidReason: record.invalidReason,
      createdAt: record.createdAt
    }
  ]);
}

function main() {
  const { taskRef, options } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  let routeState = readRouteStateDocument(taskDir, task);
  if (!routeState) {
    routeState = normalizeRouteStateDocument({}, task);
  }
  routeState = normalizeRouteStateDocument(routeState, task);

  const kind = cleanText(options.kind).toLowerCase() || "other";
  const status = cleanText(options.status).toLowerCase() || "inconclusive";
  const findings = [];
  if (!validKinds.has(kind)) findings.push(`invalid --kind: ${kind}`);
  if (!validStatuses.has(status)) findings.push(`invalid --status: ${status}`);

  const record = {
    id: nextId("ATT", routeState.approachHistory || []),
    kind: validKinds.has(kind) ? kind : "other",
    status: validStatuses.has(status) ? status : "inconclusive",
    strategy: cleanText(options.strategy),
    tool: cleanText(options.tool),
    entrypointId: cleanText(options.entrypoint || options.entrypointId),
    candidateId: cleanText(options.candidate || options.candidateId),
    hypothesis: cleanText(options.hypothesis),
    expectedObservation: cleanText(options.expected || options.expectedObservation),
    actualObservation: cleanText(options.actual || options.summary || options.actualObservation),
    classification: cleanText(options.classification || options.failurePattern || options.failedPattern),
    evidenceRefs: splitList(options.evidence || options.evidenceRefs),
    validity: cleanText(options.validity),
    invalidReason: cleanText(options.invalidReason || options["invalid-reason"]),
    rollbackPlan: cleanText(options.rollback || options["rollback-plan"]),
    createdAt: nowIso()
  };

  requireForPatch(record, findings);
  if (record.kind === "patch" && options.proposal !== true && taskRequiresPatchBaseline(task) && !patchBaselinePassed(task)) {
    findings.push("business patch attempts require a passed no-op re-sign baseline; use --proposal to record a candidate without applying it");
  }
  if (record.kind === "tool" && !record.tool) findings.push("tool attempt requires --tool");
  if (record.kind === "verify" && record.status === "invalid" && !record.invalidReason) {
    findings.push("invalid verify attempt requires --invalid-reason");
  }
  if (findings.length > 0) {
    console.error(`task-record-attempt: ${findings.join("; ")}`);
    process.exit(1);
  }

  updateAttemptCounters(routeState, record, options);
  upsertToolReadiness(routeState, record, options);
  upsertPatchCandidate(routeState, record, options);
  appendValidationRun(routeState, record, options);

  routeState.execution = resolveExecutionState(task, routeState);
  routeState = writeRouteStateDocument(taskDir, task, routeState);
  syncMarkdownViews(taskDir, task, routeState);
  applyRouteStateToTask(task, routeState);
  writeTaskJson(taskDir, task);

  const payload = {
    task: relFromRepo(taskDir),
    recorded: record,
    execution: routeState.execution
  };
  if (options.json === true) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`task-record-attempt: ${payload.task}`);
  console.log(`recorded=${record.id} ${record.kind}/${record.status}`);
  console.log(`execution.status=${routeState.execution.status}`);
  console.log(`execution.nextExecutableAction=${routeState.execution.nextExecutableAction || "(none)"}`);
}

main();
