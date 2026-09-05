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
const caseFiles = fs
  .readdirSync(casesDir)
  .filter((name) => name.endsWith(".mjs") && name !== "README.md")
  .map((name) => path.join(casesDir, name));

for (const file of caseFiles) {
  const relative = rel(file);
  const source = readText(relative);
  const suspicious = containsSuspiciousSecrets(source);
  if (suspicious) {
    findings.push(`${relative} contains suspicious direct secret/host material`);
  }

  const mod = await loadCaseModule(file);
  const data = mod.default;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    findings.push(`${relative} must default export an object`);
    continue;
  }

  const expectedCaseId = path.basename(file, ".mjs");
  if (data.caseId !== expectedCaseId) {
    findings.push(`${relative} caseId must equal file stem: expected ${expectedCaseId}`);
  }

  if ("status" in data && data.status !== "abstract-case") {
    findings.push(`${relative} status must be abstract-case when present`);
  }

  for (const requiredKey of ["status", "category", "tags", "focus", "deliverables", "checkpoints", "caveats"]) {
    if (!(requiredKey in data)) {
      findings.push(`${relative} missing required case field: ${requiredKey}`);
    }
  }

  if ("status" in data && data.status !== "abstract-case") {
    findings.push(`${relative} status must be abstract-case`);
  }

  if ("category" in data && typeof data.category !== "string") {
    findings.push(`${relative} category must be a string`);
  }

  if ("tags" in data) {
    if (!Array.isArray(data.tags)) {
      findings.push(`${relative} tags must be an array`);
    } else if (!data.tags.every((item) => typeof item === "string" && item.trim().length > 0)) {
      findings.push(`${relative} tags must contain non-empty strings only`);
    }
  }

  const arrayKeys = ["tags", "focus", "deliverables", "checkpoints", "stages", "notes", "caveats"];
  for (const key of arrayKeys) {
    if (key in data && !Array.isArray(data[key])) {
      findings.push(`${relative} field ${key} must be an array`);
    }
  }

  if ("deliverables" in data) {
    for (const deliverable of data.deliverables) {
      if (typeof deliverable !== "string") {
        findings.push(`${relative} deliverables must contain strings only`);
      }
    }
  }
}

failWith(findings, "lint-cases");
