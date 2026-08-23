import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { failWith } from "./common.mjs";
import { listTopicsByMaturity } from "./topic-registry.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-synthetic-"));
const workspaceRoot = path.join(tempRoot, "workspace");
const tasksRoot = path.join(workspaceRoot, "artifacts", "tasks");
const topicFilter = new Set(
  process.argv
    .filter((item) => item.startsWith("--topic="))
    .flatMap((item) => item.split("=")[1].split(","))
    .map((item) => String(item || "").trim())
    .filter(Boolean)
);

function run(command, args, cwd = repoRoot) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      WEB_REVERSE_WORKSPACE_ROOT: workspaceRoot
    }
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text);
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function setValueByPath(target, valuePath, value) {
  const keys = String(valuePath || "").split(".").filter(Boolean);
  if (keys.length === 0) {
    return;
  }

  let current = target;
  for (const key of keys.slice(0, -1)) {
    if (current[key] == null || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function deriveSyntheticTaskMode(topic) {
  const key = String(topic?.key || "").trim();
  if (["signature", "protocol", "graphql-rpc", "grpc-web"].includes(key)) {
    return "请求验收";
  }
  if (["media-drm", "frame", "streaming-runtime"].includes(key)) {
    return "内容 / 明文边界恢复";
  }
  if (["wasm", "worker", "jsvmp"].includes(key)) {
    return "浏览器内可控复用";
  }
  return "请求验收";
}

function applySyntheticTaskSeed(task, topic) {
  for (const seed of topic.synthetic?.taskSeed || []) {
    if (!seed?.path) {
      continue;
    }
    setValueByPath(task, seed.path, seed.value);
  }
}

function buildSyntheticEntrypoints(topic) {
  return [
    {
      id: "EP-001",
      title: "剔除低收益噪音支线",
      hypothesis: `${topic.routeTrack} 上存在一个看似诱人但低收益的噪音支线，会干扰主路径判断。`,
      boundTopics: [topic.key],
      targetTrack: topic.routeTrack,
      rationale: "先放入一个会失败的探针，用于验证 synthetic 夹具的 pivot / retrospective 处理链路。",
      cost: "low",
      expectedGain: "low",
      probe: "快速确认这是噪音支线，然后用明确失败证据将其 parked / exhausted。",
      successCriteria: "要么快速形成决定性证据，要么快速失败并让主路径收敛。",
      failureCriteria: "最小探针后仍然没有新的可执行分歧。",
      status: "EXHAUSTED",
      resultSummary: "噪音支线已按 synthetic 设计被耗尽。",
      evidenceRefs: ["report.md#entrypoint-loop"],
      nextOnFailure: "切到 EP-002",
      updatedAt: new Date().toISOString()
    },
    {
      id: "EP-002",
      title: `推进 ${topic.routeTrack} 主探针`,
      hypothesis: `${topic.routeTrack} 主路径仍然是当前最高价值的下一步。`,
      boundTopics: [topic.key],
      targetTrack: topic.routeTrack,
      rationale: "在噪音支线退场后，只保留一条高信号主路径继续推进。",
      cost: "low",
      expectedGain: "high",
      probe: `执行 ${topic.routeTrack} 的最小化验证路径，并保留验证产物。`,
      successCriteria: "synthetic 产物通过校验，且 route-state 继续保持可执行。",
      failureCriteria: "如果没有 retrospective 就无法继续推进。",
      status: "PROBING",
      resultSummary: "当前 synthetic 主探针仍在执行。",
      nextOnSuccess: "verify-once",
      nextOnFailure: "创建 RETRO-001 并生成新的候选切入点",
      updatedAt: new Date().toISOString()
    }
  ];
}

function buildSyntheticRetrospectives() {
  return [
    {
      id: "RETRO-001",
      triggeredByEntrypoints: ["EP-001"],
      summary: "已移除噪音支线，并把 working set 收敛到主路径。",
      failedBecause: "该探针没有形成新的可执行分歧。",
      newEntrypoints: ["EP-002"],
      decision: "继续推进仍然存活的高信号主路径。",
      nextFocus: "EP-002",
      createdAt: new Date().toISOString()
    }
  ];
}

function writeSyntheticArtifacts(taskDir, topic) {
  for (const artifact of topic.synthetic?.artifactSeeds || []) {
    if (!artifact?.path) {
      continue;
    }

    const fullPath = path.join(taskDir, ...String(artifact.path).split("/"));
    ensureParent(fullPath);
    if (Object.prototype.hasOwnProperty.call(artifact, "json")) {
      writeJson(fullPath, artifact.json);
    } else {
      writeText(fullPath, String(artifact.text || ""));
    }
  }
}

function updateTaskForTopic(taskDir, topic) {
  const taskJsonPath = path.join(taskDir, "task.json");
  const routeStatePath = path.join(taskDir, "state", "route-state.json");
  const task = readJson(taskJsonPath);
  const routeState = readJson(routeStatePath);
  const requiredSignals = topic.requiredSignals || topic.signals || [];
  const acceptanceGap = `synthetic-e2e 只验证 ${topic.key} 路线闭环，尚未升级到真实 delivered 交付。`;
  const nextEvidenceGate = `verify-once 通过，且 ${topic.routeTrack} route-state 保持 ready-to-continue。`;
  const taskMode = deriveSyntheticTaskMode(topic);
  const nextExecutableAction = `执行 ${topic.routeTrack} 的最小化验证路径，并保留验证产物。`;

  task.phase = "Capture";
  task.targetContext.targetKeywords = requiredSignals.slice(0, 3);
  task.targetContext.targetFunctionNames = [topic.routeTrack.replace(/[^a-z0-9]/gi, "_")];
  task.routeState.activeTracks = [topic.routeTrack];
  task.routeState.activeEntrypoints = ["EP-002"];
  task.routeState.executionStatus = "ready-to-continue";
  task.routeState.nextEntrypointId = "EP-002";
  task.routeState.nextExecutableAction = nextExecutableAction;
  task.routeState.pauseCategory = "none";
  task.routeState.pauseReason = "";
  task.successCriteria = [{ label: "synthetic", status: "hit" }];
  task.taskContract.objective = `验证 ${topic.key} synthetic route 是否保持可继续执行且不漂移。`;
  task.taskContract.deliverableTier ||= "generic-acceptance";
  task.taskContract.completionCriteria = [
    "verify-once --validate-only 通过",
    "route-state 维持 ready-to-continue"
  ];
  task.acceptanceModel.claimLevel = "provisional";
  task.acceptanceModel.acceptanceGap = acceptanceGap;
  task.acceptanceModel.nextEvidenceGate = nextEvidenceGate;
  task.acceptanceModel.acceptancePath = "run/fixtures.json + synthetic artifact seeds";
  task.acceptanceModel.completionBlockedBy = [];
  task.executionModel.currentState = "Capture";
  task.executionModel.primaryEntrypoint = "EP-002";
  task.executionModel.taskMode = taskMode;
  task.executionModel.fallbackMode = "";
  task.executionModel.primaryTopic = topic.key;
  task.executionModel.secondaryTopics = [];
  task.executionModel.microRoute = topic.routeTrack;
  task.executionModel.experimentClass = "synthetic-e2e";
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
  task.executionModel.highValueEvidenceGoal = `${topic.key} synthetic verify path ready`;
  task.executionModel.nextUpgradeGate = nextEvidenceGate;
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
  applySyntheticTaskSeed(task, topic);

  routeState.taskId = task.taskId;
  routeState.phase = task.phase;
  routeState.syncStatus = "synthetic-ready";
  routeState.activeTracks = [topic.routeTrack];
  routeState.activeEntrypoints = ["EP-002"];
  routeState.execution.status = "ready-to-continue";
  routeState.execution.autoAdvanceEligible = true;
  routeState.execution.pauseCategory = "none";
  routeState.execution.pauseReason = "";
  routeState.execution.nextEntrypointId = "EP-002";
  routeState.execution.nextPhase = "Capture";
  routeState.execution.nextExecutableAction = nextExecutableAction;
  routeState.execution.summary = `${topic.key} synthetic route is ready to continue.`;
  routeState.tracks = [
    {
      id: topic.routeTrack,
      title: topic.routeTrack,
      target: `cover ${topic.key}`,
      inputs: requiredSignals.join(", "),
      output: "report.md + run/*",
      priority: "P0",
      checkpoints: ["synthetic-setup"],
      status: "IN_PROGRESS",
      nextStep: "verify-once",
      updatedAt: new Date().toISOString()
    }
  ];
  routeState.entrypoints = buildSyntheticEntrypoints(topic);
  routeState.retrospectives = buildSyntheticRetrospectives();
  routeState.clues = [
    {
      id: "CLUE-001",
      sourceTrack: topic.routeTrack,
      sourceEntrypoint: "EP-002",
      discoveredAt: new Date().toISOString(),
      content: `${topic.key} synthetic clue`,
      verification: "fixtures",
      impact: "validation",
      action: "continue verify-once",
      confidence: "high"
    },
    {
      id: "CLUE-002",
      sourceTrack: topic.routeTrack,
      sourceEntrypoint: "EP-001",
      discoveredAt: new Date().toISOString(),
      content: `${topic.key} noisy probe retired`,
      verification: "retrospective",
      impact: "working-set cleanup",
      action: "keep EP-002 active",
      confidence: "medium"
    }
  ];

  writeJson(taskJsonPath, task);
  writeJson(routeStatePath, routeState);

  writeText(
    path.join(taskDir, "report.md"),
    [
      "# \u9006\u5411\u62a5\u544a",
      "",
      "## 任务摘要",
      "",
      `- workspaceRoot: ${workspaceRoot}`,
      `- taskLocalRoot: ${taskDir}`,
      `- artifactTruthRoot: ${taskDir}`,
      "- workspaceKind: external-workspace",
      `- taskMode: ${taskMode}`,
      "- fallbackMode: (none)",
      `- deliverableTier: ${task.taskContract.deliverableTier}`,
      `- primaryTopic: ${topic.key}`,
      "- secondaryTopics: (none)",
      `- claimLevel: ${task.acceptanceModel.claimLevel}`,
      "- evidenceStatus: 已形成验收路径但未交付",
      `- whyNotDeliveredYet: ${task.acceptanceModel.acceptanceGap}`,
      `- acceptanceGap: ${task.acceptanceModel.acceptanceGap}`,
      `- nextEvidenceGate: ${task.acceptanceModel.nextEvidenceGate}`,
      "",
      "## 当前阶段",
      "",
      "- 当前阶段：`Capture`",
      `- synthetic: ${topic.key}（合成专题样本）`,
      "",
      "## 任务契约",
      "",
      `- 目标: ${task.taskContract.objective}`,
      `- 当前交付层级: ${task.taskContract.deliverableTier}`,
      `- 完成判据: ${(task.taskContract.completionCriteria || []).join(" | ")}`,
      `- 禁止冒充完成的替代态: ${(task.taskContract.intermediateStatesNotDelivery || []).join(" | ")}`,
      "",
      "## 切入点循环",
      "",
      "- activeEntrypoints: EP-002",
      "- entrypointStatuses: EP-001:EXHAUSTED | EP-002:PROBING",
      "- execution.nextEntrypointId: EP-002",
      `- execution.nextExecutableAction: ${nextExecutableAction}`,
      "- 候选切入点: EP-001, EP-002",
      "- 本轮实际验证的切入点: EP-002",
      "- 为什么先试它: 先排除设计好的低收益噪音支线，再把工作集收敛到当前最高信号的 probe。",
      "- 成功或失败的判据: 成功为 synthetic 产物通过校验且 route-state 保持 ready-to-continue；失败为 EP-002 不能再产出可执行分流，需要先复盘再扩展专题。",
      "- 切换理由 / 复盘: EP-001 按设计被耗尽，RETRO-001 将 EP-002 提升为当前主路径。",
      "",
      "## 自动续跑决策",
      "",
      "- 执行状态: ready-to-continue",
      "- 暂停类别: none",
      "- 暂停原因: ",
      `- 下一可执行动作: ${nextExecutableAction}`,
      "",
      "## 执行状态机",
      "",
      "- 当前执行状态: Capture",
      `- 主切入点: ${task.executionModel.primaryEntrypoint}`,
      `- 主模式: ${task.executionModel.taskMode}`,
      `- 主专题: ${task.executionModel.primaryTopic}`,
      "- 辅助专题: (none)",
      `- 当前微路线: ${task.executionModel.microRoute}`,
      `- 当前实验类别: ${task.executionModel.experimentClass}`,
      `- 当前轮次预算: ${task.executionModel.roundBudget}`,
      `- 当前已消耗轮次: ${task.executionModel.roundsConsumed}`,
      `- 当前停损条件: ${task.executionModel.stopLossCondition}`,
      "- deepDivePermit.active: false",
      "- deepDivePermit.maxRounds: 0",
      "- deepDivePermit.currentMicroRoute: (none)",
      "- deepDivePermit.subgoal: (none)",
      "- deepDivePermit.milestone: (none)",
      "- deepDivePermit.exitCondition: (none)",
      "- deepDivePermit.expectedHighValueEvidence: (none)",
      "",
      "## 验收闭环",
      "",
      `- claimLevel: ${task.acceptanceModel.claimLevel}`,
      `- acceptanceGap: ${task.acceptanceModel.acceptanceGap}`,
      `- nextEvidenceGate: ${task.acceptanceModel.nextEvidenceGate}`,
      `- acceptancePath: ${task.acceptanceModel.acceptancePath}`,
      `- validators: ${(task.acceptanceModel.validators || []).join(", ")}`,
      "- completionBlockedBy: (none)",
      "",
      "## 逆向分析过程",
      "",
      `- 入口定位：从 ${topic.routeTrack} 的高信号探针 EP-002 切入，排除噪音支线 EP-001。`,
      `- 关键取证：在 ${topic.routeTrack} 上抓到 synthetic clue 并用 fixtures 固化为可复跑证据。`,
      "- 逐步还原：按 synthetic 设计收敛工作集到单条主路径，保留验证产物。",
      "",
      "## 主要算法说明",
      "",
      `- 算法家族与判定依据：synthetic 合成样本，模拟 ${topic.key} 路线的可验证闭环。`,
      "- 输入清单：route-track 标识 + synthetic clue。",
      "- 输出与 carrier：run/fixtures.json 固化的可复跑输出。",
      "",
      "## 难点与对抗",
      "",
      "- 保护清单：synthetic 场景无真实保护，用噪音支线模拟低收益干扰。",
      "- 突破手法 + 验证：EP-001 快速失败 → RETRO-001 收敛到 EP-002 → fixtures 验证。",
      "- 残余风险：synthetic-e2e 仅验证路线闭环，未升级到真实 delivered 交付。",
      "",
      "## 调用示例",
      "",
      "- 完整运行命令：node run/verify-once.mjs --validate-only",
      "- 样例输入：run/fixtures.json 的 input.routeTrack",
      "- 预期输出片段：output.ready=true",
      "",
      "## 经验参考",
      "",
      "- 是否实际采纳: 合成校验样本",
      "- 采纳后影响了哪条路线: 当前主路线已被合成校验样本确认",
      "",
      "## 事实",
      "",
      "- 当前 synthetic-e2e 报告专门用于验证任务摘要、切入点循环、执行状态机与验收闭环这些字段已经进入正式校验，而不是停留在提示词层面。",
      "",
      "## 验证",
      "",
      "- synthetic verify path ready",
      "",
      "## 产物路径",
      "",
      `- artifacts/tasks/${path.basename(taskDir)}/report.md`,
      "",
      "## 下一步",
      "",
      "Rebuild",
      ""
    ].join("\n")
  );

  writeJson(path.join(taskDir, "run", "fixtures.json"), {
    meta: { topic: topic.key },
    input: { routeTrack: topic.routeTrack },
    intermediate: { clue: "synthetic" },
    output: { ready: true }
  });

  writeSyntheticArtifacts(taskDir, topic);
}

try {
  for (const topic of listTopicsByMaturity("synthetic-e2e").filter((item) => topicFilter.size === 0 || topicFilter.has(item.key))) {
    const taskId = `__synthetic-${topic.key}-${Date.now()}`;
    const taskDir = path.join(tasksRoot, taskId);

    try {
      const init = run(process.execPath, [
        path.join(repoRoot, "tools", "task", "task-init.mjs"),
        taskId,
        ...(topic.synthetic?.extensions || [])
      ]);
      if (init.status !== 0) {
        findings.push(`${topic.key} task:init failed: ${(init.stderr || init.stdout || "").trim()}`);
        continue;
      }

      updateTaskForTopic(taskDir, topic);

      const sync = run(process.execPath, [path.join(repoRoot, "tools", "task", "task-sync.mjs"), taskId]);
      if (sync.status !== 0) {
        findings.push(`${topic.key} task:sync failed: ${(sync.stderr || sync.stdout || "").trim()}`);
        continue;
      }

      const syncedRouteState = readJson(path.join(taskDir, "state", "route-state.json"));
      const reportPath = path.join(taskDir, "report.md");
      const syncedNextAction = syncedRouteState.execution?.nextExecutableAction || "";
      const syncedReport = fs
        .readFileSync(reportPath, "utf8")
        .replace(/^- execution\.nextExecutableAction:.*$/m, `- execution.nextExecutableAction: ${syncedNextAction}`)
        .replace(/^- 下一可执行动作:.*$/m, `- 下一可执行动作: ${syncedNextAction}`);
      writeText(reportPath, syncedReport);

      const verify = run(process.execPath, [path.join(taskDir, "run", "verify-once.mjs"), "--validate-only"], path.join(taskDir, "run"));
      if (verify.status !== 0) {
        findings.push(`${topic.key} verify-once failed: ${(verify.stderr || verify.stdout || "").trim()}`);
        continue;
      }

      console.log(`[synthetic:${topic.key}] OK`);
    } finally {
      fs.rmSync(taskDir, { recursive: true, force: true });
    }
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

failWith(findings, "check-synthetic-e2e");
