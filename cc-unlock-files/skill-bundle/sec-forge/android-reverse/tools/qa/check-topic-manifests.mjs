import fs from "node:fs";
import path from "node:path";
import { exists, failWith, readJson, repoRoot } from "./common.mjs";
import { readTopicRegistry } from "../topic-registry.mjs";

const templateTaskDir = path.join(repoRoot, "artifacts", "tasks", "_TEMPLATE");
const compatibilityDir = path.join(templateTaskDir, "extensions");
const topicPacksDir = path.join(templateTaskDir, "topic-packs");

const findings = [];
for (const topic of readTopicRegistry()) {
  if (!exists(topic.protocol)) {
    findings.push(`${topic.key} protocol is missing: ${topic.protocol}`);
  }
  if (topic.taskModelFile && !exists(topic.taskModelFile)) {
    findings.push(`${topic.key} taskModelFile is missing: ${topic.taskModelFile}`);
  }
  if (!topic.taskModelFile) {
    continue;
  }
  for (const file of topic.caseFiles || []) {
    if (!exists(file)) {
      findings.push(`${topic.key} case file is missing: ${file}`);
    }
  }
  for (const file of topic.templateArtifacts || []) {
    if (!exists(file)) {
      findings.push(`${topic.key} template artifact is missing: ${file}`);
    }
  }
  const extension = readJson(topic.taskModelFile);
  const rootKey = Object.keys(extension)[0];
  if (!rootKey || extension[rootKey]?.present !== true) {
    findings.push(`${topic.key} extension must default present=true`);
  }

  const topicPackExtension = path.join(topicPacksDir, topic.key, "extension.json");
  const compatibilityExtension = path.join(compatibilityDir, `${topic.key}.json`);
  if (fs.existsSync(topicPackExtension) && fs.existsSync(compatibilityExtension)) {
    const packContent = fs.readFileSync(topicPackExtension, "utf8").trim();
    const compatContent = fs.readFileSync(compatibilityExtension, "utf8").trim();
    if (packContent !== compatContent) {
      findings.push(
        `${topic.key} extension.json is out of sync between topic-pack and compatibility directory; ` +
        `run node tools/task/sync-template-layout.mjs to regenerate`
      );
    }
  }
}

failWith(findings, "check-topic-manifests");

