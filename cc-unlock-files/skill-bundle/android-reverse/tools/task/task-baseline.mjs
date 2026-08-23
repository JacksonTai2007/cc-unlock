import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureTaskRuntimeShape, nowIso, readTaskJson, resolveTaskDir, writeTaskJson } from "./common.mjs";

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) || "";
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const taskRef = process.argv[2];
const sourcePath = path.resolve(argValue("source"));
const resignedPath = path.resolve(argValue("resigned"));
const apksignerPath = argValue("apksigner") || "apksigner";
const evidenceRefs = argValue("evidence").split(",").map((item) => item.trim()).filter(Boolean);
const signatureVerified = process.argv.includes("--signature-verified");
const installed = process.argv.includes("--installed");
const launched = process.argv.includes("--launched");
const usedUninstall = process.argv.includes("--used-uninstall");
const userApprovedDataReset = process.argv.includes("--data-reset-approved");

if (!taskRef || !argValue("source") || !argValue("resigned")) {
  console.error("usage: node tools/task/task-baseline.mjs <task> --source=<original.apk> --resigned=<noop-resigned.apk> --evidence=<refs> --signature-verified --installed --launched [--apksigner=<path>] [--used-uninstall --data-reset-approved]");
  process.exit(1);
}
if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
  console.error(`task-baseline: missing source artifact: ${sourcePath}`);
  process.exit(1);
}
if (!fs.existsSync(resignedPath) || !fs.statSync(resignedPath).isFile()) {
  console.error(`task-baseline: missing resigned artifact: ${resignedPath}`);
  process.exit(1);
}
if (!signatureVerified || !installed || !launched || evidenceRefs.length === 0) {
  console.error("task-baseline: signature verification, install, launch, and evidence are all required");
  process.exit(1);
}
if (usedUninstall && !userApprovedDataReset) {
  console.error("task-baseline: --used-uninstall requires --data-reset-approved");
  process.exit(1);
}

const taskDir = resolveTaskDir(taskRef);
for (const evidenceRef of evidenceRefs) {
  const evidenceRelPath = evidenceRef.split("#")[0].replace(/:\d+(?::\d+)?$/, "");
  const evidencePath = path.resolve(taskDir, evidenceRelPath);
  const rel = path.relative(taskDir, evidencePath);
  if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(evidencePath) || !fs.statSync(evidencePath).isFile()) {
    console.error(`task-baseline: evidence must reference an existing task-local file: ${evidenceRef}`);
    process.exit(1);
  }
}
const signatureCheck = spawnSync(apksignerPath, ["verify", "--verbose", resignedPath], {
  encoding: "utf8",
  timeout: 30000,
  shell: false
});
if (signatureCheck.error || signatureCheck.status !== 0) {
  const detail = String(signatureCheck.stderr || signatureCheck.stdout || signatureCheck.error?.message || "").trim();
  console.error(`task-baseline: apksigner verification failed: ${detail}`);
  process.exit(1);
}
const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
task.patchBaseline = {
  status: "passed",
  sourceArtifact: sourcePath,
  sourceArtifactSha256: sha256File(sourcePath),
  resignedArtifact: resignedPath,
  resignedArtifactSha256: sha256File(resignedPath),
  signatureVerified,
  signatureVerificationSummary: String(signatureCheck.stdout || "").trim().slice(0, 2000),
  installed,
  launched,
  usedUninstall,
  userApprovedDataReset,
  evidenceRefs,
  verifiedAt: nowIso()
};
writeTaskJson(taskDir, task);
console.log(`task-baseline: passed ${task.taskId}`);
