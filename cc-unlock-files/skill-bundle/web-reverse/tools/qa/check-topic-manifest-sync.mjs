import fs from "node:fs";
import { failWith } from "./common.mjs";
import {
  generatedCapabilityMatrixPath,
  generatedTopicRouteMatrixPath,
  listTopicKeys,
  readTopicManifest,
  renderCapabilityMatrix,
  renderTopicRouteMatrix,
  topicManifestRoot
} from "../topic-manifests.mjs";

const findings = [];

function collectStaleTopics(targetFilePath) {
  if (!fs.existsSync(targetFilePath)) {
    return listTopicKeys();
  }

  const generatedMtime = fs.statSync(targetFilePath).mtimeMs;
  return listTopicKeys().filter((key) => {
    const topicPath = `${topicManifestRoot}/${key}/topic.json`;
    return fs.statSync(topicPath).mtimeMs > generatedMtime;
  });
}

for (const key of listTopicKeys()) {
  const topic = readTopicManifest(key);

  if (topic.key !== key) {
    findings.push(`topics/${key}/topic.json key must match directory name`);
  }

  if (!String(topic.owner || "").trim()) {
    findings.push(`topics/${key}/topic.json missing owner`);
  }

  if (!String(topic.riskLevel || "").trim()) {
    findings.push(`topics/${key}/topic.json missing riskLevel`);
  }

  if (!Array.isArray(topic.requiredChecks) || topic.requiredChecks.length === 0) {
    findings.push(`topics/${key}/topic.json missing requiredChecks`);
  }

  if (!String(topic.taskPackDir || "").trim()) {
    findings.push(`topics/${key}/topic.json missing taskPackDir`);
  }

  if (!topic.taskInit || typeof topic.taskInit !== "object") {
    findings.push(`topics/${key}/topic.json missing taskInit`);
  } else {
    if (!String(topic.taskInit.baseProtectionTier || "").trim()) {
      findings.push(`topics/${key}/topic.json missing taskInit.baseProtectionTier`);
    }
    if (!Array.isArray(topic.taskInit.aliases)) {
      findings.push(`topics/${key}/topic.json taskInit.aliases must be an array`);
    }
    if (
      topic.taskInit.combinationProtectionTiers !== undefined &&
      !Array.isArray(topic.taskInit.combinationProtectionTiers)
    ) {
      findings.push(`topics/${key}/topic.json taskInit.combinationProtectionTiers must be an array`);
    }
  }

}

const actualMatrix = fs.readFileSync(generatedTopicRouteMatrixPath, "utf8");
const actualMatrixJson = JSON.parse(actualMatrix);
const expectedMatrix = renderTopicRouteMatrix(undefined, actualMatrixJson.generatedAt);
if (actualMatrix !== expectedMatrix) {
  const staleTopics = collectStaleTopics(generatedTopicRouteMatrixPath);
  findings.push(
    `generated registry is out of date: ${generatedTopicRouteMatrixPath.replaceAll("\\", "/")} does not match ${topicManifestRoot.replaceAll("\\", "/")}`
  );
  if (staleTopics.length > 0) {
    findings.push(`stale topic manifests newer than generated registry: ${staleTopics.join(", ")}`);
  }
  findings.push("remediation: run `npm run sync:topics` (or `npm run build:topics`) and commit the regenerated files");
}

const expectedCapabilityMatrix = renderCapabilityMatrix();
const actualCapabilityMatrix = fs.readFileSync(generatedCapabilityMatrixPath, "utf8");
if (actualCapabilityMatrix !== expectedCapabilityMatrix) {
  const staleTopics = collectStaleTopics(generatedCapabilityMatrixPath);
  findings.push(
    `generated capability matrix is out of date: ${generatedCapabilityMatrixPath.replaceAll("\\", "/")} does not match topic manifests`
  );
  if (staleTopics.length > 0) {
    findings.push(`stale topic manifests newer than capability matrix: ${staleTopics.join(", ")}`);
  }
  findings.push("remediation: run `npm run sync:topics` (or `npm run build:topics`) and commit the regenerated files");
}

failWith(findings, "check-topic-manifest-sync");
