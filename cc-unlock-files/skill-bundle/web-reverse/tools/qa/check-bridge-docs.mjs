import fs from "node:fs";
import path from "node:path";
import { failWith, readText } from "./common.mjs";

const findings = [];
const referencesDir = path.join(process.cwd(), "references");
const bridgeIndexPath = "docs/reference/bridge-index.md";

function collectActualBridges() {
  const bridges = [];

  for (const entry of fs.readdirSync(referencesDir, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name) !== ".md") {
      continue;
    }
    const relativePath = `references/${entry.name}`;
    const content = fs.readFileSync(path.join(referencesDir, entry.name), "utf8");
    // bridge stub 以 H1 标题含 Bridge/桥接 为准（取首个以 # 开头的标题行判定），
    // 不再用全文裸关键词 /(compatib|兼容)/，避免误伤正文里的技术术语
    // （如 closure-extraction 的 "default 兼容"）与索引描述文字（README 的 "兼容 stub"）。
    const headingLine = content.split(/\r?\n/).find((line) => /^#/.test(line.trim())) ?? "";
    if (!/(bridge|桥接)/i.test(headingLine)) {
      continue;
    }
    const targets = Array.from(content.matchAll(/docs\/reference\/[a-z0-9-]+\.md/g))
      .map((match) => match[0])
      .filter((target) => target !== "docs/reference/bridge-index.md");
    const uniqueTargets = Array.from(new Set(targets));

    if (uniqueTargets.length === 0) {
      continue;
    }
    if (uniqueTargets.length !== 1) {
      findings.push(`${relativePath} must point to exactly one canonical target`);
      continue;
    }

    bridges.push({
      bridgePath: relativePath,
      canonicalTarget: uniqueTargets[0]
    });
  }

  return bridges.sort((left, right) => left.bridgePath.localeCompare(right.bridgePath));
}

function collectIndexedBridges() {
  const content = readText(bridgeIndexPath);
  return Array.from(
    content.matchAll(/\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/g),
    (match) => ({
      bridgePath: match[1],
      canonicalTarget: match[2]
    })
  )
    .filter((item) => item.bridgePath !== "Bridge Path")
    .sort((left, right) => left.bridgePath.localeCompare(right.bridgePath));
}

const actual = collectActualBridges();
const indexed = collectIndexedBridges();

if (JSON.stringify(actual) !== JSON.stringify(indexed)) {
  findings.push(`${bridgeIndexPath} is out of date with actual bridge docs under references/`);
}

failWith(findings, "check-bridge-docs");
