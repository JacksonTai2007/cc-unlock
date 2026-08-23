import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, repoRoot } from "./common.mjs";

const findings = [];
const taskInitScript = path.join(repoRoot, "tools", "task", "task-init.mjs");
const taskSyncScript = path.join(repoRoot, "tools", "task", "task-sync.mjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-contract-validation-"));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text);
}

function runNode(args, workspaceRoot, cwd = repoRoot) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    timeout: 120000,
    env: {
      ...process.env,
      WEB_REVERSE_WORKSPACE_ROOT: workspaceRoot,
      WEB_REVERSE_SKILL_ROOT: repoRoot
    }
  });
}

function assertRunOk(result, label) {
  if (result.status !== 0) {
    findings.push(`${label} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
}

function initWorkspaceTask(workspaceRoot, taskId) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const init = runNode([taskInitScript, taskId], workspaceRoot);
  assertRunOk(init, `task-init ${taskId}`);
  return path.join(workspaceRoot, "artifacts", "tasks", taskId);
}

function syncTask(workspaceRoot, taskDir, taskId) {
  const sync = runNode([taskSyncScript, taskDir], workspaceRoot);
  assertRunOk(sync, `task-sync ${taskId}`);
}

function verifyTask(taskDir) {
  return spawnSync(process.execPath, [path.join(taskDir, "run", "verify-once.mjs"), "--validate-only"], {
    cwd: taskDir,
    encoding: "utf8",
    timeout: 120000
  });
}

function prepareTaskFixture(workspaceRoot, taskId, options = {}) {
  const taskDir = initWorkspaceTask(workspaceRoot, taskId);
  const taskPath = path.join(taskDir, "task.json");
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const task = readJson(taskPath);
  const routeState = readJson(routeStatePath);

  const claimLevel = options.claimLevel ?? "delivered";
  const acceptancePath = options.acceptancePath ?? "run/local-repro-example.js 验证成功";
  const acceptanceGap = options.acceptanceGap ?? "";
  const nextEvidenceGate = options.nextEvidenceGate ?? "";
  const completionBlockedBy = options.completionBlockedBy ?? [];
  const disallowedFallbacks = options.disallowedFallbacks ?? [];
  const intermediateStatesNotDelivery = options.intermediateStatesNotDelivery ?? ["容器可读", "浏览器 PoC"];
  const taskMode = options.taskMode ?? "请求验收";
  const primaryTopic = options.primaryTopic ?? "signature";
  const secondaryTopics = options.secondaryTopics ?? [];
  const microRoute = options.microRoute ?? "request-use";

  task.phase = claimLevel === "delivered" ? "Close" : "Capture";
  task.taskContract.objective = "合同校验对抗测试";
  task.taskContract.deliverableTier = "generic-acceptance";
  task.taskContract.completionCriteria = ["合同校验闭环成立"];
  task.taskContract.disallowedFallbacks = disallowedFallbacks;
  task.taskContract.intermediateStatesNotDelivery = intermediateStatesNotDelivery;
  task.acceptanceModel.claimLevel = claimLevel;
  task.acceptanceModel.acceptanceGap = acceptanceGap;
  task.acceptanceModel.nextEvidenceGate = nextEvidenceGate;
  task.acceptanceModel.acceptancePath = acceptancePath;
  task.acceptanceModel.completionBlockedBy = completionBlockedBy;
  task.executionModel.taskMode = taskMode;
  task.executionModel.fallbackMode = "";
  task.executionModel.primaryTopic = primaryTopic;
  task.executionModel.secondaryTopics = secondaryTopics;
  task.executionModel.currentState = task.phase;
  task.executionModel.primaryEntrypoint = claimLevel === "delivered" ? "" : "EP-001";
  task.executionModel.microRoute = microRoute;
  task.executionModel.experimentClass = "contract-validation";
  task.executionModel.roundBudget = 2;
  task.executionModel.roundsConsumed = 1;
  task.executionModel.controlSources = {
    ...(task.executionModel.controlSources || {}),
    currentState: "explicit",
    primaryEntrypoint: "explicit",
    taskMode: "explicit",
    fallbackMode: "unset",
    primaryTopic: "explicit",
    secondaryTopics: "explicit",
    microRoute: "explicit",
    experimentClass: "explicit",
    roundBudget: "explicit",
    roundsConsumed: "explicit",
    "deepDivePermit.active": "explicit",
    "deepDivePermit.maxRounds": "explicit"
  };
  task.executionModel.deepDivePermit = {
    active: false,
    subgoal: "",
    milestone: "",
    maxRounds: 0,
    exitCondition: "",
    expectedHighValueEvidence: "",
    currentMicroRoute: "",
    permitReason: "",
    reviewedAt: ""
  };
  task.protocol ||= {};
  task.protocol.present = false;
  task.signatureAnalysis ||= {};
  task.signatureAnalysis.present = false;
  task.taskPacks.selectedTopics = [];
  task.taskPacks.activatedTopics = [];

  if (claimLevel === "delivered") {
    task.routeState.executionStatus = "completed";
    task.routeState.nextEntrypointId = "";
    task.routeState.nextExecutableAction = "";
    task.routeState.pauseCategory = "none";
    task.routeState.pauseReason = "";
    task.routeState.activeEntrypoints = [];
    task.routeState.activeTracks = [];
    routeState.phase = "Close";
    routeState.execution.status = "completed";
    routeState.execution.pauseCategory = "none";
    routeState.execution.pauseReason = "";
    routeState.execution.nextExecutableAction = "";
    routeState.execution.nextEntrypointId = "";
    routeState.activeTracks = [];
    routeState.activeEntrypoints = [];
    routeState.tracks = (routeState.tracks || []).map((track) => ({
      ...track,
      status: "DONE",
      nextStep: ""
    }));
  } else {
    task.routeState.executionStatus = "blocked-on-user";
    task.routeState.nextEntrypointId = "EP-001";
    task.routeState.nextExecutableAction = "等待登录";
    task.routeState.pauseCategory = "user";
    task.routeState.pauseReason = "需要登录";
    task.routeState.activeEntrypoints = ["EP-001"];
    task.routeState.activeTracks = ["A"];
    routeState.phase = "Capture";
    routeState.execution.status = "blocked-on-user";
    routeState.execution.pauseCategory = "user";
    routeState.execution.pauseReason = "需要登录";
    routeState.execution.nextExecutableAction = "等待登录";
    routeState.execution.nextEntrypointId = "EP-001";
    routeState.tracks = (routeState.tracks || []).map((track, index) => ({
      ...track,
      status: index === 0 ? "BLOCKED" : "PENDING",
      nextStep: index === 0 ? "等待登录" : ""
    }));
  }

  writeJson(taskPath, task);
  writeJson(routeStatePath, routeState);
  syncTask(workspaceRoot, taskDir, taskId);
  const syncedTask = readJson(taskPath);
  const syncedRouteState = readJson(routeStatePath);

  writeText(
    path.join(taskDir, "report.md"),
    [
      "# 逆向报告",
      "",
      "## 任务摘要",
      `- workspaceRoot: ${workspaceRoot}`,
      `- taskLocalRoot: ${taskDir}`,
      `- artifactTruthRoot: ${taskDir}`,
      "- workspaceKind: external-workspace",
      `- taskMode: ${taskMode}`,
      "- fallbackMode: (none)",
      "- deliverableTier: generic-acceptance",
      `- primaryTopic: ${primaryTopic}`,
      `- secondaryTopics: ${secondaryTopics.join(", ") || "(none)"}`,
      `- claimLevel: ${claimLevel}`,
      `- evidenceStatus: ${claimLevel === "delivered" ? "已验证交付" : "等待下一证据门"}`,
      `- whyNotDeliveredYet: ${claimLevel === "delivered" ? "n/a" : (completionBlockedBy.join(" | ") || acceptanceGap || "仍缺最终验收闭环")}`,
      `- acceptanceGap: ${acceptanceGap}`,
      `- nextEvidenceGate: ${nextEvidenceGate}`,
      "",
      "## 当前阶段",
      `- 当前阶段：\`${syncedTask.phase}\``,
      "",
      "## 自动续跑决策",
      `- 执行状态：\`${syncedRouteState.execution.status}\``,
      `- 暂停类别: ${syncedRouteState.execution.pauseCategory}`,
      `- 暂停原因: ${syncedRouteState.execution.pauseReason}`,
      `- 下一可执行动作：\`${syncedRouteState.execution.nextExecutableAction}\``,
      "",
      "## 任务契约",
      "- 目标: 合同校验对抗测试",
      "- 当前交付层级: generic-acceptance",
      "- 完成判据: 合同校验闭环成立",
      `- 禁止冒充完成的替代态: ${intermediateStatesNotDelivery.join(" | ")}`,
      "",
      "## 执行状态机",
      `- 当前执行状态: ${syncedTask.phase}`,
      `- 主切入点: ${syncedTask.executionModel.primaryEntrypoint || syncedRouteState.execution.nextEntrypointId || ""}`,
      `- 主模式: ${taskMode}`,
      `- 主专题: ${primaryTopic}`,
      `- 辅助专题: ${secondaryTopics.join(", ") || "(none)"}`,
      `- 当前微路线: ${microRoute}`,
      "- 当前实验类别: contract-validation",
      "- 当前轮次预算: 2",
      "- 当前已消耗轮次: 1",
      "- 当前停损条件: 同类路线连续两轮无新增高价值证据时必须 retrospective / pivot。",
      "- deepDivePermit.active: false",
      "- deepDivePermit.maxRounds: 0",
      "- deepDivePermit.currentMicroRoute: (none)",
      "- deepDivePermit.subgoal: (none)",
      "- deepDivePermit.milestone: (none)",
      "- deepDivePermit.exitCondition: (none)",
      "- deepDivePermit.expectedHighValueEvidence: (none)",
      "",
      "## 验收闭环",
      `- claimLevel: ${claimLevel}`,
      `- acceptanceGap: ${acceptanceGap}`,
      `- nextEvidenceGate: ${nextEvidenceGate}`,
      `- acceptancePath: ${acceptancePath}`,
      "- validators: generic-contract",
      `- completionBlockedBy: ${completionBlockedBy.join(" | ") || "(none)"}`,
      "",
      "## 切入点循环",
      `- activeEntrypoints: ${syncedRouteState.activeEntrypoints.join(", ") || "(none)"}`,
      `- entrypointStatuses: ${(syncedRouteState.entrypoints || []).map((entrypoint) => `${entrypoint.id}:${entrypoint.status || "UNKNOWN"}`).join(" | ") || "(none)"}`,
      `- execution.nextEntrypointId: ${syncedRouteState.execution.nextEntrypointId || "(none)"}`,
      `- execution.nextExecutableAction: ${syncedRouteState.execution.nextExecutableAction || "(none)"}`,
      `- 候选切入点: ${(syncedRouteState.entrypoints || []).map((entrypoint) => entrypoint.id).join(", ") || "(none)"}`,
      `- 本轮实际验证的切入点: ${syncedRouteState.execution.nextEntrypointId || syncedRouteState.activeEntrypoints[0] || "(none)"}`,
      "- 为什么先试它: QA fixture",
      "- 成功或失败的判据: QA fixture",
      "- 切换理由 / 复盘: ",
      "",
      "## 事实",
      "- 当前报告用于合同校验对抗测试，重点验证任务摘要、执行状态机、切入点循环与验收闭环这些关键约束是否被真正机器校验，而不是只靠表面措辞过关。",
      "- 本夹具会故意构造 delivered、provisional、禁用路径与中间态冒充完成等多种场景，用来确认约束不是写在说明里，而是真的被验证器逐条落地执行。",
      "",
      "## 下一步",
      `- ${syncedRouteState.execution.nextExecutableAction || "无"}`,
      ""
    ].join("\n")
  );

  return taskDir;
}

