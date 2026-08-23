import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, repoRoot } from "./common.mjs";
import { ensureTaskRuntimeShape } from "../task/common.mjs";

const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-task-init-"));
const taskInitScript = path.join(repoRoot, "tools", "task", "task-init.mjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
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

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    findings.push(`${label} is missing: ${filePath}`);
  }
}

function verifyStructuredInputNormalization(workspaceRoot) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const inputPath = path.join(workspaceRoot, "reverse-task-input.json");
  writeJson(inputPath, {
    target: {
      kind: "url",
      value: "https://masked.example/api"
    },
    objective: "验证 task-init 会把 API 本地复现要求归一化到本地复现交付闭环",
    targetUrlPatterns: [
      "https://masked.example/api/search/user/full/",
      "/api/search/user/full/"
    ],
    targetKeywords: [
      "msToken",
      "X-Bogus",
      "silent reject"
    ],
    targetFunctionNames: [
      "frontierSign",
      "buildPayload"
    ],
    targetActionDescription: "搜索用户并触发目标 API",
    targetTimeWindow: "登录后 5 分钟",
    targetBundleHints: [
      "webpack runtime"
    ],
    protectionHints: [
      "stateful signer"
    ],
    loginRequirements: [
      "需要已登录 cookie"
    ],
    successCriteria: [
      "定位 signer state",
      "本地请求成功"
    ],
    requirements: {
      apiCallExampleRequired: true,
      timeoutPolicy: "30s timeout",
      retryPolicy: "2 rounds per surface",
      deliverables: [
        "run/pure-signature.js",
        "run/local-repro-example.js",
        "run/web-replay.js"
      ]
    },
    boundaries: {
      activeTriggerAllowed: false,
      breakpointAllowed: true
    }
  });

  const taskId = "qa-task-input-api";
  const result = runNode([taskInitScript, taskId, `--task-input=${inputPath}`], workspaceRoot);
  assertRunOk(result, "task-init structured input fixture");
  if (result.status !== 0) {
    return;
  }

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", taskId);
  const task = readJson(path.join(taskDir, "task.json"));

  if (task.deliveryRequirements?.apiCallExampleRequired !== true) {
    findings.push("structured input fixture did not preserve apiCallExampleRequired=true");
  }
  if ((task.taskPacks?.activatedTopics || []).length !== 0) {
    findings.push("structured input fixture should not pre-activate topics during task-init");
  }
  if ((task.taskPacks?.activatedExtensions || []).length !== 0) {
    findings.push("structured input fixture should not pre-activate extensions during task-init");
  }
  const candidateInsights = readJson(path.join(taskDir, "state", "candidate-insights.json"));
  if (candidateInsights.taskId !== taskId) {
    findings.push("structured input fixture should localize state/candidate-insights.json taskId during task-init");
  }
  const factObservations = readJson(path.join(taskDir, "state", "fact-observations.json"));
  if (factObservations.taskId !== taskId) {
    findings.push("structured input fixture should localize state/fact-observations.json taskId during task-init");
  }
  if (task.deliveryRequirements?.localReproductionRequested !== true) {
    findings.push("structured input fixture did not normalize apiCallExampleRequired=true into localReproductionRequested=true");
  }
  if (task.targetContext?.objective !== "验证 task-init 会把 API 本地复现要求归一化到本地复现交付闭环") {
    findings.push("structured input fixture did not map objective into targetContext.objective");
  }
  if ((task.targetContext?.targetKeywords || []).length !== 3) {
    findings.push("structured input fixture did not map targetKeywords");
  }
  if ((task.targetContext?.targetFunctionNames || []).length !== 2) {
    findings.push("structured input fixture did not map targetFunctionNames");
  }
  if ((task.targetContext?.targetUrlPatterns || []).length !== 2) {
    findings.push("structured input fixture did not map targetUrlPatterns");
  }
  if (task.targetContext?.targetActionDescription !== "搜索用户并触发目标 API") {
    findings.push("structured input fixture did not map targetActionDescription");
  }
  if (task.targetContext?.targetTimeWindow !== "登录后 5 分钟") {
    findings.push("structured input fixture did not map targetTimeWindow");
  }
  if ((task.targetContext?.targetBundleHints || []).length !== 1) {
    findings.push("structured input fixture did not map targetBundleHints");
  }
  if ((task.targetContext?.protectionHints || []).length !== 1) {
    findings.push("structured input fixture did not map protectionHints");
  }
  if ((task.targetContext?.loginRequirements || []).length !== 1) {
    findings.push("structured input fixture did not map loginRequirements");
  }
  if (task.targetContext?.timeoutPolicy !== "30s timeout") {
    findings.push("structured input fixture did not map timeoutPolicy");
  }
  if (task.targetContext?.retryPolicy !== "2 rounds per surface") {
    findings.push("structured input fixture did not map retryPolicy");
  }
  if ((task.successCriteria || []).length !== 2) {
    findings.push("structured input fixture did not map successCriteria");
  }
  if (task.boundaries?.breakpointAllowed !== true) {
    findings.push("structured input fixture did not map breakpointAllowed=true");
  }
  if (!Array.isArray(task.targetContext?.requestedDeliverables) || task.targetContext.requestedDeliverables.length !== 3) {
    findings.push("structured input fixture did not map requestedDeliverables");
  }
  assertExists(path.join(taskDir, "run", "local-repro-example.js"), "structured input local repro example");
  assertExists(path.join(taskDir, "run", "web-replay.js"), "structured input API example");
}

