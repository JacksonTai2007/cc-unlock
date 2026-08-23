import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, readText, repoRoot } from "./common.mjs";

const findings = [];
const taskInitScript = path.join(repoRoot, "tools", "task", "task-init.mjs");
const taskSyncScript = path.join(repoRoot, "tools", "task", "task-sync.mjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-behavioral-"));

function requireIncludes(relPath, needles) {
  const text = readText(relPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      findings.push(`${relPath} is missing behavioral-enforcement text: ${needle}`);
    }
  }
}

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

function verifyTask(taskDir) {
  return spawnSync(process.execPath, [path.join(taskDir, "run", "verify-once.mjs"), "--validate-only"], {
    cwd: taskDir,
    encoding: "utf8",
    timeout: 120000
  });
}

function canonicalTaskFixture(taskId) {
  return {
    phase: "Capture",
    taskContract: {
      objective: "behavioral enforcement adversarial fixture",
      deliverableTier: "accepted-request",
      completionCriteria: ["verify-once --validate-only 通过", "route-state 维持 ready-to-continue"]
    },
    acceptanceModel: {
      claimLevel: "provisional",
      acceptanceGap: "尚未完成真实请求验收闭环，只完成了可继续执行的强状态样本。",
      nextEvidenceGate: "执行 EP-001 的下一跳 request-use probe，并产出新的高价值证据。",
      acceptancePath: "run/fixtures.json + state/route-state.json",
      validators: ["generic-contract"],
      completionBlockedBy: []
    },
    taskPacks: {
      selectedTopics: ["signature", "protocol"],
      activatedTopics: ["signature", "protocol"]
    },
    executionModel: {
      currentState: "Capture",
      primaryEntrypoint: "EP-001",
      taskMode: "请求验收",
      fallbackMode: "",
      primaryTopic: "signature",
      secondaryTopics: ["protocol"],
      microRoute: "request-use",
      experimentClass: "behavioral-qa",
      roundBudget: 2,
      roundsConsumed: 1,
      highValueEvidenceGoal: "确认 request-use 主链仍具备可继续执行价值",
      nextUpgradeGate: "拿到新的可执行 request-use 证据",
      stopLossCondition: "同类路线连续两轮无新增高价值证据时必须 retrospective / pivot。",
      controlSources: {
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
      },
      deepDivePermit: {
        active: false,
        subgoal: "",
        milestone: "",
        maxRounds: 0,
        exitCondition: "",
        expectedHighValueEvidence: "",
        currentMicroRoute: "",
        permitReason: "",
        reviewedAt: ""
      }
    },
    routeState: {
      executionStatus: "ready-to-continue",
      nextEntrypointId: "EP-001",
      nextExecutableAction: "执行 EP-001 的 request-use 最小 probe，确认 signer 与协议拼装边界。",
      pauseCategory: "none",
      pauseReason: "",
      activeTracks: ["request-use"],
      activeEntrypoints: ["EP-001"]
    },
    routeStateFile: {
      phase: "Capture",
      syncStatus: "restored-from-route-state",
      activeTracks: ["request-use"],
      activeEntrypoints: ["EP-001"],
      execution: {
        status: "ready-to-continue",
        autoAdvanceEligible: true,
        pauseCategory: "none",
        pauseReason: "",
        nextEntrypointId: "EP-001",
        nextPhase: "Capture",
        nextExecutableAction: "执行 EP-001 的 request-use 最小 probe，确认 signer 与协议拼装边界。",
        summary: "当前禁止只做状态汇报，必须继续执行 EP-001。",
        updatedAt: "2026-04-27T00:00:00.000Z"
      },
      tracks: [
        {
          id: "request-use",
          title: "request-use",
          target: "逼近 signer 与协议拼装边界",
          inputs: "request initiator, signer params",
          output: "next executable action",
          priority: "P0",
          checkpoints: ["probe"],
          status: "IN_PROGRESS",
          nextStep: "执行 EP-001",
          updatedAt: "2026-04-27T00:00:00.000Z"
        }
      ],
      entrypoints: [
        {
          id: "EP-001",
          title: "probe request-use",
          hypothesis: "request-use 仍是当前最高价值主路径",
          boundTopics: ["signature", "protocol"],
          targetTrack: "request-use",
          rationale: "直接服务验收边界。",
          cost: "low",
          expectedGain: "high",
          probe: "最小化确认 signer 输入与请求拼装边界。",
          successCriteria: "拿到新的 request-use 证据。",
          failureCriteria: "两轮内无新增高价值证据。",
          status: "PROBING",
          resultSummary: "当前活跃 probe",
          evidenceRefs: ["report.md"],
          nextOnSuccess: "扩展 signer 边界",
          nextOnFailure: "retrospective",
          updatedAt: "2026-04-27T00:00:00.000Z"
        }
      ],
      retrospectives: [],
      clues: [
        {
          id: "CLUE-001",
          sourceTrack: "request-use",
          sourceEntrypoint: "EP-001",
          discoveredAt: "2026-04-27T00:00:00.000Z",
          content: "request-use synthetic clue",
          verification: "fixture",
          impact: "validation",
          action: "continue",
          confidence: "high"
        }
      ]
    }
  };
}

