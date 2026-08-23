import fs from "node:fs";
import path from "node:path";
import { readJsonFile, resolveTaskDir, taskFile } from "./common.mjs";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function criterionStatus(item) {
  if (item && typeof item === "object") {
    const status = cleanText(item.status).toLowerCase();
    if (item.hit === true || ["hit", "met", "passed", "done", "satisfied"].includes(status)) return "met";
    if (["blocked", "rejected"].includes(status)) return status;
    return "pending";
  }
  return /^\[x\](?:\s|$)/i.test(cleanText(item)) ? "met" : "pending";
}

function migrateTask(rawTask) {
  const task = structuredClone(rawTask || {});
  const sourceCriteria = Array.isArray(task.completionCriteria) && task.completionCriteria.length > 0
    ? task.completionCriteria
    : (Array.isArray(task.successCriteria) ? task.successCriteria : []);
  task.schemaVersion = 2;
  task.completionCriteria = sourceCriteria.map((item, index) => ({
    ...(item && typeof item === "object" ? item : {}),
    id: cleanText(item?.id) || `criterion-${index + 1}`,
    label: cleanText(item?.label || item?.title || item?.text || String(item || "").replace(/^\[[ xX]\]\s*/, "")),
    status: criterionStatus(item),
    evidenceRefs: Array.isArray(item?.evidenceRefs) ? item.evidenceRefs.map(cleanText).filter(Boolean) : []
  }));
  delete task.successCriteria;
  const tier = /^T[1-5]$/i.test(cleanText(task.deliverableTier)) ? cleanText(task.deliverableTier).toUpperCase() : "T1";
  const allCriteriaMet = task.completionCriteria.length > 0 && task.completionCriteria.every((item) => item.status === "met");
  task.deliverableTier = tier;
  task.deliverables = [
    {
      id: "primary",
      tier,
      criteriaIds: task.completionCriteria.map((item) => item.id),
      status: allCriteriaMet ? "acceptance-ready" : "in-progress",
      required: true
    }
  ];
  task.currentDeliverableId = "primary";
  task.patchBaseline ||= {
    status: "not-started",
    sourceArtifactSha256: "",
    resignedArtifactSha256: "",
    signatureVerified: false,
    installed: false,
    launched: false,
    usedUninstall: false,
    userApprovedDataReset: false,
    evidenceRefs: []
  };
  task.patchRegressionMatrix ||= [];
  task.userAcceptance ||= { status: "not-requested", evidenceRefs: [], confirmedAt: "" };
  if (!cleanText(task.protectionTier)) task.protectionTier = null;
  return task;
}

const taskRef = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!taskRef || !process.argv.includes("--to=2")) {
  console.error("usage: node tools/task/task-migrate.mjs <task-id|task-path> --to=2 [--dry-run]");
  process.exit(1);
}

const taskDir = resolveTaskDir(taskRef);
const taskPath = taskFile(taskDir, "task.json");
const rawTask = readJsonFile(taskPath);
if (Number(rawTask.schemaVersion || 1) >= 2) {
  console.log(`task-migrate: already schemaVersion=${rawTask.schemaVersion}`);
  process.exit(0);
}

const migrated = migrateTask(rawTask);
if (dryRun) {
  console.log(JSON.stringify(migrated, null, 2));
  process.exit(0);
}

const backupPath = path.join(taskDir, "task.json.v1.bak");
const tempPath = path.join(taskDir, "task.json.migrating");
if (!fs.existsSync(backupPath)) fs.copyFileSync(taskPath, backupPath);
fs.writeFileSync(tempPath, `${JSON.stringify(migrated, null, 2)}\n`);
fs.renameSync(tempPath, taskPath);
console.log(`task-migrate: migrated ${migrated.taskId || path.basename(taskDir)} to schemaVersion=2`);
