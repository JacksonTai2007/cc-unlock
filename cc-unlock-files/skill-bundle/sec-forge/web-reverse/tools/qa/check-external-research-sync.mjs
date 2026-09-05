import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, repoRoot } from "./common.mjs";

const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-ext-research-"));
const taskInitScript = path.join(repoRoot, "tools", "task", "task-init.mjs");
const taskSyncScript = path.join(repoRoot, "tools", "task", "task-sync.mjs");

function runNode(args, cwd) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8"
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

try {
  const workspace = path.join(tempRoot, "workspace");
  fs.mkdirSync(workspace, { recursive: true });

  const init = runNode([taskInitScript, "qa-ext-research"], workspace);
  if (init.status !== 0) {
    findings.push(`task-init fixture failed: ${(init.stderr || init.stdout || "").trim()}`);
  } else {
    const taskDir = path.join(workspace, "artifacts", "tasks", "qa-ext-research");
    const taskJsonPath = path.join(taskDir, "task.json");
    const task = readJson(taskJsonPath);
    task.externalRefs = {
      ...task.externalRefs,
      searchStatus: "searched",
      searchProvider: "web-search",
      searchMode: "manual",
      searchRounds: 2,
      triggerSignals: ["latest", "quote-needed"],
      sourceTypesUsed: ["official-docs", "github"],
      confidence: 76,
      lastQueries: ["akamai bm_sz sensor_data", "mstoken carrier signer"],
      queryStats: [{ query: "mstoken carrier signer", hits: 3 }],
      featureBundle: {
        hosts: ["www.example.com"],
        urlPathHints: ["/api/search/user/full"],
        keywords: ["msToken", "carrier"],
        functionNames: ["frontierSign"],
        routeTracks: ["signature", "session"],
        topicHints: ["signature", "session"]
      },
      matchedRefs: [{ title: "Signature writeup", url: "https://example.test/writeup", adopted: true }],
      resultDigest: ["确认当前需要外部检索来纠偏 signer carrier 认知。"],
      adoptedFindings: ["优先补 carrier/source-map 交叉验证。"],
      rejectedFindings: ["拒绝只看公开 header 名称就下结论。"],
      openQuestions: ["真实 signer 是否位于 fetch wrapper 内层？"],
      entrypointDrafts: [{ id: "EP-009", title: "沿 fetch wrapper 追 signer", rationale: "对齐外部资料与当前 task-local" }],
      probeDrafts: [{ id: "PR-001", title: "hook request-use", probe: "抓取最终 URL 重写与 header 写入" }],
      reconciliation: {
        generatedAt: "2026-04-25T00:00:00.000Z",
        summary: { merge: 1, review: 1, reject: 1 },
        suggestions: [{ type: "merge", title: "合并 source-map 线索" }]
      },
      lastAppliedAt: "2026-04-25T00:10:00.000Z",
      lastDecisionSummary: "已将外部检索结果并入 signature/session 双主线。",
      notes: ["搜索结果只作为纠偏，不替代本地证据。"],
      policy: {
        policyPath: "docs/reference/search-decision-policy.md",
        policyVersion: "2026-04-25",
        lastEvaluatedAt: "2026-04-25T00:05:00.000Z",
        mode: "manual",
        decision: "search",
        reasons: ["latest", "needs-verification"],
        searchabilityScore: 91,
        metrics: { urlCount: 2 }
      }
    };
    fs.writeFileSync(taskJsonPath, JSON.stringify(task, null, 2) + "\n");

    const sync = runNode([taskSyncScript, taskDir], repoRoot);
    if (sync.status !== 0) {
      findings.push(`task-sync fixture failed: ${(sync.stderr || sync.stdout || "").trim()}`);
    } else {
      const md = fs.readFileSync(path.join(taskDir, "state", "external-research.md"), "utf8");
      const json = readJson(path.join(taskDir, "state", "external-research.json"));
      for (const needle of [
        "# 外部检索",
        "- 状态: searched",
        "- 搜索轮次: 2",
        "## 命中参考",
        "EP-009",
        "PR-001",
        "优先补 carrier/source-map 交叉验证。"
      ]) {
        if (!md.includes(needle)) {
          findings.push(`external-research.md missing rendered content: ${needle}`);
        }
      }
      if (json.status !== "searched") {
        findings.push(`external-research.json did not persist status=searched; got ${json.status}`);
      }
      if (json.searchRounds !== 2) {
        findings.push(`external-research.json did not persist searchRounds=2; got ${json.searchRounds}`);
      }
      if (!Array.isArray(json.triggerSignals) || !json.triggerSignals.includes("latest")) {
        findings.push("external-research.json missing triggerSignals payload");
      }
      if (json.lastDecisionSummary !== "已将外部检索结果并入 signature/session 双主线。") {
        findings.push("external-research.json missing lastDecisionSummary");
      }
    }
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-external-research-sync");
