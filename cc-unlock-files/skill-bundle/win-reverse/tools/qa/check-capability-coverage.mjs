import { exists, failWith, readText } from "./common.mjs";
import { readTopicRegistry } from "../topic-registry.mjs";

const findings = [];
const outputContract = readText("docs/reference/output-contract.md");

for (const topic of readTopicRegistry()) {
  const missing = [];
  const checks = [
    ["protocol", exists(topic.protocol)],
    ["task-model", exists(topic.taskModelFile)],
    ["case", (topic.caseFiles || []).every((file) => exists(file))],
    ["artifacts", (topic.templateArtifacts || []).every((file) => exists(file))],
    ["signals", (topic.signals || []).length > 0],
    ["required-checks", Array.isArray(topic.requiredChecks) && topic.requiredChecks.length > 0],
    ["output-contract", (topic.outputNeedles || []).every((needle) => outputContract.includes(needle))]
  ];

  for (const [name, passed] of checks) {
    if (!passed) {
      missing.push(name);
    }
  }

  console.log(`[${topic.key}] capability-coverage=${checks.length - missing.length}/${checks.length}`);
  if (missing.length > 0) {
    findings.push(`${topic.key} capability closure is incomplete: ${missing.join(", ")}`);
  }
}

failWith(findings, "check-capability-coverage");
