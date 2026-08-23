import fs from "node:fs";
import path from "node:path";
import {
  containsSuspiciousSecrets,
  failWith,
  loadCaseModule,
  readText,
  rel,
  repoRoot
} from "./common.mjs";

const findings = [];
const casesDir = path.join(repoRoot, "scripts", "cases");
const caseFiles = [
  path.join(casesDir, "abstract-case-template.mjs"),
  ...fs
    .readdirSync(path.join(repoRoot, "topics"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const topic = JSON.parse(
        fs.readFileSync(path.join(repoRoot, "topics", entry.name, "topic.json"), "utf8")
      );
      return (topic.caseFiles || []).map((item) => path.join(repoRoot, ...item.split("/")));
    })
].filter((file, index, all) => all.indexOf(file) === index);

for (const file of caseFiles) {
  const relative = rel(file);
  const source = readText(relative);
  if (containsSuspiciousSecrets(source)) {
    findings.push(`${relative} contains suspicious direct secret/host material`);
  }

  const mod = await loadCaseModule(file);
  const data = mod.default;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    findings.push(`${relative} must default export an object`);
    continue;
  }

  const expectedCaseId = path.basename(file, ".mjs");
  if (path.basename(file) !== "abstract-case-template.mjs" && data.caseId !== expectedCaseId) {
    findings.push(`${relative} caseId must equal file stem: expected ${expectedCaseId}`);
  }

  for (const requiredKey of [
    "status",
    "category",
    "tags",
    "focus",
    "deliverables",
    "checkpoints",
    "caveats",
    "entrypoints",
    "probeSequence",
    "evidenceAnchors",
    "pivotSignals",
    "successSignals"
  ]) {
    if (!(requiredKey in data)) {
      findings.push(`${relative} missing required case field: ${requiredKey}`);
    }
  }

  for (const arrayField of [
    "tags",
    "focus",
    "deliverables",
    "checkpoints",
    "caveats",
    "probeSequence",
    "evidenceAnchors",
    "pivotSignals",
    "successSignals"
  ]) {
    if (!Array.isArray(data[arrayField]) || data[arrayField].length === 0) {
      findings.push(`${relative} ${arrayField} must be a non-empty array`);
    }
  }

  if (!Array.isArray(data.entrypoints) || data.entrypoints.length < 2) {
    findings.push(`${relative} entrypoints must contain at least 2 candidate routes`);
  } else {
    for (const [index, entrypoint] of data.entrypoints.entries()) {
      if (!entrypoint || typeof entrypoint !== "object" || Array.isArray(entrypoint)) {
        findings.push(`${relative} entrypoints[${index}] must be an object`);
        continue;
      }

      for (const key of ["id", "hypothesis", "firstProbe", "expandWhen", "parkWhen"]) {
        if (typeof entrypoint[key] !== "string" || entrypoint[key].trim().length === 0) {
          findings.push(`${relative} entrypoints[${index}].${key} must be a non-empty string`);
        }
      }
    }
  }
}

failWith(findings, "lint-cases");

