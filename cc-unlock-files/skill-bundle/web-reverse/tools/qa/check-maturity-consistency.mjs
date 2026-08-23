import { failWith } from "./common.mjs";
import { listTopicKeys, readTopicManifest } from "../topic-manifests.mjs";

const findings = [];

function hasString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

for (const key of listTopicKeys()) {
  const topic = readTopicManifest(key);
  const maturity = String(topic.maturity || "").trim();
  const prefix = `topics/${key}/topic.json`;

  if (maturity === "synthetic-e2e") {
    if (!topic.synthetic || typeof topic.synthetic !== "object") {
      findings.push(`${prefix} marked synthetic-e2e but missing synthetic section`);
    }
    if (!(topic.requiredChecks || []).includes("check:synthetic-e2e")) {
      findings.push(`${prefix} marked synthetic-e2e but missing check:synthetic-e2e in requiredChecks`);
    }
    continue;
  }

  if (maturity === "closed-loop") {
    if (!topic.taskSemantics || typeof topic.taskSemantics !== "object") {
      findings.push(`${prefix} marked closed-loop but missing taskSemantics`);
    }
    if (!topic.formalValidation || typeof topic.formalValidation !== "object") {
      findings.push(`${prefix} marked closed-loop but missing formalValidation`);
    }
    if (!hasString(topic.taskModelFile)) {
      findings.push(`${prefix} marked closed-loop but missing taskModelFile`);
    }
    if (!hasString(topic.taskPackDir)) {
      findings.push(`${prefix} marked closed-loop but missing taskPackDir`);
    }
    if (!hasNonEmptyArray(topic.caseFiles)) {
      findings.push(`${prefix} marked closed-loop but missing caseFiles`);
    }
    if ((topic.requiredChecks || []).includes("check:synthetic-e2e")) {
      findings.push(`${prefix} marked closed-loop but still depends on check:synthetic-e2e`);
    }
    continue;
  }

  if (maturity === "guided") {
    const hasClosedLoopSignals =
      topic.taskSemantics &&
      topic.formalValidation &&
      hasString(topic.taskModelFile) &&
      hasString(topic.taskPackDir) &&
      hasNonEmptyArray(topic.caseFiles);
    if (hasClosedLoopSignals) {
      findings.push(`${prefix} marked guided but already satisfies closed-loop prerequisites; promote it or remove the extra contracts`);
    }
    continue;
  }

  if (maturity === "reference-only") {
    if (topic.taskSemantics || topic.formalValidation || hasString(topic.taskModelFile) || hasString(topic.taskPackDir)) {
      findings.push(`${prefix} marked reference-only but still carries closed-loop execution contracts`);
    }
    continue;
  }

  findings.push(`${prefix} has unknown maturity "${maturity}"`);
}

failWith(findings, "check-maturity-consistency");