function verifyCliFlagNormalization(workspaceRoot) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const taskId = "qa-cli-api";
  const result = runNode([taskInitScript, taskId, "--api-call-example"], workspaceRoot);
  assertRunOk(result, "task-init CLI flag fixture");
  if (result.status !== 0) {
    return;
  }

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", taskId);
  const task = readJson(path.join(taskDir, "task.json"));

  if (task.deliveryRequirements?.apiCallExampleRequired !== true) {
    findings.push("CLI fixture did not set apiCallExampleRequired=true");
  }
  if (task.deliveryRequirements?.localReproductionRequested !== true) {
    findings.push("CLI fixture did not force localReproductionRequested=true");
  }
  if ((task.taskPacks?.activatedTopics || []).length !== 0) {
    findings.push("CLI fixture should keep activatedTopics empty until task-sync finds real evidence");
  }
  const candidateInsights = readJson(path.join(taskDir, "state", "candidate-insights.json"));
  if (candidateInsights.taskId !== taskId) {
    findings.push("CLI fixture should localize state/candidate-insights.json taskId during task-init");
  }
  const factObservations = readJson(path.join(taskDir, "state", "fact-observations.json"));
  if (factObservations.taskId !== taskId) {
    findings.push("CLI fixture should localize state/fact-observations.json taskId during task-init");
  }
  assertExists(path.join(taskDir, "run", "local-repro-example.js"), "CLI local repro example");
  assertExists(path.join(taskDir, "run", "web-replay.js"), "CLI API example");
}

function verifyExistingHistoryRequiresForceNewTask(workspaceRoot) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const firstTaskId = "qa-history-first";
  const firstResult = runNode([taskInitScript, firstTaskId], workspaceRoot);
  assertRunOk(firstResult, "task-init first task fixture");
  if (firstResult.status !== 0) {
    return;
  }

  const blockedResult = runNode([taskInitScript, "qa-history-second"], workspaceRoot);
  if (blockedResult.status === 0) {
    findings.push("task-init should block creating a second task-local by default when history data files already exist");
  }
  const blockedOutput = `${blockedResult.stdout || ""}\n${blockedResult.stderr || ""}`;
  if (!blockedOutput.includes("--force-new-task")) {
    findings.push("task-init should mention --force-new-task when blocking a second task-local");
  }

  const forcedResult = runNode([taskInitScript, "qa-history-second", "--force-new-task"], workspaceRoot);
  assertRunOk(forcedResult, "task-init force-new-task fixture");
  if (forcedResult.status !== 0) {
    return;
  }

  assertExists(path.join(workspaceRoot, "artifacts", "tasks", "qa-history-second", "task.json"), "task-init forced second task");
}