function renderReport(workspaceRoot, taskDir, task, routeState, overrides = {}) {
  const secondaryTopics = (overrides.secondaryTopics ?? task.executionModel.secondaryTopics).join(", ");
  const entrypointStatuses = (routeState.entrypoints || [])
    .map((entrypoint) => `${entrypoint.id}:${entrypoint.status || "UNKNOWN"}`)
    .join(" | ");
  const values = {
    taskMode: overrides.taskMode ?? task.executionModel.taskMode,
    fallbackMode: overrides.fallbackMode ?? "(none)",
    primaryTopic: overrides.primaryTopic ?? task.executionModel.primaryTopic,
    secondaryTopics: overrides.secondaryTopicsText ?? (secondaryTopics || "(none)"),
    workspaceRoot: overrides.workspaceRoot ?? workspaceRoot,
    taskLocalRoot: overrides.taskLocalRoot ?? taskDir,
    artifactTruthRoot: overrides.artifactTruthRoot ?? taskDir,
    workspaceKind: overrides.workspaceKind ?? "external-workspace",
    currentState: overrides.currentState ?? task.executionModel.currentState,
    primaryEntrypoint: overrides.primaryEntrypoint ?? task.executionModel.primaryEntrypoint,
    primaryModeExecution: overrides.primaryModeExecution ?? (overrides.taskMode ?? task.executionModel.taskMode),
    primaryTopicExecution: overrides.primaryTopicExecution ?? (overrides.primaryTopic ?? task.executionModel.primaryTopic),
    secondaryTopicsExecution: overrides.secondaryTopicsExecution ?? (secondaryTopics || "(none)"),
    experimentClass: overrides.experimentClass ?? task.executionModel.experimentClass,
    roundBudget: overrides.roundBudget ?? task.executionModel.roundBudget,
    roundsConsumed: overrides.roundsConsumed ?? task.executionModel.roundsConsumed,
    deepDiveActive: overrides.deepDiveActive ?? (task.executionModel.deepDivePermit.active ? "true" : "false"),
    deepDiveMaxRounds: overrides.deepDiveMaxRounds ?? task.executionModel.deepDivePermit.maxRounds,
    deepDiveCurrentMicroRoute: overrides.deepDiveCurrentMicroRoute ?? "(none)",
    deepDiveSubgoal: overrides.deepDiveSubgoal ?? "(none)",
    deepDiveMilestone: overrides.deepDiveMilestone ?? "(none)",
    deepDiveExitCondition: overrides.deepDiveExitCondition ?? "(none)",
    deepDiveExpectedEvidence: overrides.deepDiveExpectedEvidence ?? "(none)",
    activeEntrypoints: overrides.activeEntrypoints ?? ((routeState.activeEntrypoints || []).join(", ") || "(none)"),
    entrypointStatuses: overrides.entrypointStatuses ?? (entrypointStatuses || "(none)"),
    nextEntrypointId: overrides.nextEntrypointId ?? (routeState.execution?.nextEntrypointId || "(none)"),
    nextExecutableAction: overrides.nextExecutableAction ?? (routeState.execution?.nextExecutableAction || "(none)")
  };

  return [
    "# 逆向报告",
    "",
    "## 任务摘要",
    `- workspaceRoot: ${values.workspaceRoot}`,
    `- taskLocalRoot: ${values.taskLocalRoot}`,
    `- artifactTruthRoot: ${values.artifactTruthRoot}`,
    `- workspaceKind: ${values.workspaceKind}`,
    `- taskMode: ${values.taskMode}`,
    `- fallbackMode: ${values.fallbackMode}`,
    `- deliverableTier: ${task.taskContract.deliverableTier}`,
    `- primaryTopic: ${values.primaryTopic}`,
    `- secondaryTopics: ${values.secondaryTopics}`,
    `- claimLevel: ${task.acceptanceModel.claimLevel}`,
    "- evidenceStatus: 等待下一证据门",
    `- whyNotDeliveredYet: ${task.acceptanceModel.acceptanceGap}`,
    `- acceptanceGap: ${task.acceptanceModel.acceptanceGap}`,
    `- nextEvidenceGate: ${task.acceptanceModel.nextEvidenceGate}`,
    "",
    "## 当前阶段",
    `- 当前阶段：\`${task.phase}\``,
    "",
    "## 任务契约",
    `- 目标: ${task.taskContract.objective}`,
    "- 不可退让约束: report.md 中的关键控制字段必须与 task.json / route-state.json 真值源一致",
    `- 当前交付层级: ${task.taskContract.deliverableTier}`,
    `- 完成判据: ${(task.taskContract.completionCriteria || []).join(" | ")}`,
    "- 禁止冒充完成的替代态: 浏览器 PoC | saved successful json",
    "",
    "## 自动续跑决策",
    `- 执行状态：\`${routeState.execution.status}\``,
    `- 暂停类别: ${routeState.execution.pauseCategory}`,
    `- 暂停原因: ${routeState.execution.pauseReason}`,
    `- 下一可执行动作：\`${routeState.execution.nextExecutableAction}\``,
    "",
    "## 执行状态机",
    `- 当前执行状态: ${values.currentState}`,
    `- 主切入点: ${values.primaryEntrypoint}`,
    `- 主模式: ${values.primaryModeExecution}`,
    `- 主专题: ${values.primaryTopicExecution}`,
    `- 辅助专题: ${values.secondaryTopicsExecution}`,
    `- 当前微路线: ${task.executionModel.microRoute}`,
    `- 当前实验类别: ${values.experimentClass}`,
    `- 当前轮次预算: ${values.roundBudget}`,
    `- 当前已消耗轮次: ${values.roundsConsumed}`,
    `- 当前停损条件: ${task.executionModel.stopLossCondition}`,
    `- deepDivePermit.active: ${values.deepDiveActive}`,
    `- deepDivePermit.maxRounds: ${values.deepDiveMaxRounds}`,
    `- deepDivePermit.currentMicroRoute: ${values.deepDiveCurrentMicroRoute}`,
    `- deepDivePermit.subgoal: ${values.deepDiveSubgoal}`,
    `- deepDivePermit.milestone: ${values.deepDiveMilestone}`,
    `- deepDivePermit.exitCondition: ${values.deepDiveExitCondition}`,
    `- deepDivePermit.expectedHighValueEvidence: ${values.deepDiveExpectedEvidence}`,
    "",
    "## 验收闭环",
    `- claimLevel: ${task.acceptanceModel.claimLevel}`,
    `- acceptanceGap: ${task.acceptanceModel.acceptanceGap}`,
    `- nextEvidenceGate: ${task.acceptanceModel.nextEvidenceGate}`,
    `- acceptancePath: ${task.acceptanceModel.acceptancePath}`,
    `- validators: ${(task.acceptanceModel.validators || []).join(", ")}`,
    "- completionBlockedBy: (none)",
    "",
    "## 切入点循环",
    `- activeEntrypoints: ${values.activeEntrypoints}`,
    `- entrypointStatuses: ${values.entrypointStatuses}`,
    `- execution.nextEntrypointId: ${values.nextEntrypointId}`,
    `- execution.nextExecutableAction: ${values.nextExecutableAction}`,
    "- 候选切入点: EP-001",
    "- 本轮实际验证的切入点: EP-001",
    "- 为什么先试它: 直接服务验收边界。",
    "- 成功或失败的判据: 两轮内拿到新的 request-use 高价值证据，否则 retrospective。",
    "- 切换理由 / 复盘: ",
    "",
    "## 事实",
    "- 该夹具专门验证关键控制字段、轮次预算和 deep-dive permit 是否真的进入机器校验，而不是只做文案提示。",
    "",
    "## 下一步",
    `- ${routeState.execution.nextExecutableAction}`,
    ""
  ].join("\n");
}

