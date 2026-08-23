import { exists, failWith, readText } from "./common.mjs";
import { evaluateEvalSet } from "./eval-regression-lib.mjs";
import { readTopicRegistry, topicHasMaturity } from "./topic-registry.mjs";

function coverageLevelFor(score, missingCritical) {
  if (score >= 85 && missingCritical.length === 0) return "coverage-strong";
  if (score >= 70) return "coverage-good";
  if (score >= 50) return "coverage-basic";
  return "coverage-weak";
}

function contractHitRateLevelFor(score) {
  if (score >= 90) return "contract-hit-rate-strong";
  if (score >= 75) return "contract-hit-rate-good";
  if (score >= 60) return "contract-hit-rate-basic";
  return "contract-hit-rate-weak";
}

const capabilities = readTopicRegistry();
const findings = [];
const outputContract = readText("docs/reference/output-contract.md");
const regression = evaluateEvalSet(outputContract);

for (const capability of capabilities) {
  let coveragePoints = 0;
  const missing = [];
  const missingCritical = [];

  const checks = [
    ["protocol", 15, exists(capability.protocol)],
    ["task-model", 15, exists(capability.taskModelFile)],
    ["owner", 5, Boolean(String(capability.owner || "").trim())],
    ["risk-level", 5, Boolean(String(capability.riskLevel || "").trim())],
    ["required-checks", 5, Array.isArray(capability.requiredChecks) && capability.requiredChecks.length > 0],
    ["required-signals", 5, Array.isArray(capability.requiredSignals) && capability.requiredSignals.length > 0],
    [
      "required-task-flags",
      5,
      Array.isArray(capability.requiredTaskFlags) && capability.requiredTaskFlags.length > 0
    ],
    [
      "task-semantics",
      15,
      Boolean(capability.taskSemantics?.presentPath && capability.taskSemantics?.versionPath)
    ],
    [
      "formal-validation",
      10,
      !topicHasMaturity(capability, "guided", "closed-loop", "synthetic-e2e") ||
        Boolean(capability.formalValidation?.presentPath)
    ],
    ["template-artifacts", 15, capability.templateArtifacts.every((file) => exists(file))],
    [
      "qa",
      15,
      capability.qaFiles.every(({ path, needles }) => {
        const text = readText(path);
        return needles.every((needle) => text.includes(needle));
      })
    ],
    ["case", 10, capability.caseFiles.every((file) => exists(file))],
    ["output-contract", 5, capability.outputNeedles.every((needle) => outputContract.includes(needle))]
  ];

  if (topicHasMaturity(capability, "synthetic-e2e")) {
    checks.push(["synthetic-validation", 15, Boolean(capability.synthetic?.id)]);
  }

  for (const [name, weight, passed] of checks) {
    if (passed) {
      coveragePoints += weight;
    } else {
      missing.push(name);
      if (name !== "case" && name !== "template-artifacts") {
        missingCritical.push(name);
      }
    }
  }

  const maxCoveragePoints = checks.reduce((sum, [, weight]) => sum + weight, 0);
  const coverageScore = Math.round((coveragePoints / Math.max(maxCoveragePoints, 1)) * 100);
  const coverageLevel = coverageLevelFor(coverageScore, missingCritical);
  const evalHits = regression.items.filter(
    (item) => item.shouldTrigger && item.expectedRoutes.includes(capability.routeTrack)
  );
  const passedHits = evalHits.filter(
    (item) =>
      item.triggerPassed &&
      item.routeCheck.passed &&
      item.artifactInferenceCheck.passed &&
      item.artifactContractCheck.passed
  );
  const contractHitRateScore = evalHits.length > 0 ? Math.round((passedHits.length / evalHits.length) * 100) : null;
  const contractHitRateLevel =
    contractHitRateScore == null ? "contract-hit-rate-na" : contractHitRateLevelFor(contractHitRateScore);

  console.log(
    `[${capability.key}] coverage=${coverageScore}/100 ${coverageLevel} contract-hit-rate=${contractHitRateScore == null ? "n/a" : `${contractHitRateScore}/100`} ${contractHitRateLevel}`
  );
  if (missing.length > 0) {
    console.log(`  missing: ${missing.join(", ")}`);
  }

  if (coverageScore < 70) {
    findings.push(`${capability.key} coverage is below threshold: ${coverageScore}/100`);
  }
  if (topicHasMaturity(capability, "synthetic-e2e") && evalHits.length === 0) {
    findings.push(`${capability.key} contract-hit-rate is missing eval regression coverage`);
  }
  if (contractHitRateScore != null && contractHitRateScore < 75) {
    findings.push(`${capability.key} contract-hit-rate is below threshold: ${contractHitRateScore}/100`);
  }
}

failWith(findings, "check-specialized-strength");
