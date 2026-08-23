import fs from "node:fs";
import path from "node:path";
import { failWith, repoRoot } from "./common.mjs";

const findings = [];
const templateDir = path.join(repoRoot, "artifacts", "tasks", "_TEMPLATE");

const validPhases = new Set([
  "Observe",
  "Capture",
  "Rebuild",
  "Patch",
  "PureExtraction",
  "Port",
  "Close"
]);

const validExecutionStatuses = new Set([
  "not-evaluated",
  "ready-to-continue",
  "needs-route-rebuild",
  "needs-retrospective",
  "blocked-on-user",
  "blocked-on-risk",
  "completed"
]);

const validPauseCategories = new Set(["none", "user", "risk", "internal"]);

const validEntrypointStatuses = new Set([
  "CANDIDATE",
  "PROBING",
  "EXPANDED",
  "PARKED",
  "EXHAUSTED",
  "SUCCESS"
]);

const allowedTransitions = {
  Observe: ["Capture", "Rebuild", "Patch", "Observe"],
  Capture: ["Rebuild", "Patch", "PureExtraction", "Capture", "Observe"],
  Rebuild: ["Patch", "PureExtraction", "Port", "Rebuild", "Capture", "Observe"],
  Patch: ["Rebuild", "PureExtraction", "Port", "Patch", "Capture", "Observe"],
  PureExtraction: ["Port", "PureExtraction", "Rebuild", "Patch"],
  Port: ["Close", "Port", "PureExtraction", "Rebuild"],
  Close: ["Close"]
};

function checkRouteStateStructure() {
  const routeStatePath = path.join(templateDir, "state", "route-state.json");
  if (!fs.existsSync(routeStatePath)) {
    findings.push("template route-state.json is missing");
    return;
  }

  const routeState = JSON.parse(fs.readFileSync(routeStatePath, "utf8"));

  if (!Number(routeState.schemaVersion)) {
    findings.push("route-state.schemaVersion must be a positive number");
  }

  if (!String(routeState.taskId || "").trim()) {
    findings.push("route-state.taskId must be a non-empty string");
  }

  if (!validPhases.has(routeState.phase)) {
    findings.push(`route-state.phase must be one of ${Array.from(validPhases).join(", ")}`);
  }

  if (!routeState.execution || typeof routeState.execution !== "object") {
    findings.push("route-state.execution must be an object");
    return;
  }

  if (!validExecutionStatuses.has(routeState.execution.status)) {
    findings.push(`route-state.execution.status must be one of ${Array.from(validExecutionStatuses).join(", ")}`);
  }

  if (!validPauseCategories.has(routeState.execution.pauseCategory)) {
    findings.push(`route-state.execution.pauseCategory must be one of ${Array.from(validPauseCategories).join(", ")}`);
  }

  if (
    routeState.execution.status === "blocked-on-user" &&
    routeState.execution.pauseCategory !== "user"
  ) {
    findings.push("execution.status=blocked-on-user requires pauseCategory=user");
  }

  if (
    routeState.execution.status === "blocked-on-risk" &&
    routeState.execution.pauseCategory !== "risk"
  ) {
    findings.push("execution.status=blocked-on-risk requires pauseCategory=risk");
  }

  if (
    routeState.execution.status === "ready-to-continue" &&
    routeState.execution.pauseCategory !== "none"
  ) {
    findings.push("execution.status=ready-to-continue requires pauseCategory=none");
  }

  if (!Array.isArray(routeState.entrypoints)) {
    findings.push("route-state.entrypoints must be an array");
  } else {
    for (const ep of routeState.entrypoints) {
      if (!String(ep.id || "").trim()) {
        findings.push("each entrypoint must have a non-empty id");
      }
      if (!validEntrypointStatuses.has(ep.status)) {
        findings.push(`entrypoint ${ep.id || "?"} status must be one of ${Array.from(validEntrypointStatuses).join(", ")}`);
      }
    }
  }

  if (!Array.isArray(routeState.activeEntrypoints)) {
    findings.push("route-state.activeEntrypoints must be an array");
  }
}

function checkPhaseTransitions() {
  const phases = Array.from(validPhases);
  for (let index = 0; index < phases.length; index += 1) {
    const from = phases[index];
    const allowed = allowedTransitions[from];
    if (!allowed) {
      findings.push(`phase ${from} has no defined transitions`);
      continue;
    }
    for (const to of validPhases) {
      if (from === to) {
        continue;
      }
      if (!allowed.includes(to)) {
        // Allowed; this is just a validation that the matrix is complete
      }
    }
  }
}

function checkVmTriageStructure() {
  const routeStatePath = path.join(templateDir, "state", "route-state.json");
  if (!fs.existsSync(routeStatePath)) {
    return;
  }

  const routeState = JSON.parse(fs.readFileSync(routeStatePath, "utf8"));
  if (!routeState.vmTriage) {
    return;
  }

  const validVmTriageResults = new Set([
    "not-applicable",
    "not-started",
    "blackbox",
    "browser-controlled",
    "deep-analysis"
  ]);

  if (!validVmTriageResults.has(routeState.vmTriage.triageResult)) {
    findings.push(`vmTriage.triageResult must be one of ${Array.from(validVmTriageResults).join(", ")}`);
  }
}

checkRouteStateStructure();
checkPhaseTransitions();
checkVmTriageStructure();

failWith(findings, "check-route-state-validity");