function initTaskFixture(workspaceRoot, taskId, overrides = {}) {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const init = runNode([taskInitScript, taskId], workspaceRoot);
  assertRunOk(init, `task-init ${taskId}`);
  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", taskId);
  const taskPath = path.join(taskDir, "task.json");
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const task = readJson(taskPath);
  const routeState = readJson(routeStatePath);
  const fixture = canonicalTaskFixture(taskId);

  Object.assign(task.taskContract, fixture.taskContract, overrides.taskContract || {});
  Object.assign(task.acceptanceModel, fixture.acceptanceModel, overrides.acceptanceModel || {});
  Object.assign(task.taskPacks, fixture.taskPacks, overrides.taskPacks || {});
  Object.assign(task.executionModel, fixture.executionModel, overrides.executionModel || {});
  task.executionModel.deepDivePermit = {
    ...fixture.executionModel.deepDivePermit,
    ...(overrides.executionModel?.deepDivePermit || {})
  };
  task.phase = overrides.phase || fixture.phase;
  task.successCriteria = [{ label: "behavioral-qa", status: "hit" }];
  task.protocol ||= {};
  task.protocol.present = false;
  task.signatureAnalysis ||= {};
  task.signatureAnalysis.present = false;
  Object.assign(task.routeState, fixture.routeState, overrides.routeStateMirror || {});
  task.routeState.statePath = "state/route-state.json";
  task.routeState.planPath = "state/route-plan.md";
  task.routeState.progressPath = "state/progress.md";
  task.routeState.cluesPath = "state/clues.md";

  Object.assign(routeState, fixture.routeStateFile, overrides.routeStateFile || {});
  routeState.taskId = task.taskId;
  routeState.phase = task.phase;

  writeJson(taskPath, task);
  writeJson(routeStatePath, routeState);

  const sync = runNode([taskSyncScript, taskDir], workspaceRoot);
  assertRunOk(sync, `task-sync ${taskId}`);

  const syncedTask = readJson(taskPath);
  const syncedRouteState = readJson(routeStatePath);
  writeText(path.join(taskDir, "report.md"), renderReport(workspaceRoot, taskDir, syncedTask, syncedRouteState, overrides.report || {}));
  return taskDir;
}

