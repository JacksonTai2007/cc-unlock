import fs from "node:fs";
import path from "node:path";
import { readTopicRegistry } from "../topic-registry.mjs";
import {
  ensureTaskRuntimeShape,
  readTaskJson,
  resolveTaskDir,
  taskFile,
  writeTaskJson
} from "../task/common.mjs";
import {
  applyRouteStateToTask,
  normalizeRouteStateDocument,
  readRouteStateDocument,
  resolveExecutionState,
  syncMarkdownViews,
  writeRouteStateDocument
} from "../task/route-state.mjs";
import { runVerification } from "../task/verification.mjs";
import { getSmokeScenario } from "./smoke-scenarios.mjs";

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeArtifact(taskDir, relPath, value) {
  const fullPath = taskFile(taskDir, relPath);
  ensureDirFor(fullPath);

  if (typeof value === "string") {
    fs.writeFileSync(fullPath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
    return;
  }

  if (/\.(json|jsonl)$/i.test(relPath)) {
    fs.writeFileSync(fullPath, JSON.stringify(value, null, 2) + "\n", "utf8");
    return;
  }

  fs.writeFileSync(fullPath, `${String(value)}\n`, "utf8");
}

function markSuccessCriteria(task) {
  const criteria = Array.isArray(task.completionCriteria) && task.completionCriteria.length > 0
    ? task.completionCriteria
    : (Array.isArray(task.successCriteria) ? task.successCriteria : []);
  task.completionCriteria = criteria.length > 0
    ? criteria.map((item, index) => {
        const label = typeof item === "string"
          ? item.replace(/^\[[ xX]\]\s*/, "")
          : String(item?.label || item?.title || item?.text || item || "");
        return {
          id: item?.id || `criterion-${index + 1}`,
          label,
          status: "met",
          evidenceRefs: [
            "report.md",
            "run/fixtures.json"
          ]
        };
      })
    : [
        {
          id: "criterion-1",
          label: "已完成 smoke 场景的最小交付",
          status: "met",
          evidenceRefs: [
            "report.md",
            "run/fixtures.json"
          ]
        }
    ];
  task.deliverables = (task.deliverables || []).map((item) => ({ ...item, status: "delivered" }));
}

function seedFixtures(taskDir, scenario) {
  writeArtifact(taskDir, "run/fixtures.json", {
    scenario: scenario.id,
    title: scenario.description,
    sampleInput: {
      requestId: `${scenario.id}-req-01`,
      bodyDigest: "demo-body-digest",
      nonce: "demo-nonce",
      timestamp: "1712000000"
    },
    expectedOutput: {
      summary: scenario.facts[0] || "smoke fixture"
    }
  });
}

function seedLocalReproArtifacts(taskDir, scenario) {
  writeArtifact(taskDir, "run/run-local.mjs", [
    "export function runScenario(input) {",
    `  return { scenario: "${scenario.id}", input, signature: "smoke-signature" };`,
    "}",
    "",
    "if (process.argv[2] === '--demo') {",
    "  console.log(JSON.stringify(runScenario({ demo: true }), null, 2));",
    "}"
  ].join("\n"));
  writeArtifact(taskDir, "run/local-repro-example.js", [
    `import { runScenario } from "./run-local.mjs";`,
    "",
    "console.log(runScenario({ account: 'demo-user' }));"
  ].join("\n"));
  writeArtifact(taskDir, "run/api-call-example.js", [
    "const request = {",
    "  path: '/login',",
    "  method: 'POST',",
    "  headers: { 'X-Demo-Sign': 'smoke-signature' }",
    "};",
    "",
    "console.log(request);"
  ].join("\n"));
  writeArtifact(taskDir, "run/verification-smoke.mjs", [
    "const input = process.argv[2] || '';",
    `console.log(JSON.stringify({ scenario: "${scenario.id}", input, signature: "smoke-signature-" + input }));`,
    ""
  ].join("\n"));
  const cases = ["alpha", "beta"].map((input) => ({
    id: `local-${input}`,
    role: "local-reproduction",
    runner: "node",
    entrypoint: "run/verification-smoke.mjs",
    args: [input],
    assertions: [
      { type: "stdout-json-equals", path: "input", value: input }
    ]
  }));
  cases.push({
    id: "api-call",
    role: "api-call",
    runner: "node",
    entrypoint: "run/verification-smoke.mjs",
    args: ["api"],
    assertions: [
      { type: "stdout-json-equals", path: "signature", value: "smoke-signature-api" }
    ]
  });
  writeArtifact(taskDir, "run/verification.spec.json", { schemaVersion: 1, cases });
}

function markPatchVerification(task) {
  const hasT3 = task.deliverableTier === "T3" || (task.deliverables || []).some((item) => item.tier === "T3");
  if (!hasT3) return;
  task.patchBaseline = {
    status: "passed",
    sourceArtifactSha256: "a".repeat(64),
    resignedArtifactSha256: "b".repeat(64),
    signatureVerified: true,
    installed: true,
    launched: true,
    usedUninstall: false,
    userApprovedDataReset: false,
    evidenceRefs: ["run/fixtures.json"]
  };
  task.patchRegressionMatrix = ["cold-start", "core-path", "signature-integrity"].map((id) => ({
    id,
    status: "passed",
    evidenceRefs: ["run/fixtures.json"]
  }));
}

function seedPureArtifact(taskDir, scenario) {
  const pureName = `run/pure-${scenario.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.mjs`;
  writeArtifact(taskDir, pureName, [
    "export function extractPureLogic(input) {",
    `  return { scenario: "${scenario.id}", normalizedInput: input, result: "pure-smoke-output" };`,
    "}",
    "",
    "if (process.argv[2] === '--demo') {",
    "  console.log(JSON.stringify(extractPureLogic({ demo: true }), null, 2));",
    "}"
  ].join("\n"));
}

function buildRouteState(task, scenario) {
  return normalizeRouteStateDocument(
    {
      taskId: task.taskId,
      phase: scenario.phase,
      syncStatus: "restored-from-route-state",
      tracks: [
        {
          id: "track-main",
          title: "主链恢复",
          target: "恢复目标链路的最短可证据路径",
          inputs: "Manifest / strings / hook / task-input",
          output: "形成可验证的主结论",
          priority: "P0",
          checkpoints: [
            "关键边界已裁定",
            "主要 artifacts 已更新"
          ],
          status: scenario.phase === "Port" ? "DONE" : "IN_PROGRESS",
          nextStep: scenario.nextAction,
          updatedAt: new Date().toISOString()
        },
        {
          id: "track-sidecar",
          title: "旁路线索",
          target: "记录残留风险与下轮入口",
          inputs: "次级线索",
          output: "下一轮关注点",
          priority: "P1",
          checkpoints: [
            "未决问题已记录"
          ],
          status: "BLOCKED",
          nextStep: "等待真实样本或下一轮补证",
          updatedAt: new Date().toISOString()
        }
      ],
      activeTracks: [
        "主链恢复"
      ],
      entrypoints: [
        {
          id: "EP-001",
          title: "主链入口",
          hypothesis: scenario.facts[0],
          targetTrack: "主链恢复",
          rationale: "成本最低且信息增益最高，先证明主业务链真实存在。",
          cost: "low",
          expectedGain: "直接恢复主边界与主阻塞点",
          probe: "最小静态分诊 + 一处关键 hook",
          successCriteria: "能回指到关键入口、关键边界或关键请求",
          failureCriteria: "连续未命中且没有新证据锚点",
          status: scenario.phase === "Port" ? "SUCCESS" : "EXPANDED",
          resultSummary: scenario.facts[0],
          evidenceRefs: [
            "report.md",
            "run/fixtures.json"
          ],
          nextOnSuccess: scenario.nextAction,
          nextOnFailure: "切换到边界入口并做 retrospective",
          updatedAt: new Date().toISOString()
        },
        {
          id: "EP-002",
          title: "边界入口",
          hypothesis: scenario.facts[1] || "补边界证据以防止误判",
          targetTrack: "旁路线索",
          rationale: "当主入口噪音过大时，用边界入口稳住结论。",
          cost: "medium",
          expectedGain: "收敛残留风险",
          probe: "边界取证 / 进程校验 / 缓存回指",
          successCriteria: "能解释主链上的未决问题",
          failureCriteria: "无法新增任何证据锚点",
          status: scenario.unresolved.length > 0 ? "PARKED" : "SUCCESS",
          resultSummary: scenario.unresolved[0] || "边界入口已收敛",
          evidenceRefs: [
            "state/clues.md"
          ],
          nextOnSuccess: "保留为后续补证入口",
          nextOnFailure: "记录 retrospective 后归档",
          updatedAt: new Date().toISOString()
        }
      ],
      activeEntrypoints: [
        "EP-001"
      ],
      retrospectives: scenario.unresolved.length > 0
        ? [
            {
              id: "RETRO-001",
              triggeredByEntrypoints: [
                "EP-002"
              ],
              summary: "边界入口已识别残留风险，但当前轮次不影响主链交付。",
              failedBecause: scenario.unresolved[0],
              newEntrypoints: [
                "EP-001"
              ],
              decision: "保留未决问题，先完成当前 closeout。",
              nextFocus: scenario.unresolved[0],
              createdAt: new Date().toISOString()
            }
          ]
        : [],
      clues: scenario.facts.map((fact, index) => ({
        id: `CLUE-00${index + 1}`,
        sourceTrack: index === 0 ? "主链恢复" : "旁路线索",
        sourceEntrypoint: index === 0 ? "EP-001" : "EP-002",
        discoveredAt: new Date().toISOString(),
        content: fact,
        verification: "已落盘到对应 artifact",
        impact: "推动当前 route 收敛",
        action: scenario.nextAction,
        confidence: index === 0 ? "high" : "medium"
      })),
      execution: {
        status: "ready-to-continue",
        autoAdvanceEligible: true,
        pauseCategory: "none",
        pauseReason: "",
        nextEntrypointId: "EP-001",
        nextPhase: scenario.phase,
        nextExecutableAction: scenario.nextAction,
        summary: scenario.description,
        updatedAt: new Date().toISOString()
      }
    },
    task
  );
}

function renderReport(task, taskDir, routeState, scenario) {
  const lines = [
    "# 逆向报告",
    "",
    "## 任务摘要",
    `- 场景: ${scenario.description}`,
    `- taskId: \`${task.taskId}\``,
    `- 目标: ${task.targetContext.inputTarget || task.target.path || ""}`,
    "",
    "## 当前阶段",
    `- 当前阶段：\`${task.phase}\``,
    `- 活跃切入点：${routeState.activeEntrypoints.join(", ")}`,
    "",
    "## 自动续跑决策",
    `- 执行状态：\`${routeState.execution.status}\``,
    `- 暂停类别: ${routeState.execution.pauseCategory}`,
    `- 暂停原因: ${routeState.execution.pauseReason || "无"}`,
    `- 下一可执行动作：\`${routeState.execution.nextExecutableAction}\``,
    "",
    "## 目标上下文",
    `- 目标描述: ${task.targetContext.objective || scenario.description}`,
    `- 包名: ${task.target.packageName || ""}`,
    `- 交付要求: ${(task.targetContext.requestedDeliverables || []).join(", ")}`,
    "",
    "## 切入点循环",
    `- 候选切入点: ${(routeState.entrypoints || []).map((item) => item.id).join(", ")}`,
    `- 本轮实际验证的切入点: ${routeState.execution.nextEntrypointId}`,
    `- 为什么先试它: ${routeState.entrypoints[0]?.rationale || ""}`,
    `- 成功或失败的判据: ${routeState.entrypoints[0]?.successCriteria || ""} / ${routeState.entrypoints[0]?.failureCriteria || ""}`,
    `- 切换理由 / 复盘: ${routeState.retrospectives?.[0]?.summary || "当前轮次未发生强制 pivot"}`,
    "",
    "## 事实",
    ...scenario.facts.map((item) => `- ${item}`),
    "",
    "## 推断",
    ...scenario.inferences.map((item) => `- ${item}`),
    "",
    "## 未决问题",
    ...(scenario.unresolved.length > 0 ? scenario.unresolved.map((item) => `- ${item}`) : ["- 当前 smoke 场景无额外未决问题。"]),
    "",
    "## 产物路径",
    "- report: report.md",
    "- fixtures: run/fixtures.json",
    "- route-state: state/route-state.json",
    "- route-plan: state/route-plan.md",
    "- clues: state/clues.md",
    "- progress: state/progress.md"
  ];

  if (task.deliveryRequirements?.localReproductionRequested === true) {
    lines.push(
      "",
      "## 本地复现交付",
      "- 本地算法实现: run/run-local.mjs",
      "- 调用示例: run/verification.spec.json#local-alpha",
      `- API 调用示例: ${task.deliveryRequirements?.apiCallExampleRequired === true ? "run/verification.spec.json#api-call" : "不要求"}`,
      "- 运行命令: `node run/verification-smoke.mjs alpha`",
      "- 样例输入: `[\"alpha\"]`",
      "- 输出 / 响应摘要: run/verification-result.json 记录了真实执行和输出断言"
    );
  }

  lines.push(
    "",
    "## 下一步",
    `- ${scenario.nextAction}`,
    ""
  );

  writeArtifact(taskDir, "report.md", lines.join("\n"));
}

function applyTopicOutcomes(task, taskDir, scenario) {
  const registry = readTopicRegistry();
  const configured = new Map(Object.entries(scenario.topicOutcomes || {}));
  const activeTopics = new Set(task.taskPacks?.selectedTopics || []);
  for (const topic of registry) {
    const rootKey = String(topic.formalValidation?.presentPath || topic.taskSemantics?.presentPath || "")
      .split(".")
      .filter(Boolean)[0];
    if (rootKey && task[rootKey]?.present === true) {
      activeTopics.add(topic.key);
    }
  }

  for (const topicKey of activeTopics) {
    const outcome = configured.get(topicKey) || {};
    const topic = registry.find((item) => item.key === topicKey);
    if (!topic) {
      throw new Error(`unknown topic in scenario ${scenario.id}: ${topicKey}`);
    }
    const rootKey = String(topic.formalValidation?.presentPath || topic.taskSemantics?.presentPath || "")
      .split(".")
      .filter(Boolean)[0];
    if (!rootKey) {
      throw new Error(`topic ${topicKey} has no presentPath root`);
    }

    task[rootKey] ||= {};
    task[rootKey].present = true;
    task[rootKey].status = outcome.status || "captured";
    task[rootKey].keyFindings = outcome.keyFindings || [
      `${scenario.description} 已覆盖 ${topic.label} 的最小 smoke 产物`
    ];
    task[rootKey].notes = outcome.notes || [
      `smoke scenario: ${scenario.id}`
    ];

    if (topicKey === "protection-bypass") {
      const surfaceMatrix = outcome.surfaceMatrix || {
        root: {
          status: "not-applicable",
          triggerStage: "startup",
          notes: [
            "smoke 默认标记为不阻塞当前链路"
          ]
        },
        frida: {
          status: "bypassed",
          triggerStage: "startup",
          notes: [
            "smoke 已触达最小 frida 绕过脚本"
          ]
        },
        integrity: {
          status: "not-applicable",
          triggerStage: "startup",
          notes: [
            "当前场景不要求完整性校验闭环"
          ]
        },
        pinning: {
          status: "not-applicable",
          triggerStage: "pre-request",
          notes: [
            "当前场景未要求 pinning 作为主阻塞点"
          ]
        }
      };
      task[rootKey].surfaceMatrix ||= {};
      for (const [surfaceKey, surface] of Object.entries(surfaceMatrix)) {
        task[rootKey].surfaceMatrix[surfaceKey] ||= {};
        task[rootKey].surfaceMatrix[surfaceKey].status = surface.status;
        task[rootKey].surfaceMatrix[surfaceKey].triggerStage = surface.triggerStage;
        task[rootKey].surfaceMatrix[surfaceKey].notes = surface.notes || [];
      }
    }

    for (const relPath of topic.formalValidation?.requiredArtifacts || []) {
      const artifactValue = outcome.artifacts?.[relPath] || (
        relPath.endsWith(".json")
          ? {
              scenario: scenario.id,
              topic: topicKey,
              summary: `${topic.label} smoke`
            }
          : relPath.endsWith(".js")
            ? [
                `// ${topic.label} smoke placeholder for ${scenario.id}`,
                `// This file was auto-generated; replace with actual hook logic.`,
                `"use strict";`,
                ``,
                `Java.perform(function () {`,
                `  try {`,
                `    var PlaceholderTarget = Java.use("java.lang.Object");`,
                `    console.log("[smoke-placeholder] ${topic.label} surface probe for ${scenario.id}");`,
                `  } catch (e) {`,
                `    console.log("[smoke-placeholder] ${topic.label} probe skipped: " + e.message);`,
                `  }`,
                `});`
              ].join("\n")
            : `# ${topic.label}\n\n- smoke scenario: ${scenario.id}\n- 说明: 自动补齐最小可验证工件\n`
      );
      writeArtifact(taskDir, relPath, artifactValue);
    }

    for (const [relPath, value] of Object.entries(outcome.artifacts || {})) {
      writeArtifact(taskDir, relPath, value);
    }
  }
}

function main() {
  const scenarioId = process.argv[2];
  const taskRef = process.argv[3];
  if (!scenarioId || !taskRef) {
    console.error("usage: node tools/qa/apply-smoke-scenario.mjs <scenario-id> <task-id|task-path>");
    process.exit(1);
  }

  const scenario = getSmokeScenario(scenarioId);
  if (!scenario) {
    console.error(`unknown smoke scenario: ${scenarioId}`);
    process.exit(1);
  }

  const taskDir = resolveTaskDir(taskRef);
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  task.phase = scenario.phase;
  task.validation.status = "not-started";
  task.validation.notes = [];
  markSuccessCriteria(task);
  markPatchVerification(task);
  seedFixtures(taskDir, scenario);
  if (
    task.deliveryRequirements?.localReproductionRequested === true ||
    ["Rebuild", "Patch", "PureExtraction", "Port"].includes(scenario.phase)
  ) {
    seedLocalReproArtifacts(taskDir, scenario);
  }
  if (scenario.phase === "Port" || task.deliveryRequirements?.localReproductionRequested === true) {
    seedPureArtifact(taskDir, scenario);
  }
  if (task.deliveryRequirements?.localReproductionRequested === true) {
    const verification = runVerification(taskDir);
    if (!verification.ok) {
      throw new Error(`smoke verification failed: ${verification.errors.join("; ")}`);
    }
  }
  applyTopicOutcomes(task, taskDir, scenario);

  let routeState = readRouteStateDocument(taskDir, task);
  routeState = buildRouteState(task, scenario, routeState);
  routeState.execution = resolveExecutionState(task, routeState);
  routeState = writeRouteStateDocument(taskDir, task, routeState);
  applyRouteStateToTask(task, routeState);
  writeTaskJson(taskDir, task);
  const refreshedTask = ensureTaskRuntimeShape(readTaskJson(taskDir));
  applyTopicOutcomes(refreshedTask, taskDir, scenario);
  writeTaskJson(taskDir, refreshedTask);
  const finalizedTask = ensureTaskRuntimeShape(readTaskJson(taskDir));
  let finalizedRouteState = readRouteStateDocument(taskDir, finalizedTask);
  finalizedRouteState = buildRouteState(finalizedTask, scenario, finalizedRouteState);
  finalizedRouteState.execution = resolveExecutionState(finalizedTask, finalizedRouteState);
  finalizedRouteState = writeRouteStateDocument(taskDir, finalizedTask, finalizedRouteState);
  applyRouteStateToTask(finalizedTask, finalizedRouteState);
  writeTaskJson(taskDir, finalizedTask);
  syncMarkdownViews(taskDir, finalizedTask, finalizedRouteState);
  renderReport(finalizedTask, taskDir, finalizedRouteState, scenario);
  const postReportTask = ensureTaskRuntimeShape(readTaskJson(taskDir));
  applyTopicOutcomes(postReportTask, taskDir, scenario);
  writeTaskJson(taskDir, postReportTask);
  let postReportRouteState = readRouteStateDocument(taskDir, postReportTask);
  postReportRouteState = buildRouteState(postReportTask, scenario, postReportRouteState);
  postReportRouteState.execution = resolveExecutionState(postReportTask, postReportRouteState);
  postReportRouteState = writeRouteStateDocument(taskDir, postReportTask, postReportRouteState);
  applyRouteStateToTask(postReportTask, postReportRouteState);
  writeTaskJson(taskDir, postReportTask);
  syncMarkdownViews(taskDir, postReportTask, postReportRouteState);
  renderReport(postReportTask, taskDir, postReportRouteState, scenario);
  console.log(`apply-smoke-scenario: updated ${postReportTask.taskId} with ${scenario.id}`);
}

main();
