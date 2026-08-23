import fs from "node:fs";
import path from "node:path";
import { failWith, exists, readJson, readText } from "./common.mjs";
import { readTopicRegistry } from "../topic-registry.mjs";
import {
  getTopicExtensionSourcePath,
  getTopicPackDir,
  getTopicPackFiles,
  templateTaskDir
} from "../task/common.mjs";

const findings = [];

const requiredFiles = [
  "artifacts/tasks/_TEMPLATE/task.json",
  "artifacts/tasks/_TEMPLATE/core-task.json",
  "artifacts/tasks/_TEMPLATE/extensions/env.json",
  "artifacts/tasks/_TEMPLATE/extensions/vm.json",
  "artifacts/tasks/_TEMPLATE/extensions/anti-debug.json",
  "artifacts/tasks/_TEMPLATE/extensions/wasm.json",
  "artifacts/tasks/_TEMPLATE/extensions/protocol.json",
  "artifacts/tasks/_TEMPLATE/extensions/dynamic-code.json",
  "artifacts/tasks/_TEMPLATE/extensions/source-map.json",
  "artifacts/tasks/_TEMPLATE/extensions/session.json",
  "artifacts/tasks/_TEMPLATE/extensions/worker.json",
  "artifacts/tasks/_TEMPLATE/extensions/frame.json",
  "artifacts/tasks/_TEMPLATE/extensions/storage.json",
  "artifacts/tasks/_TEMPLATE/extensions/fingerprint.json",
  "artifacts/tasks/_TEMPLATE/extensions/bundle-loader.json",
  "artifacts/tasks/_TEMPLATE/extensions/subtlecrypto.json",
  "artifacts/tasks/_TEMPLATE/extensions/binary-codec.json",
  "artifacts/tasks/_TEMPLATE/extensions/compression-stream.json",
  "artifacts/tasks/_TEMPLATE/extensions/module-federation.json",
  "artifacts/tasks/_TEMPLATE/extensions/streaming-runtime.json",
  "artifacts/tasks/_TEMPLATE/extensions/challenge-orchestration.json",
  "artifacts/tasks/_TEMPLATE/extensions/behavior-telemetry.json",
  "artifacts/tasks/_TEMPLATE/extensions/anti-tamper.json",
  "artifacts/tasks/_TEMPLATE/extensions/framework-runtime.json",
  "artifacts/tasks/_TEMPLATE/state/route-state.json",
  "artifacts/tasks/_TEMPLATE/state/route-plan.md",
  "artifacts/tasks/_TEMPLATE/state/clues.md",
  "artifacts/tasks/_TEMPLATE/state/progress.md",
  "artifacts/tasks/_TEMPLATE/state/candidate-insights.json",
  "artifacts/tasks/_TEMPLATE/report.md",
  "artifacts/tasks/_TEMPLATE/run/verify-once.mjs",
  "artifacts/tasks/_TEMPLATE/run/closeout.mjs",
  "artifacts/tasks/_TEMPLATE/run/fixtures.json",
  "artifacts/tasks/_TEMPLATE/core/core-task.json",
  "artifacts/tasks/_TEMPLATE/core/task.json",
  "artifacts/tasks/_TEMPLATE/core/report.md",
  "artifacts/tasks/_TEMPLATE/core/state/route-state.json",
  "artifacts/tasks/_TEMPLATE/core/state/route-plan.md",
  "artifacts/tasks/_TEMPLATE/core/state/clues.md",
  "artifacts/tasks/_TEMPLATE/core/state/progress.md",
  "artifacts/tasks/_TEMPLATE/core/state/candidate-insights.json",
  "artifacts/tasks/_TEMPLATE/core/run/verify-once.mjs",
  "artifacts/tasks/_TEMPLATE/core/run/closeout.mjs",
  "artifacts/tasks/_TEMPLATE/core/run/run-local.mjs",
  "artifacts/tasks/_TEMPLATE/core/run/fixtures.json",
  "artifacts/tasks/_TEMPLATE/core/run/validate-fixture.mjs",
  "tools/task/task-advance.mjs"
];

for (const file of requiredFiles) {
  if (!exists(file)) {
    findings.push(`missing required template file: ${file}`);
  }
}

for (const file of [
  "core-task.json",
  "task.json",
  "report.md",
  "state/route-state.json",
  "state/route-plan.md",
  "state/clues.md",
  "state/progress.md",
  "state/candidate-insights.json",
  "run/closeout.mjs",
  "run/fixtures.json",
  "run/run-local.mjs",
  "run/validate-fixture.mjs",
  "run/verify-once.mjs"
]) {
  const splitPath = path.join(templateTaskDir, "core", ...file.split("/"));
  const compatibilityPath = path.join(templateTaskDir, ...file.split("/"));
  if (!fs.existsSync(splitPath) || !fs.existsSync(compatibilityPath)) {
    continue;
  }
  if (fs.readFileSync(splitPath, "utf8") !== fs.readFileSync(compatibilityPath, "utf8")) {
    findings.push(`compatibility template drifted from core source: ${file}`);
  }
}

