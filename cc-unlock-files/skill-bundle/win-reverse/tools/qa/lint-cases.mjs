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

  for (const requiredKey of ["status", "category", "tags", "focus", "deliverables", "checkpoints", "caveats"]) {
    if (!(requiredKey in data)) {
      findings.push(`${relative} missing required case field: ${requiredKey}`);
    }
  }
}

failWith(findings, "lint-cases");

