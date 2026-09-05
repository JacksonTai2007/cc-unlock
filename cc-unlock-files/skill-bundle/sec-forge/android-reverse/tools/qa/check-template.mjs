import { exists, failWith, readText } from "./common.mjs";

const findings = [];

[
  "artifacts/tasks/_TEMPLATE/task.json",
  "artifacts/tasks/_TEMPLATE/report.md",
  "artifacts/tasks/_TEMPLATE/run/fixtures.json",
  "artifacts/tasks/_TEMPLATE/run/verify-once.mjs",
  "artifacts/tasks/_TEMPLATE/run/verification.spec.json",
  "artifacts/tasks/_TEMPLATE/run/split-delivery-notes.md",
  "artifacts/tasks/_TEMPLATE/run/framework-runtime-notes.md",
  "artifacts/tasks/_TEMPLATE/run/network-stack-notes.md",
  "artifacts/tasks/_TEMPLATE/run/art-runtime-notes.md"
].forEach((file) => {
  if (!exists(file)) {
    findings.push(`missing template file: ${file}`);
  }
});

const taskJson = readText("artifacts/tasks/_TEMPLATE/task.json");
if (!taskJson.includes("\"phase\": \"Observe\"")) {
  findings.push("task.json must default to phase Observe");
}
if (!taskJson.includes("\"protectionTier\": null")) {
  findings.push("task.json must leave protectionTier unassessed until evidence exists");
}
[
  "\"schemaVersion\"",
  "\"objective\"",
  "\"deliverableTier\"",
  "\"deliverables\"",
  "\"completionCriteria\"",
  "\"disallowedFallbacks\"",
  "\"userRejectedApproaches\"",
  "\"routeState\"",
  "\"taskPacks\"",
  "\"validation\"",
  "\"deliveryRequirements\"",
  "\"toolchain\"",
  "\"requirementsStatus\"",
  "\"requiredTopicCards\"",
  "\"coverageNotes\""
].forEach((key) => {
  if (!taskJson.includes(key)) {
    findings.push(`task.json missing section ${key}`);
  }
});

failWith(findings, "check-template");