function assertTaskSyncFail(workspaceName, taskId, taskMutator, expectedNeedles) {
  const workspaceRoot = path.join(tempRoot, workspaceName);
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const init = runNode([taskInitScript, taskId], workspaceRoot);
  assertRunOk(init, `task-init ${taskId}`);
  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", taskId);
  const taskPath = path.join(taskDir, "task.json");
  const task = readJson(taskPath);
  taskMutator(task);
  writeJson(taskPath, task);
  const sync = runNode([taskSyncScript, taskDir], workspaceRoot);
  if (sync.status === 0) {
    findings.push(`${taskId} should fail task-sync because raw task.json is invalid`);
    return;
  }
  const output = `${sync.stdout || ""}\n${sync.stderr || ""}`;
  for (const needle of expectedNeedles) {
    if (!output.includes(needle)) {
      findings.push(`${taskId} missing expected raw-shape finding: ${needle}`);
    }
  }
}

function assertVerifyPass(workspaceName, taskId, overrides = {}) {
  const workspaceRoot = path.join(tempRoot, workspaceName);
  const taskDir = initTaskFixture(workspaceRoot, taskId, overrides);
  const result = verifyTask(taskDir);
  if (result.status !== 0) {
    findings.push(`${taskId} should pass verify-once --validate-only, got: ${(result.stderr || result.stdout || "").trim()}`);
  }
}

