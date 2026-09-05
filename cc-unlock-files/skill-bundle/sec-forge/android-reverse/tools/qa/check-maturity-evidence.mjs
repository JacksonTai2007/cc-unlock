import { failWith } from "./common.mjs";
import { readTopicRegistry } from "../topic-registry.mjs";

const maturityOrder = ["reference-only", "guided", "closed-loop", "synthetic-e2e"];
const topics = readTopicRegistry();
const findings = [];

const caseUsage = new Map();
for (const topic of topics) {
  for (const caseFile of topic.caseFiles || []) {
    const current = caseUsage.get(caseFile) || [];
    current.push(topic.key);
    caseUsage.set(caseFile, current);
  }
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function ruleChecksFor(topic, level) {
  const formalValidation = topic.formalValidation || {};
  const requiredArtifacts = formalValidation.requiredArtifacts || [];
  const requirementsAll = formalValidation.requirementsAll || [];
  const requirementsAny = formalValidation.requirementsAny || [];
  const minArtifacts = Number(topic.taskSemantics?.minArtifacts || 0);
  const sharedCases = (topic.caseFiles || []).filter((caseFile) => (caseUsage.get(caseFile) || []).length > 1);

  const guided = [
    ["protocol", Boolean(topic.protocol)],
    ["task-model", Boolean(topic.taskModelFile)],
    ["case-files", hasNonEmptyArray(topic.caseFiles)],
    ["template-artifacts", hasNonEmptyArray(topic.templateArtifacts)],
    ["present-path", Boolean(topic.taskSemantics?.presentPath)],
    ["formal-validation-present-path", Boolean(formalValidation.presentPath)],
    ["required-checks", hasNonEmptyArray(topic.requiredChecks)]
  ];

  if (level === "guided") {
    return guided;
  }

  const closedLoop = [
    ...guided,
    ["dedicated-case-files", sharedCases.length === 0],
    ["formal-required-artifacts", requiredArtifacts.length >= 1],
    ["formal-requirements", requirementsAll.length + requirementsAny.length >= 1],
    ["task-min-artifacts>=1", minArtifacts >= 1]
  ];

  if (level === "closed-loop") {
    return closedLoop;
  }

  if (level === "synthetic-e2e") {
    return [
      ...closedLoop,
      ["task-version-path", Boolean(topic.taskSemantics?.versionPath)],
      ["formal-required-artifacts>=2", requiredArtifacts.length >= 2],
      ["task-min-artifacts>=2", minArtifacts >= 2],
      ["task-pack-files>=2", (topic.taskPackFiles || []).length >= 2]
    ];
  }

  return [];
}

function supportsMaturity(topic, level) {
  return ruleChecksFor(topic, level).every(([, passed]) => passed === true);
}

function highestSupportedMaturity(topic) {
  let highest = "reference-only";
  for (const level of maturityOrder.slice(1)) {
    if (supportsMaturity(topic, level)) {
      highest = level;
    } else {
      break;
    }
  }
  return highest;
}

function missingChecks(topic, level) {
  return ruleChecksFor(topic, level)
    .filter(([, passed]) => passed !== true)
    .map(([name]) => name);
}

for (const topic of topics) {
  const declared = String(topic.maturity || "reference-only");
  const supported = highestSupportedMaturity(topic);
  console.log(`[${topic.key}] maturity declared=${declared} supported=${supported}`);

  if (maturityOrder.indexOf(declared) > maturityOrder.indexOf(supported)) {
    const missing = missingChecks(topic, declared);
    const remedy = missing.includes("case-files")
      ? `; remedy: add at least one file to topic.json caseFiles (see scripts/cases/abstract-case-template.mjs), or downgrade maturity to reference-only`
      : "";
    findings.push(
      `${topic.key} declares ${declared} but evidence only satisfies ${supported}: ${missing.join(", ")}${remedy}`
    );
  }
}

failWith(findings, "check-maturity-evidence");
