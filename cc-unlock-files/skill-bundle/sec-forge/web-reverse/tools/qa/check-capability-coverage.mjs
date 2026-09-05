import { exists, failWith, readText } from "./common.mjs";
import { readTopicRegistry, topicHasMaturity } from "./topic-registry.mjs";

const findings = [];
const registry = readTopicRegistry();
const outputContract = readText("docs/reference/output-contract.md");
const reportTemplate = readText("artifacts/tasks/_TEMPLATE/report.md");
const generalCloseoutNeedles = [
  "是否实际采纳",
  "采纳后影响了哪条路线"
];

for (const topic of registry) {
  const missing = [];

  const checks = [
    ["protocol", exists(topic.protocol)],
    ["task-model", exists(topic.taskModelFile)],
    ["owner", Boolean(String(topic.owner || "").trim())],
    ["risk-level", Boolean(String(topic.riskLevel || "").trim())],
    ["required-checks", Array.isArray(topic.requiredChecks) && topic.requiredChecks.length > 0],
    ["required-signals", Array.isArray(topic.requiredSignals) && topic.requiredSignals.length > 0],
    ["required-task-flags", Array.isArray(topic.requiredTaskFlags) && topic.requiredTaskFlags.length > 0],
    ["task-semantics", Boolean(topic.taskSemantics?.presentPath && topic.taskSemantics?.versionPath)],
    ["case", (topic.caseFiles || []).every((file) => exists(file))],
    ["artifacts", (topic.templateArtifacts || []).every((file) => exists(file))],
    [
      "qa",
      (topic.qaFiles || []).every(
        ({ path, needles }) => exists(path) && (needles || []).every((needle) => readText(path).includes(needle))
      )
    ],
    ["closeout-evidence", generalCloseoutNeedles.every((needle) => outputContract.includes(needle))]
  ];

  if (topicHasMaturity(topic, "guided", "closed-loop", "synthetic-e2e")) {
    checks.push(["formal-validation", Boolean(topic.formalValidation?.presentPath)]);
  }
  if (topicHasMaturity(topic, "synthetic-e2e")) {
    checks.push([
      "validation-path",
      Boolean(topic.synthetic?.id) &&
        exists("tools/qa/check-synthetic-e2e.mjs") &&
        exists("artifacts/tasks/_TEMPLATE/run/verify-once.mjs")
    ]);
  }

  for (const [name, passed] of checks) {
    if (!passed) {
      missing.push(name);
    }
  }

  const coverageScore = Math.round(((checks.length - missing.length) / checks.length) * 100);
  console.log(`[${topic.key}] capability-coverage=${coverageScore}/100`);
  if (missing.length > 0) {
    console.log(` missing: ${missing.join(", ")}`);
    findings.push(`${topic.key} capability closure is incomplete: ${missing.join(", ")}`);
  }
}

failWith(findings, "check-capability-coverage");