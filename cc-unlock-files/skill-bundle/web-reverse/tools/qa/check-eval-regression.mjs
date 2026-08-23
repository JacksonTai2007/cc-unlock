import { failWith, readText } from "./common.mjs";
import { evaluateEvalSet } from "./eval-regression-lib.mjs";

const findings = [];
const outputContract = readText("docs/reference/output-contract.md");
const report = evaluateEvalSet(outputContract);

for (const item of report.items) {
  if (item.shouldTrigger) {
    console.log(
      `[${item.id}][positive] trigger=${item.triggerPassed ? "OK" : "FAIL"} routes=${item.routeCheck.passed ? "OK" : "FAIL"} artifact-infer=${item.artifactInferenceCheck.passed ? "OK" : "FAIL"} artifact-contract=${item.artifactContractCheck.passed ? "OK" : "FAIL"}`
    );
  } else {
    const inferredRoutes = item.predictedRoutes.length > 0 ? item.predictedRoutes.join(",") : "none";
    console.log(
      `[${item.id}][negative] trigger=${item.triggerPassed ? "OK" : "FAIL"} inferred-routes=${inferredRoutes} routes=N/A artifact-infer=N/A artifact-contract=N/A`
    );
  }
  if (!item.triggerPassed) {
    findings.push(`${item.id} 触发判断错误`);
  }
  if (item.shouldTrigger && !item.routeCheck.passed) {
    findings.push(`${item.id} 路由不完整，期望 ${item.expectedRoutes.join(", ")}`);
  }
  if (item.shouldTrigger && !item.artifactInferenceCheck.passed) {
    findings.push(`${item.id} 产物推断不完整，期望 ${item.expectedArtifacts.join(", ")}`);
  }
  if (item.shouldTrigger && !item.artifactContractCheck.passed) {
    findings.push(`${item.id} output contract 缺少产物约束，期望 ${item.expectedArtifacts.join(", ")}`);
  }
}

console.log(
  `eval-regression: trigger=${Math.round(report.summary.triggerAccuracy * 100)}% route=${Math.round(report.summary.routeAccuracy * 100)}% artifact-infer=${Math.round(report.summary.artifactInferenceAccuracy * 100)}% artifact-contract=${Math.round(report.summary.artifactContractAccuracy * 100)}%`
);

if (report.summary.triggerAccuracy < 1) {
  findings.push("触发回归未达到 100%");
}
if (report.summary.routeAccuracy < 1) {
  findings.push("路由回归未达到 100%");
}
if (report.summary.artifactInferenceAccuracy < 1) {
  findings.push("产物推断命中率未达到 100%");
}
if (report.summary.artifactContractAccuracy < 1) {
  findings.push("产物契约命中率未达到 100%");
}

failWith(findings, "check-eval-regression");