for (const topic of readTopicRegistry()) {
  const packDir = getTopicPackDir(topic);
  if (!packDir || !fs.existsSync(packDir)) {
    findings.push(`missing topic pack source directory: ${topic.key}`);
    continue;
  }

  const extensionSource = getTopicExtensionSourcePath(topic);
  if (!extensionSource) {
    findings.push(`missing topic pack extension source: ${topic.key}`);
  }

  for (const relPath of getTopicPackFiles(topic)) {
    const sourcePath = path.join(packDir, ...relPath.split("/"));
    const compatibilityPath = path.join(templateTaskDir, ...relPath.split("/"));
    if (!fs.existsSync(sourcePath)) {
      findings.push(`${topic.key} topic pack source is missing ${relPath}`);
      continue;
    }
    if (!fs.existsSync(compatibilityPath)) {
      findings.push(`${topic.key} compatibility template is missing ${relPath}`);
      continue;
    }
    if (fs.readFileSync(sourcePath, "utf8") !== fs.readFileSync(compatibilityPath, "utf8")) {
      findings.push(`${topic.key} compatibility template drifted from topic pack source: ${relPath}`);
    }
  }
}

const coreTask = readJson("artifacts/tasks/_TEMPLATE/core-task.json");
const sampleTask = readJson("artifacts/tasks/_TEMPLATE/task.json");

if (JSON.stringify(coreTask) !== JSON.stringify(sampleTask)) {
  findings.push("task.json should match core-task.json for the default task sample");
}

for (const key of [
  "taskId",
  "phase",
  "protectionTier",
  "runtime",
  "browserSession",
  "routeState",
  "taskPacks",
  "targetContext",
  "validation",
  "firstDivergence",
  "successCriteria",
  "deliveryRequirements",
  "boundaries"
]) {
  if (!(key in coreTask)) {
    findings.push(`core-task.json missing key: ${key}`);
  }
}

for (const optionalKey of [
  "envConformance",
  "vm",
  "antiDebug",
  "wasmAnalysis",
  "protocol",
  "dynamicCode",
  "sessionLifecycle",
  "sourceMap",
  "workers",
  "frames",
  "storageAnalysis",
  "fingerprint",
  "bundleLoader",
  "subtleCrypto",
  "binaryCodec",
  "compressionStream",
  "moduleFederation",
  "streamingRuntime",
  "challengeOrchestration",
  "behaviorTelemetry",
  "antiTamper",
  "frameworkRuntime"
]) {
  if (optionalKey in coreTask) {
    findings.push(`core-task.json should not inline optional specialization block: ${optionalKey}`);
  }
}

const extensionChecks = [
  ["env", "envConformance"],
  ["vm", "vm"],
  ["anti-debug", "antiDebug"],
  ["wasm", "wasmAnalysis"],
  ["protocol", "protocol"],
  ["dynamic-code", "dynamicCode"],
  ["source-map", "sourceMap"],
  ["session", "sessionLifecycle"],
  ["worker", "workers"],
  ["frame", "frames"],
  ["storage", "storageAnalysis"],
  ["fingerprint", "fingerprint"],
  ["bundle-loader", "bundleLoader"],
  ["subtlecrypto", "subtleCrypto"],
  ["binary-codec", "binaryCodec"],
  ["compression-stream", "compressionStream"],
  ["module-federation", "moduleFederation"],
  ["streaming-runtime", "streamingRuntime"],
  ["challenge-orchestration", "challengeOrchestration"],
  ["behavior-telemetry", "behaviorTelemetry"],
  ["anti-tamper", "antiTamper"],
  ["framework-runtime", "frameworkRuntime"]
];

for (const [fileStem, key] of extensionChecks) {
  const data = readJson(`artifacts/tasks/_TEMPLATE/extensions/${fileStem}.json`);
  if (!(key in data)) {
    findings.push(`extensions/${fileStem}.json must define ${key}`);
  }
}

const fixtures = readJson("artifacts/tasks/_TEMPLATE/run/fixtures.json");
for (const key of ["meta", "input", "intermediate", "output"]) {
  if (!(key in fixtures)) {
    findings.push(`run/fixtures.json missing key: ${key}`);
  }
}

const report = readText("artifacts/tasks/_TEMPLATE/report.md");
for (const heading of [
  "## \u5f53\u524d\u9636\u6bb5",
  "## \u81ea\u52a8\u7eed\u8dd1\u51b3\u7b56",
  "## \u672c\u5730\u590d\u73b0\u4ea4\u4ed8",
  "## \u9a8c\u8bc1",
  "## \u4ea7\u7269\u8def\u5f84",
  "## \u4e0b\u4e00\u6b65"
]) {
  if (!report.includes(heading)) {
    findings.push(`report.md missing heading: ${heading}`);
  }
}

failWith(findings, "check-template");
