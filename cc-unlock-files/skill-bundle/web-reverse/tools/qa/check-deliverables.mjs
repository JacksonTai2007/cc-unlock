import { failWith } from "./common.mjs";
import { evaluateDeliverablesSnapshot } from "../task/validation.mjs";
import { loadTaskSnapshots } from "./task-snapshot-lib.mjs";

const findings = [];

for (const snapshot of loadTaskSnapshots()) {
  const taskFindings = evaluateDeliverablesSnapshot(snapshot);
  for (const finding of taskFindings) {
    findings.push(`${snapshot.taskDir}: ${finding}`);
  }
}

failWith(findings, "check-deliverables");