function assertVerifyFail(workspaceName, taskId, overrides, expectedNeedles) {
  const workspaceRoot = path.join(tempRoot, workspaceName);
  const taskDir = initTaskFixture(workspaceRoot, taskId, overrides);
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

// [阶段1·去焊接] 已移除对 SKILL.md 正文短语的 requireIncludes 断言：
// 这类「文本存在性」检查校验的是 presence 而非 efficacy（110340.md 证明短语全在但模型无视），
// 且把正文焊死、阻碍精简。SKILL.md 行为效力改由 eval（eval_set.json + skill-creator）验收。
// 此处保留对参考文档/模板/工具的机制性断言。

requireIncludes("docs/reference/reverse-workflow.md", [
  "默认 `1` 个主专题 + `0~2` 个辅助专题",
  "同时只保留 1~2 个活跃 entrypoints",
  "同一家族低层 hook 默认最大 2 轮",
  "maxRounds / expectedHighValueEvidence / permit 是否续期"
]);

requireIncludes("docs/reference/output-contract.md", [
  "taskMode",
  "primaryTopic / secondaryTopics",
  "activeEntrypoints",
  "entrypointStatuses",
  "execution.nextEntrypointId",
  "execution.nextExecutableAction"
]);

requireIncludes("artifacts/tasks/_TEMPLATE/report.md", [
  "- workspaceRoot:",
  "- taskMode:",
  "- fallbackMode:",
  "- primaryTopic:",
  "- 当前轮次预算:",
  "- deepDivePermit.active:",
  "- activeEntrypoints:",
  "- execution.nextExecutableAction:"
]);

requireIncludes("tools/task/task-close.mjs", [
  "renderTaskSummaryBody",
  "deriveTaskMode",
  "deriveTopicFocus",
  "deriveEvidenceStatus",
  "deriveWhyNotDeliveredYet",
  "activeEntrypoints",
  "entrypointStatuses",
  "execution.nextExecutableAction",
  "deepDivePermit.active",
  "当前轮次预算"
]);

requireIncludes("tools/task/validation.mjs", [
  "executionModel.roundsConsumed exceeds roundBudget without an active deepDivePermit",
  "deepDivePermit.active=true requires deepDivePermit.subgoal",
  "report.md 任务摘要.taskMode must match executionModel.taskMode",
  "report.md 执行状态机.主专题 must match executionModel.primaryTopic",
  "report.md 切入点循环.activeEntrypoints must match route-state.json"
]);

try {
  assertVerifyPass("valid", "qa-behavioral-valid");
  assertVerifyFail(
    "fake-report",
    "qa-behavioral-fake-report",
    {
      report: {
        workspaceRoot: "C:/FAKE/ROOT",
        taskLocalRoot: "C:/FAKE/TASK",
        artifactTruthRoot: "C:/FAKE/ARTIFACT",
        workspaceKind: "totally-fake",
        taskMode: "火箭模式",
        primaryTopic: "fake-topic",
        secondaryTopicsText: "甲, 乙, 丙, 丁, 戊",
        currentState: "FAKE-STATE",
        primaryEntrypoint: "EP-999",
        primaryModeExecution: "火箭模式",
        primaryTopicExecution: "fake-topic",
        secondaryTopicsExecution: "甲, 乙, 丙, 丁, 戊",
        experimentClass: "totally-fake-experiment",
        activeEntrypoints: "EP-999, EP-998, EP-997",
        entrypointStatuses: "EP-999:PROBING | EP-998:PROBING",
        nextEntrypointId: "EP-999",
        nextExecutableAction: "伪造的 next action"
      }
    },
    [
      "report.md 任务摘要.workspaceRoot must match execution.discipline.workspaceRoot",
      "report.md 任务摘要.taskLocalRoot must match execution.discipline.taskLocalRoot",
      "report.md 任务摘要.artifactTruthRoot must match execution.discipline.artifactTruthRoot",
      "report.md 任务摘要.workspaceKind must match execution.discipline.workspaceKind",
      "report.md 任务摘要.taskMode must match executionModel.taskMode",
      "report.md 任务摘要.primaryTopic must match executionModel.primaryTopic",
      "report.md 执行状态机.当前执行状态 must match executionModel.currentState",
      "report.md 执行状态机.主切入点 must match executionModel.primaryEntrypoint",
      "report.md 执行状态机.当前实验类别 must match executionModel.experimentClass",
      "report.md 切入点循环.activeEntrypoints must match route-state.json",
      "report.md 切入点循环.execution.nextEntrypointId must match route-state.json"
    ]
  );
  assertVerifyFail(
    "infer-missing-controls",
    "qa-behavioral-infer-missing-controls",
    {
      executionModel: {
        taskMode: "",
        primaryTopic: "",
        secondaryTopics: [],
        controlSources: {
          currentState: "explicit",
          primaryEntrypoint: "explicit",
          taskMode: "",
          fallbackMode: "unset",
          primaryTopic: "",
          secondaryTopics: "",
          microRoute: "explicit",
          experimentClass: "explicit",
          roundBudget: "explicit",
          roundsConsumed: "explicit",
          "deepDivePermit.active": "explicit",
          "deepDivePermit.maxRounds": "explicit"
        }
      },
      report: {
        taskMode: "请求验收",
        primaryTopic: "signature",
        secondaryTopicsText: "protocol",
        primaryModeExecution: "请求验收",
        primaryTopicExecution: "signature",
        secondaryTopicsExecution: "protocol"
      }
    },
    [
      "strong execution states require executionModel.controlSources.taskMode=explicit",
      "strong execution states require executionModel.controlSources.primaryTopic=explicit",
      "strong execution states require executionModel.controlSources.secondaryTopics=explicit"
    ]
  );
  assertVerifyFail(
    "budget-overflow",
    "qa-behavioral-budget-overflow",
    {
      executionModel: {
        roundBudget: 2,
        roundsConsumed: 999
      },
      report: {
        roundBudget: 2,
        roundsConsumed: 999
      }
    },
    [
      "executionModel.roundsConsumed exceeds roundBudget without an active deepDivePermit"
    ]
  );
  assertVerifyFail(
    "semantic-mismatch",
    "qa-behavioral-semantic-mismatch",
    {
      executionModel: {
        taskMode: "纯算法提取",
        primaryTopic: "wasm",
        secondaryTopics: ["worker"],
        controlSources: {
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
        }
      },
      report: {
        taskMode: "纯算法提取",
        primaryTopic: "wasm",
        secondaryTopicsText: "worker",
        primaryModeExecution: "纯算法提取",
        primaryTopicExecution: "wasm",
        secondaryTopicsExecution: "worker"
      }
    },
    [
      "executionModel.taskMode is semantically inconsistent",
      "executionModel.primaryTopic is semantically inconsistent",
      "executionModel.secondaryTopics is semantically inconsistent"
    ]
  );
  assertVerifyFail(
    "permit-incomplete",
    "qa-behavioral-permit-incomplete",
    {
      executionModel: {
        roundBudget: 2,
        roundsConsumed: 3,
        deepDivePermit: {
          active: true,
          maxRounds: 4
        }
      },
      report: {
        roundBudget: 2,
        roundsConsumed: 3,
        deepDiveActive: "true",
        deepDiveMaxRounds: 4,
        deepDiveCurrentMicroRoute: "(none)",
        deepDiveSubgoal: "(none)",
        deepDiveMilestone: "(none)",
        deepDiveExitCondition: "(none)",
        deepDiveExpectedEvidence: "(none)"
      }
    },
    [
      "deepDivePermit.active=true requires deepDivePermit.subgoal",
      "deepDivePermit.active=true requires deepDivePermit.milestone",
      "deepDivePermit.active=true requires deepDivePermit.exitCondition",
      "deepDivePermit.active=true requires deepDivePermit.expectedHighValueEvidence",
      "deepDivePermit.active=true requires deepDivePermit.currentMicroRoute"
    ]
  );
  assertTaskSyncFail(
    "raw-invalid",
    "qa-behavioral-raw-invalid",
    (task) => {
      task.executionModel ||= {};
      task.executionModel.roundBudget = "bogus";
      task.executionModel.roundsConsumed = "-7";
      task.executionModel.deepDivePermit = {
        ...(task.executionModel.deepDivePermit || {}),
        active: "true",
        maxRounds: "bogus"
      };
    },
    [
      "executionModel.roundBudget must be a positive integer in raw task.json",
      "executionModel.roundsConsumed must be a non-negative integer in raw task.json",
      "executionModel.deepDivePermit.active must be a boolean in raw task.json",
      "executionModel.deepDivePermit.maxRounds must be a non-negative integer in raw task.json"
    ]
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-behavioral-enforcement");