function verifyUnknownTopicSpecifierFailsFast(workspaceRoot) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const taskId = "qa-unknown-topic";
  const result = runNode([taskInitScript, taskId, "--topic=not-a-topic"], workspaceRoot);
  if (result.status === 0) {
    findings.push("task-init should fail when --topic contains an unknown topic specifier");
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (!output.includes("unknown topic specifier")) {
    findings.push("task-init should report unknown topic specifier details for invalid --topic values");
  }
  if (fs.existsSync(path.join(workspaceRoot, "artifacts", "tasks", taskId))) {
    findings.push("task-init must not create task-local files when unknown topic specifier is provided");
  }
}

function verifyFreshCandidateInsightsDoNotCountAsFirstHitPack(workspaceRoot) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const taskId = "qa-first-hit-pack";
  const result = runNode([taskInitScript, taskId, "--topic=signature"], workspaceRoot);
  assertRunOk(result, "task-init first-hit-pack fixture");
  if (result.status !== 0) {
    return;
  }

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", taskId);
  const task = ensureTaskRuntimeShape(readJson(path.join(taskDir, "task.json")));
  }

function verifyTaskInputFallbackToSkillRoot(workspaceRoot) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const taskId = "qa-skill-root-task-input";
  const result = runNode(
    [taskInitScript, taskId, "--task-input=references/schemas/reverse-task-input.example.json"],
    workspaceRoot
  );
  assertRunOk(result, "task-init external workspace skill-root task-input fixture");
  if (result.status !== 0) {
    return;
  }

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", taskId);
  assertExists(path.join(taskDir, "task.json"), "skill-root fallback task.json");
}

function verifyTaskInputPrefersWorkspaceRoot(workspaceRoot) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const inputPath = path.join(workspaceRoot, "reverse-task-input.json");
  writeJson(inputPath, {
    objective: "workspace-root task input should win",
    requirements: {
      localReproductionRequested: true
    }
  });

  const taskId = "qa-workspace-root-task-input";
  const result = spawnSync(
    process.execPath,
    [taskInitScript, taskId, "--task-input=reverse-task-input.json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        WEB_REVERSE_WORKSPACE_ROOT: workspaceRoot
      }
    }
  );
  assertRunOk(result, "task-init workspace-root relative task-input fixture");
  if (result.status !== 0) {
    return;
  }

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", taskId);
  const task = readJson(path.join(taskDir, "task.json"));
  if (task.targetContext?.objective !== "workspace-root task input should win") {
    findings.push("task-init should resolve relative --task-input against WEB_REVERSE_WORKSPACE_ROOT before the caller cwd");
  }
  if (task.deliveryRequirements?.localReproductionRequested !== true) {
    findings.push("workspace-root relative task-input fixture did not apply deliveryRequirements from the external workspace input");
  }
}

try {
  verifyStructuredInputNormalization(path.join(tempRoot, "structured-input"));
  verifyCliFlagNormalization(path.join(tempRoot, "cli-flags"));
  verifyExistingHistoryRequiresForceNewTask(path.join(tempRoot, "history-gate"));
  verifyUnknownTopicSpecifierFailsFast(path.join(tempRoot, "unknown-topic"));
  verifyFreshCandidateInsightsDoNotCountAsFirstHitPack(path.join(tempRoot, "first-hit-pack"));
  verifyTaskInputFallbackToSkillRoot(path.join(tempRoot, "skill-root-task-input"));
  verifyTaskInputPrefersWorkspaceRoot(path.join(tempRoot, "workspace-root-task-input"));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-task-init-contract");
