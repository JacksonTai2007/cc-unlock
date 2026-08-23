import { failWith, readText } from "./common.mjs";
import { evaluateEvalSet } from "./eval-regression-lib.mjs";

const findings = [];
const outputContract = readText("docs/reference/output-contract.md");
const report = evaluateEvalSet(outputContract);
const reasoningItems = report.items.filter(
  (item) => item.expectedReasoningTags.length > 0 || item.forbiddenReasoningTags.length > 0
);

for (const item of reasoningItems) {
  console.log(
    `[${item.id}] reasoning=${item.reasoningCheck.passed ? "OK" : "FAIL"} forbidden=${
      item.forbiddenReasoningPassed ? "OK" : "FAIL"
    }`
  );

  if (!item.reasoningCheck.passed) {
    findings.push(
      `${item.id} 思路标签不完整，期望 ${item.expectedReasoningTags.join(", ")}，实际 ${item.predictedReasoningTags.join(", ")}`
    );
  }

  if (!item.forbiddenReasoningPassed) {
    findings.push(
      `${item.id} 命中了禁止思路标签 ${item.forbiddenReasoningHits.join(", ")}`
    );
  }
}

console.log(
  `reasoning-regression: reasoning=${Math.round(report.summary.reasoningAccuracy * 100)}% forbidden=${Math.round(
    report.summary.forbiddenReasoningAccuracy * 100
  )}% items=${report.summary.reasoningItems}`
);

if (report.summary.reasoningAccuracy < 1) {
  findings.push("思路型回归未达到 100%");
}

if (report.summary.forbiddenReasoningAccuracy < 1) {
  findings.push("禁止思路型回归未达到 100%");
}

failWith(findings, "check-reasoning-regression");
