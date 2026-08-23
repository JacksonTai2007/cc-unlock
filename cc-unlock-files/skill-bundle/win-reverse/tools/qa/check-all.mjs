import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const checks = [
  "check-skill-contract.mjs",
  "check-doc-facts.mjs",
  "check-framework-layout.mjs",
  "check-topic-manifests.mjs",
  "check-capability-coverage.mjs",
  "check-operating-contracts.mjs",
  "check-deliverables.mjs",
  "check-drill-scenarios.mjs",
  "check-task-behavior.mjs",
  "lint-cases.mjs"
];

let failed = false;
for (const check of checks) {
  const result = spawnSync(process.execPath, [path.join(baseDir, check)], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("check-all: OK");
}

