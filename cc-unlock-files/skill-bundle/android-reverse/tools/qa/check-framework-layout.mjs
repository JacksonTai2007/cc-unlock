import { exists, failWith } from "./common.mjs";

const findings = [];
for (const file of [
  "SKILL.md",
  "README.md",
  "PROMPTS.md",
  "package.json",
  "agents/openai.yaml",
  "docs/reference/android-reverse-bootstrap.md",
  "docs/reference/reverse-bootstrap.md",
  "docs/reference/reverse-workflow.md",
  "docs/reference/output-contract.md",
  "references/task-input-template.md",
  "references/mcp-task-template.md",
  "docs/reference/tool-defaults.md",
  "artifacts/tasks/_TEMPLATE/task.json",
  "artifacts/tasks/_TEMPLATE/run/verification.spec.json",
  "tools/task/task-init.mjs",
  "tools/task/task-sync.mjs",
  "tools/task/task-advance.mjs",
  "tools/task/task-verify.mjs",
  "tools/task/task-baseline.mjs",
  "tools/task/task-migrate.mjs",
  "tools/task/task-close.mjs",
  "tools/topic-manifests.mjs",
  "tools/topic-registry.mjs"
]) {
  if (!exists(file)) {
    findings.push(`missing framework file: ${file}`);
  }
}

failWith(findings, "check-framework-layout");
