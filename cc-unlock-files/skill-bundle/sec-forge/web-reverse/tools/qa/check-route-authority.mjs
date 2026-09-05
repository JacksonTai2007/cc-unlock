import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { failWith, repoRoot } from "./common.mjs";
import { normalizeRouteStateDocument } from "../task/route-state.mjs";

const findings = [];
const qaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
function checkNormalizeDoesNotResurrectTaskState() {
  const task = {
    taskId: "demo",
    phase: "Observe",
    routeState: {
      syncStatus: "not-started",
      activeTracks: ["STALE-TRACK"],
      activeEntrypoints: ["EP-999"]
    },
  };

  const doc = {
    taskId: "demo",
    phase: "Observe",
    syncStatus: "restored-from-route-state",
    activeTracks: ["A"],
    activeEntrypoints: ["EP-001"],
    tracks: [{ title: "A", status: "PENDING", checkpoints: [], nextStep: "A1" }],
    entrypoints: [{ id: "EP-001", title: "real", status: "CANDIDATE" }],
    retrospectives: [],
    clues: []
  };

  const normalized = normalizeRouteStateDocument(doc, task);
  if (normalized.activeTracks.includes("STALE-TRACK")) {
    findings.push("normalizeRouteStateDocument resurrected stale task.routeState.activeTracks data");
  }
  if (normalized.activeEntrypoints.includes("EP-999")) {
    findings.push("normalizeRouteStateDocument resurrected stale task.routeState.activeEntrypoints data");
  }
}

function checkTaskSyncPreservesLossySignal() {
  const taskId = `__qa-route-authority-${Date.now()}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-route-authority-"));
  const taskDir = path.join(tempRoot, taskId);
  const templateDir = path.join(qaRoot, "artifacts", "tasks", "_TEMPLATE");

  try {
    fs.cpSync(templateDir, taskDir, { recursive: true });

    const taskJsonPath = path.join(taskDir, "task.json");
    const routeStatePath = path.join(taskDir, "state", "route-state.json");
    const routePlanPath = path.join(taskDir, "state", "route-plan.md");
    const progressPath = path.join(taskDir, "state", "progress.md");
    const cluesPath = path.join(taskDir, "state", "clues.md");

    const task = JSON.parse(fs.readFileSync(taskJsonPath, "utf8"));
    task.taskId = taskId;
    task.routeState.syncStatus = "restored-from-route-state";
    task.routeState.activeTracks = ["STALE-TRACK"];
    task.routeState.activeEntrypoints = ["EP-999"];
    fs.writeFileSync(taskJsonPath, JSON.stringify(task, null, 2) + "\n");

    const routeState = JSON.parse(fs.readFileSync(routeStatePath, "utf8"));
    routeState.taskId = taskId;
    routeState.syncStatus = "backfilled-from-markdown-lossy";
    routeState.activeTracks = ["A"];
    routeState.activeEntrypoints = ["EP-001"];
    fs.writeFileSync(routeStatePath, JSON.stringify(routeState, null, 2) + "\n");

    fs.writeFileSync(
      routePlanPath,
      [
        "# Route Plan",
        "",
        "## Current Status",
        "",
        "- Active Tracks: A",
        "- Active Entrypoints: EP-001",
        "",
        "### A",
        "",
        "- Target: ",
        "",
        "## Entrypoint Loop",
        "",
        "#### EP-001 Placeholder",
        "",
        "- Hypothesis: ",
        ""
      ].join("\n")
    );
    fs.writeFileSync(progressPath, "# Progress\n");
    fs.writeFileSync(cluesPath, "# Clues\n");

    const syncResult = spawnSync(process.execPath, [path.join(repoRoot, "tools", "task", "task-sync.mjs"), taskDir], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    if (syncResult.status !== 0) {
      findings.push(`task-sync regression fixture failed to run: ${(syncResult.stderr || syncResult.stdout || "").trim()}`);
      return;
    }

    const syncedRouteState = JSON.parse(fs.readFileSync(routeStatePath, "utf8"));
    const syncedTask = JSON.parse(fs.readFileSync(taskJsonPath, "utf8"));

    if (syncedRouteState.syncStatus !== "backfilled-from-markdown-lossy") {
      findings.push(`task-sync masked lossy state; expected backfilled-from-markdown-lossy, got ${syncedRouteState.syncStatus}`);
    }
    if (syncedRouteState.activeTracks.includes("STALE-TRACK")) {
      findings.push("task-sync wrote stale activeTracks back into route-state.json");
    }
    if (syncedRouteState.activeEntrypoints.includes("EP-999")) {
      findings.push("task-sync wrote stale activeEntrypoints back into route-state.json");
    }
    if (JSON.stringify(syncedTask.routeState.activeTracks) !== JSON.stringify(syncedRouteState.activeTracks)) {
      findings.push("task-sync left task.json.routeState.activeTracks out of sync with route-state.json");
    }
    if (JSON.stringify(syncedTask.routeState.activeEntrypoints) !== JSON.stringify(syncedRouteState.activeEntrypoints)) {
      findings.push("task-sync left task.json.routeState.activeEntrypoints out of sync with route-state.json");
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

checkNormalizeDoesNotResurrectTaskState();
checkTaskSyncPreservesLossySignal();

failWith(findings, "check-route-authority");
