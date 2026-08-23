import path from "node:path";
import { failWith } from "./common.mjs";
import { readTopicRegistry } from "../topic-registry.mjs";
import { buildTaskFromTemplates } from "../task/common.mjs";

const findings = [];

const allowedPhases = new Set([
  "Observe",
  "Capture",
  "Rebuild",
  "Patch",
  "PureExtraction",
  "Port"
]);

function getValueByPath(target, valuePath) {
  return String(valuePath || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), target);
}

function validateCoreTask(task, label) {
  if (!allowedPhases.has(task.phase)) {
    findings.push(`${label}: phase must be one of ${Array.from(allowedPhases).join(", ")}`);
  }

  if (task.browserSession?.strategy !== "single-instance") {
    findings.push(`${label}: browserSession.strategy must default to single-instance`);
  }

  if (task.routeState?.mode !== "task-local") {
    findings.push(`${label}: routeState.mode must default to task-local`);
  }

  for (const key of ["statePath", "planPath", "cluesPath", "progressPath"]) {
    if (typeof task.routeState?.[key] !== "string" || !task.routeState[key].startsWith("state/")) {
      findings.push(`${label}: routeState.${key} must point to state/`);
    }
  }

  if (!Array.isArray(task.routeState?.activeTracks)) {
    findings.push(`${label}: routeState.activeTracks must be an array`);
  }

  if (!Array.isArray(task.routeState?.activeEntrypoints)) {
    findings.push(`${label}: routeState.activeEntrypoints must be an array`);
  }

  for (const key of ["executionStatus", "nextEntrypointId", "nextExecutableAction", "pauseCategory", "pauseReason", "lastAdvancedAt"]) {
    if (typeof task.routeState?.[key] !== "string") {
      findings.push(`${label}: routeState.${key} must be a string`);
    }
  }


  if (!Array.isArray(task.successCriteria)) {
    findings.push(`${label}: successCriteria must be an array`);
  }
}

function validateTopicSemantics(topic) {
  const semantics = topic.taskSemantics;
  const label = `${topic.key} extension`;

  if (!String(topic.owner || "").trim()) {
    findings.push(`${label}: owner must be set`);
  }

  if (!String(topic.riskLevel || "").trim()) {
    findings.push(`${label}: riskLevel must be set`);
  }

  if (!Array.isArray(topic.requiredChecks) || topic.requiredChecks.length === 0) {
    findings.push(`${label}: requiredChecks must be a non-empty array`);
  }


  if (!String(topic.taskPackDir || "").trim()) {
    findings.push(`${label}: taskPackDir must be set`);
  }

  if (!Array.isArray(topic.requiredSignals) || topic.requiredSignals.length === 0) {
    findings.push(`${label}: requiredSignals must be a non-empty array`);
  }

  if (!Array.isArray(topic.requiredTaskFlags) || topic.requiredTaskFlags.length === 0) {
    findings.push(`${label}: requiredTaskFlags must be a non-empty array`);
  }

  if (!Array.isArray(topic.taskPackFiles) || topic.taskPackFiles.length === 0) {
    findings.push(`${label}: taskPackFiles must be a non-empty array`);
  }

  if (!semantics) {
    return;
  }

  const extensionFile = path.basename(topic.taskModelFile);
  const task = buildTaskFromTemplates({ taskId: "sample", extensionFiles: [extensionFile] });

  if (getValueByPath(task, semantics.presentPath) !== true) {
    findings.push(`${label}: ${semantics.presentPath} must be true`);
  }

  if (Number(getValueByPath(task, semantics.versionPath) || 0) < 1) {
    findings.push(`${label}: ${semantics.versionPath} must be set`);
  }

  if (semantics.artifactsPath) {
    const artifacts = getValueByPath(task, semantics.artifactsPath);
    if (!Array.isArray(artifacts) || artifacts.length < Number(semantics.minArtifacts || 0)) {
      findings.push(
        `${label}: ${semantics.artifactsPath} must list at least ${Number(semantics.minArtifacts || 0)} artifacts`
      );
    }
  }

  for (const arrayPath of semantics.arrayPaths || []) {
    if (!Array.isArray(getValueByPath(task, arrayPath))) {
      findings.push(`${label}: ${arrayPath} must be an array`);
    }
  }

  for (const rule of semantics.requiredValues || []) {
    if (getValueByPath(task, rule.path) !== rule.equals) {
      findings.push(`${label}: ${rule.path} must be ${JSON.stringify(rule.equals)}`);
    }
  }
}

validateCoreTask(buildTaskFromTemplates({ taskId: "sample" }), "core");
for (const topic of readTopicRegistry()) {
  validateTopicSemantics(topic);
}

failWith(findings, "check-task-semantics");
