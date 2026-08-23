import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const checks = [
  "check-skill-contract.mjs",
  "check-framework-layout.mjs",
  "check-template.mjs",
  "check-task-read-performance.mjs",
  "check-workflow-gates.mjs",
  "check-repair-regressions.mjs",
  "check-topic-manifests.mjs",
  "check-maturity-evidence.mjs",
  "check-capability-coverage.mjs",
  "check-operating-contracts.mjs",
  "check-deliverables.mjs",
  "check-case-topic-alignment.mjs",
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
