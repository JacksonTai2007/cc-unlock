import { exists, failWith, readText } from "./common.mjs";

const findings = [];
const reportTemplate = readText("artifacts/tasks/_TEMPLATE/report.md");
for (const needle of ["## 当前阶段", "## 自动续跑决策", "## 下一步"]) {
  if (!reportTemplate.includes(needle)) {
    findings.push(`report template is missing heading: ${needle}`);
  }
}

for (const file of [
  "artifacts/tasks/_TEMPLATE/run/verify-once.mjs",
  "artifacts/tasks/_TEMPLATE/run/fixtures.json",
  "artifacts/tasks/_TEMPLATE/core/run/closeout.mjs"
]) {
  if (!exists(file)) {
    findings.push(`missing core deliverable scaffold: ${file}`);
  }
}

failWith(findings, "check-deliverables");

