import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, repoRoot } from "./common.mjs";

const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-external-workspace-"));
const taskSyncScript = path.join(repoRoot, "tools", "task", "task-sync.mjs");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runNode(args, cwd) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8"
  });
}

function assertRunOk(result, label) {
  if (result.status !== 0) {
    findings.push(`${label} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
}

function main() {
  const workspace = path.join(tempRoot, "workspace");
  const taskDir = path.join(workspace, "artifacts", "tasks", "legacy-tiktok");

  writeText(
    path.join(workspace, "run", "verify-once.mjs"),
    "console.log('verify-once from workspace root');\n"
  );
  writeText(
    path.join(workspace, "run", "example-search-user.mjs"),
    "console.log('example search from workspace root');\n"
  );

  writeJson(path.join(taskDir, "task.json"), {
    taskId: "legacy-tiktok",
    title: "TikTok search/user/full X-Bogus Node pure rebuild",
    target: {
      pageUrl: "https://www.tiktok.com/search/user?q=reverse",
      apiUrl: "https://www.tiktok.com/api/search/user/full/"
    },
    status: "completed",
    currentStage: "Port",
  });

  writeJson(path.join(taskDir, "state", "route-state.json"), {
    taskId: "legacy-tiktok",
    stage: "Port",
    targetContext: {
      protectionLevel: "T5",
      notes: [
        "Search request signer lives in webmssdk fetch interception chain.",
        "Public byted_acrawler.frontierSign is not the same signer used by search/user/full.",
        "Pure Node vm rebuild is viable without jsdom."
      ]
    },
    tracks: [
      { name: "signature", status: "active" },
      { name: "session", status: "active" }
    ],
    entrypoints: [
      {
        name: "webmssdk-fetch-intercept",
        status: "active",
        hypothesis: "search/user/full signing happens inside webmssdk fetch wrapper and can be replayed in Node vm.",
        probe: "load analysis/webmssdk.js in vm and capture rewritten URL",
        successCriteria: "关键参数载体已覆盖 header/query/cookie/runtime，且签名前完成 msToken 与 signer state 同步"
      }
    ],
    execution: {
      status: "completed",
      nextExecutableAction: "None"
    }
  });

  writeText(
    path.join(taskDir, "report.md"),
    [
      "# TikTok",
      "",
      "## Summary",
      "",
      "- X-Bogus / X-Gnarly",
      "- webmssdk fetch interception",
      "- msToken / x-ms-token / ttwid / localStorage / sessionStorage"
    ].join("\n")
  );
  writeText(
    path.join(taskDir, "state", "clues.md"),
    [
      "# Clues",
      "",
      "- `window.byted_acrawler.frontierSign` is not the real signer.",
      "- `window._mssdk.cacheOpts[\"1988\"]` contains init data.",
      "- `msToken` 需要做载体全检查：header / query / cookie / runtime state。"
    ].join("\n")
  );
  writeText(path.join(taskDir, "state", "route-plan.md"), "# Route Plan\n");
  writeText(path.join(taskDir, "state", "progress.md"), "# Progress\n");

  const sync = runNode([taskSyncScript, taskDir], repoRoot);
  assertRunOk(sync, "task-sync external workspace fixture");
  if (sync.status !== 0) {
    return;
  }

  const task = readJson(path.join(taskDir, "task.json"));
  if (path.resolve(task.roots?.workspaceRoot || "") !== path.resolve(workspace)) {
    findings.push("task-sync did not normalize roots.workspaceRoot to the external project workspace");
  }
  if (!Array.isArray(task.taskPacks?.selectedTopics) || !task.taskPacks.selectedTopics.includes("signature")) {
    findings.push("task-sync did not infer signature topic from existing workspace evidence");
  }
  if (!task.taskPacks.selectedTopics.includes("session")) {
    findings.push("task-sync did not infer session topic from existing workspace evidence");
  }
  if (!Array.isArray(task.taskPacks?.activatedTopics) || !task.taskPacks.activatedTopics.includes("signature")) {
    findings.push("task-sync did not activate signature topic from detected workspace evidence");
  }
  if (!task.taskPacks.activatedTopics.includes("session")) {
    findings.push("task-sync did not activate session topic from detected workspace evidence");
  }
  if (task.deliveryRequirements?.apiCallExampleRequired !== true) {
    findings.push("task-sync did not normalize apiCallExampleRequired=true from target.apiUrl");
  }
  if (task.deliveryRequirements?.localReproductionRequested !== true) {
    findings.push("task-sync did not normalize localReproductionRequested=true for API replay tasks");
  }
  if (!fs.existsSync(path.join(taskDir, "run", "fixtures.json"))) {
    findings.push("task-sync did not backfill run/fixtures.json into the task-local");
  }
  if (!fs.existsSync(path.join(taskDir, "run", "verify-once.mjs"))) {
    findings.push("task-sync did not preserve or bridge run/verify-once.mjs into the task-local");
  }
  if (!fs.existsSync(path.join(taskDir, "run", "local-repro-example.js"))) {
    findings.push("task-sync did not bridge local reproduction example into the task-local");
  }
  if (!fs.existsSync(path.join(taskDir, "run", "web-replay.js"))) {
    findings.push("task-sync did not bridge API replay example into the task-local");
  }

  const verifyResult = runNode([path.join(taskDir, "run", "verify-once.mjs")], repoRoot);
  assertRunOk(verifyResult, "task-local verify-once bridge");
  if (!String(verifyResult.stdout || "").includes("verify-once from workspace root")) {
    findings.push("task-local verify-once bridge did not proxy stdout from the workspace root script");
  }

  const exampleResult = runNode([path.join(taskDir, "run", "local-repro-example.js")], repoRoot);
  assertRunOk(exampleResult, "task-local local repro bridge");
  if (!String(exampleResult.stdout || "").includes("example search from workspace root")) {
    findings.push("task-local local reproduction bridge did not proxy stdout from the workspace root script");
  }

}

try {
  main();
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-external-workspace-lifecycle");
