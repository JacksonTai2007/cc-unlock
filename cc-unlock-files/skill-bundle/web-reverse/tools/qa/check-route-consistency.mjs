import { failWith } from "./common.mjs";
import { relFromRepo } from "../task/common.mjs";
import { evaluateRouteConsistencySnapshot } from "../task/validation.mjs";
import { loadTaskSnapshots } from "./task-snapshot-lib.mjs";

const findings = [];

for (const snapshot of loadTaskSnapshots()) {
  const taskFindings = evaluateRouteConsistencySnapshot(snapshot);
  for (const finding of taskFindings) {
    findings.push(`${relFromRepo(snapshot.taskDir)}: ${finding}`);
  }
}

failWith(findings, "check-route-consistency");
