import fs from "node:fs";
import path from "node:path";
import { failWith } from "./common.mjs";
import { readTopicRegistry } from "../topic-registry.mjs";
import { getTopicPackDir, getTopicPackFiles, getTopicExtensionSourcePath, templateTaskDir } from "../task/common.mjs";

const findings = [];
const runDir = path.join(templateTaskDir, "run");
const coreRunFiles = new Set([
  "README.md",
  "closeout.mjs",
  "fixtures.json",
  "local-repro-example.js",
  "pure-template.js",
  "run-local.mjs",
  "signer-state-map.md",
  "validate-fixture.mjs",
  "verify-once.mjs"
]);
const claimedRunFiles = new Map();

for (const topic of readTopicRegistry()) {
  const packDir = getTopicPackDir(topic);
  if (!packDir || !fs.existsSync(packDir)) {
    findings.push(`${topic.key} task pack directory is missing`);
    continue;
  }

  const extensionSource = getTopicExtensionSourcePath(topic);
  if (!extensionSource || !fs.existsSync(extensionSource)) {
    findings.push(`${topic.key} task pack is missing extension.json`);
  }

  for (const relPath of getTopicPackFiles(topic)) {
    if (!String(relPath).startsWith("run/")) {
      continue;
    }

    const fileName = path.basename(relPath);
    if (!claimedRunFiles.has(fileName)) {
      claimedRunFiles.set(fileName, []);
    }
    claimedRunFiles.get(fileName).push(topic.key);

    const fullPath = path.join(templateTaskDir, ...String(relPath).split("/"));
    if (!fs.existsSync(fullPath)) {
      findings.push(`${topic.key} task pack references missing template file: ${relPath}`);
    }
  }
}

for (const entry of fs.readdirSync(runDir, { withFileTypes: true })) {
  if (!entry.isFile() || coreRunFiles.has(entry.name)) {
    continue;
  }

  if (!claimedRunFiles.has(entry.name)) {
    findings.push(`run/${entry.name} is not claimed by any topic pack`);
  }
}

failWith(findings, "check-task-packs");
