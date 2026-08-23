import path from "node:path";
import { readTopicRegistry } from "../topic-registry.mjs";
import { failWith, loadCaseModule, repoRoot } from "./common.mjs";

const findings = [];
const topics = readTopicRegistry();

function normalizeDeliverable(value) {
  return String(value || "").trim().replaceAll("\\", "/");
}

for (const topic of topics) {
  const requiredArtifacts = (topic.formalValidation?.requiredArtifacts || []).map(normalizeDeliverable);
  if (requiredArtifacts.length === 0) {
    continue;
  }

  for (const caseFile of topic.caseFiles || []) {
    const fullPath = path.join(repoRoot, ...caseFile.split("/"));
    const mod = await loadCaseModule(fullPath);
    const data = mod.default || {};
    const deliverables = new Set((data.deliverables || []).map(normalizeDeliverable));
    const missing = requiredArtifacts.filter((artifact) => !deliverables.has(artifact));
    if (missing.length > 0) {
      findings.push(
        `${caseFile} must cover ${topic.key} formalValidation.requiredArtifacts: missing ${missing.map((item) => `\`${item}\``).join(", ")}`
      );
    }
  }
}

failWith(findings, "check-case-topic-alignment");