function assertVerifyPass(workspaceName, taskId, options = {}) {
  const workspaceRoot = path.join(tempRoot, workspaceName);
  const taskDir = prepareTaskFixture(workspaceRoot, taskId, options);
  const result = verifyTask(taskDir);
  if (result.status !== 0) {
    findings.push(
      `${taskId} should pass verify-once --validate-only, got: ${(result.stderr || result.stdout || "").trim()}`
    );
  }
}

function assertVerifyFail(workspaceName, taskId, options, expectedNeedles) {
  const workspaceRoot = path.join(tempRoot, workspaceName);
  const taskDir = prepareTaskFixture(workspaceRoot, taskId, options);
  const result = verifyTask(taskDir);
  if (result.status === 0) {
    findings.push(`${taskId} should fail verify-once --validate-only`);
    return;
  }

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  for (const needle of expectedNeedles) {
    if (!output.includes(needle)) {
      findings.push(`${taskId} missing expected validation finding: ${needle}`);
    }
  }
}

try {
  assertVerifyPass("valid", "qa-contract-valid");
  assertVerifyFail(
    "disallowed",
    "qa-contract-disallowed",
    {
      disallowedFallbacks: ["saved successful json"],
      acceptancePath: "saved successful json 作为交付依据"
    },
    [
      "acceptanceModel.acceptancePath reuses a forbidden delivery route: saved successful json",
      "report.md still references a forbidden delivery route: saved successful json"
    ]
  );
  assertVerifyFail(
    "intermediate",
    "qa-contract-intermediate",
    {
      acceptancePath: "浏览器 PoC 已看到响应，因此视为交付"
    },
    [
      "claimLevel=delivered cannot use an intermediate-state placeholder as acceptancePath: 浏览器 PoC"
    ]
  );
  assertVerifyFail(
    "placeholder",
    "qa-contract-placeholder",
    {
      acceptancePath: "(none)"
    },
    [
      "claimLevel=delivered requires acceptanceModel.acceptancePath"
    ]
  );
  assertVerifyFail(
    "provisional",
    "qa-contract-provisional",
    {
      claimLevel: "provisional",
      acceptancePath: "",
      acceptanceGap: "",
      nextEvidenceGate: "",
      completionBlockedBy: ["需要登录"]
    },
    [
      "non-delivered claims require acceptanceModel.acceptanceGap",
      "non-delivered claims require acceptanceModel.nextEvidenceGate"
    ]
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-contract-validation");
