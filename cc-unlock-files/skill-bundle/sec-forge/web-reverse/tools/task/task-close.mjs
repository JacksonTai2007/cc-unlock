import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectRawTaskShapeFindings,
  deriveEvidenceStatus,
  deriveTaskMode,
  deriveTopicFocus,
  deriveWhyNotDeliveredYet,
  ensureTaskScaffold,
  ensureTaskRuntimeShape,
  ensureTaskWorkspaceBridges,
  readRawTaskJson,
  readTaskJson,
  relFromRepo,
    resolveTaskDir,
  skillRoot,
  taskFile,
  taskFileMatchesTemplate,
  templateTaskCoreDir,
  workspaceRoot,
  writeTaskJson
} from "./common.mjs";
import { synchronizeCloseoutState } from "./closeout-state.mjs";
import { applyRouteStateToTask, readRouteStateDocument, syncMarkdownViews } from "./route-state.mjs";
import { cleanupTaskArtifacts, relocateStrayWorkspaceArtifacts } from "./task-cleanup.mjs";

const headingAliases = {
  summary: [/^##\s*(?:任务摘要|Summary)\s*[：:]?\s*$/i],
  current: [/^##\s*(?:当前阶段|当前进度|当前状态)\s*[：:]?\s*$/i],
  execution: [/^##\s*(?:自动续跑决策|续跑决策|Continuation Decision)\s*[：:]?\s*$/i],
  next: [/^##\s*(?:下一步|后续动作|next step)\s*[：:]?\s*$/i],
  contract: [/^##\s*(?:任务契约|Task Contract)\s*[：:]?\s*$/i],
  executionModel: [/^##\s*(?:执行状态机|Execution Model)\s*[：:]?\s*$/i],
  acceptance: [/^##\s*(?:验收闭环|Acceptance Closure)\s*[：:]?\s*$/i],
  localRepro: [/^##\s*(?:本地复现交付|Local Reproduction Deliverables)\s*[：:]?\s*$/i],
  entrypoint: [/^##\s*(?:切入点循环|Entrypoint Loop)\s*[：:]?\s*$/i],
  artifacts: [/^##\s*(?:产物路径|Artifacts?)\s*[：:]?\s*$/i],
  clues: [/^##\s*(?:关键线索|线索|Key Clues|Clues)\s*[：:]?\s*$/i],
  // 报告详实度四段：逆向分析过程 / 主要算法说明 / 难点与对抗 / 调用示例。
  // 全部进入白名单 upsert，避免再造死段；为空时各自渲染显眼告警 bullet。
  reverseProcess: [/^##\s*(?:逆向分析过程|还原链路|Reverse(?:\s+Engineering)?\s+Process)\s*[：:]?\s*$/i],
  algorithm: [/^##\s*(?:主要算法说明|算法还原说明|Algorithm(?:\s+Explanation)?)\s*[：:]?\s*$/i],
  difficulty: [/^##\s*(?:难点与对抗|难点分析|Difficulties?(?:\s+and\s+Countermeasures)?)\s*[：:]?\s*$/i],
  callExample: [/^##\s*(?:调用示例|Call Example|Usage Example)\s*[：:]?\s*$/i]
};

function splitMarkdownSections(markdown) {
  const source = String(markdown || "");
  const headings = Array.from(source.matchAll(/^##\s+.+$/gm));
  if (headings.length === 0) {
    return [];
  }

  return headings.map((match, index) => {
    const headingStart = match.index;
    const headingLine = match[0];
    const bodyStart = headingStart + headingLine.length + (source[headingStart + headingLine.length] === "\r" ? 2 : 1);
    const nextHeadingStart = index + 1 < headings.length ? headings[index + 1].index : source.length;
    return {
      headingStart,
      headingLine,
      bodyStart,
      end: nextHeadingStart
    };
  });
}

function matchesHeading(headingLine, patterns) {
  const normalized = String(headingLine || "").trim();
  return patterns.some((pattern) => pattern.test(normalized));
}

function upsertMarkdownSection(markdown, patterns, canonicalHeading, body) {
  const source = String(markdown || "");
  const sections = splitMarkdownSections(source);
  const normalizedBody = String(body || "").trimEnd();
  const replacement = `${canonicalHeading}\n\n${normalizedBody}\n`;

  for (const section of sections) {
    if (matchesHeading(section.headingLine, patterns)) {
      return `${source.slice(0, section.headingStart)}${replacement}${
        source.slice(section.end).replace(/^\s*/, "\n")
      }`;
    }
  }

  if (!source.trim()) {
    return `${replacement}\n`;
  }

  return `${source.trimEnd()}\n\n${replacement}\n`;
}

function findPureArtifact(taskDir) {
  const candidates = [];
  for (const dirPath of [taskDir, taskFile(taskDir, "run")]) {
    if (!fs.existsSync(dirPath)) {
      continue;
    }
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }
      if (/^pure[_-].+\.(?:[cm]?js|py)$/i.test(entry.name)) {
        const fullPath = path.join(dirPath, entry.name);
        candidates.push(relFromRepo(fullPath, taskDir));
      }
    }
  }
  return candidates.sort((left, right) => left.localeCompare(right))[0] || "";
}

function relIfExists(taskDir, relPath) {
  return fs.existsSync(taskFile(taskDir, relPath)) ? relPath : "";
}

function ensureReportExists(taskDir) {
  const reportPath = taskFile(taskDir, "report.md");
  if (fs.existsSync(reportPath)) {
    return;
  }

  const templatePath = taskFile(templateTaskCoreDir, "report.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.copyFileSync(templatePath, reportPath);
}

function renderEntrypointLoopBody(routeState) {
  const entrypoints = routeState?.entrypoints || [];
  const candidateIds = entrypoints.map((entrypoint) => entrypoint.id).join(", ");
  const activeIds = routeState?.activeEntrypoints?.join(", ") || "";
  const entrypointStatuses = entrypoints
    .map((entrypoint) => `${entrypoint.id}:${entrypoint.status || "UNKNOWN"}`)
    .join(" | ");
  const activeEntrypointId =
    routeState?.execution?.nextEntrypointId ||
    routeState?.activeEntrypoints?.[0] ||
    entrypoints[0]?.id ||
    "";
  const activeEntrypoint = entrypoints.find((entrypoint) => entrypoint.id === activeEntrypointId) || null;
  const latestRetro = (routeState?.retrospectives || []).slice(-1)[0] || null;

  return [
    `- activeEntrypoints: ${activeIds}`,
    `- entrypointStatuses: ${entrypointStatuses}`,
    `- execution.nextEntrypointId: ${routeState?.execution?.nextEntrypointId || ""}`,
    `- execution.nextExecutableAction: ${routeState?.execution?.nextExecutableAction || ""}`,
    `- 候选切入点: ${candidateIds}`,
    `- 本轮实际验证的切入点: ${activeEntrypointId}`,
    `- 为什么先试它: ${activeEntrypoint?.rationale || ""}`,
    `- 成功或失败的判据: ${[activeEntrypoint?.successCriteria, activeEntrypoint?.failureCriteria].filter(Boolean).join(" / ")}`,
    `- 切换理由 / 复盘: ${latestRetro?.summary || ""}`
  ].join("\n");
}

function renderTaskSummaryBody(task, routeState, taskDir) {
  const execution = routeState?.execution || {};
  const discipline = execution?.discipline || {};
  const claimLevel = task.acceptanceModel?.claimLevel || "provisional";
  const model = task.executionModel || {};

  return [
    `- workspaceRoot: ${discipline.workspaceRoot || task.roots?.workspaceRoot || ""}`,
    `- taskLocalRoot: ${discipline.taskLocalRoot || task.roots?.taskLocalRoot || taskDir}`,
    `- artifactTruthRoot: ${discipline.artifactTruthRoot || task.roots?.taskLocalRoot || taskDir}`,
    `- workspaceKind: ${discipline.workspaceKind || discipline.workspaceMode || ""}`,
    `- taskMode: ${model.taskMode || ""}`,
    `- fallbackMode: ${task.executionModel?.fallbackMode || "(none)"}`,
    `- deliverableTier: ${task.taskContract?.deliverableTier || ""}`,
    `- primaryTopic: ${model.primaryTopic || ""}`,
    `- secondaryTopics: ${(model.secondaryTopics || []).join(", ") || "(none)"}`,
    `- claimLevel: ${claimLevel}`,
    `- evidenceStatus: ${deriveEvidenceStatus(task)}`,
    `- whyNotDeliveredYet: ${deriveWhyNotDeliveredYet(task)}`,
    `- acceptanceGap: ${task.acceptanceModel?.acceptanceGap || ""}`,
    `- nextEvidenceGate: ${task.acceptanceModel?.nextEvidenceGate || ""}`
  ].join("\n");
}

function renderLocalReproBody(taskDir, task) {
  const delivery = task.deliveryRequirements || {};
  const pureArtifact = findPureArtifact(taskDir);
  const example = relIfExists(taskDir, "run/local-repro-example.js");
  // 这三项是 validateLocalReproductionDelivery 的硬校验项（必须非空），优先读取
  // deliveryRequirements 上的显式字段，缺省时回退到能反映真实交付的可执行默认值，
  // 避免生成器产出空字符串后又被自身校验拒绝。
  const runCommand =
    cleanLocalReproValue(delivery.runCommand) ||
    (example ? `node ${example}` : pureArtifact ? `node ${pureArtifact}` : "");
  const sampleInput = cleanLocalReproValue(delivery.sampleInput);
  const outputSummary =
    cleanLocalReproValue(delivery.outputSummary) ||
    cleanLocalReproValue(task.acceptanceModel?.acceptancePath);
  return [
    `- 本地算法实现: ${pureArtifact}`,
    `- 调用示例: ${example}`,
    `- API 调用示例: ${delivery.apiCallExampleRequired === true ? relIfExists(taskDir, "run/web-replay.js") : ""}`,
    `- 运行命令: ${runCommand}`,
    `- 样例输入: ${sampleInput}`,
    `- 输出 / 响应摘要: ${outputSummary}`
  ].join("\n");
}

function cleanLocalReproValue(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function renderTaskContractBody(task) {
  const contract = task.taskContract || {};
  return [
    `- 目标: ${contract.objective || ""}`,
    `- 不可退让约束: ${(contract.nonNegotiables || []).join(" | ") || ""}`,
    `- 当前交付层级: ${contract.deliverableTier || ""}`,
    `- 完成判据: ${(contract.completionCriteria || []).join(" | ") || ""}`,
    `- 禁止冒充完成的替代态: ${(contract.intermediateStatesNotDelivery || []).join(" | ") || ""}`
  ].join("\n");
}

function renderExecutionModelBody(task, routeState) {
  const model = task.executionModel || {};
  const permit = model.deepDivePermit || {};
  return [
    `- 当前执行状态: ${model.currentState || task.phase || ""}`,
    `- 主切入点: ${model.primaryEntrypoint || routeState?.execution?.nextEntrypointId || ""}`,
    `- 主模式: ${model.taskMode || ""}`,
    `- 主专题: ${model.primaryTopic || ""}`,
    `- 辅助专题: ${(model.secondaryTopics || []).join(", ") || "(none)"}`,
    `- 当前微路线: ${model.microRoute || ""}`,
    `- 当前实验类别: ${model.experimentClass || ""}`,
    `- 当前轮次预算: ${model.roundBudget ?? ""}`,
    `- 当前已消耗轮次: ${model.roundsConsumed ?? ""}`,
    `- 当前停损条件: ${model.stopLossCondition || ""}`,
    `- deepDivePermit.active: ${permit.active === true ? "true" : "false"}`,
    `- deepDivePermit.maxRounds: ${permit.maxRounds ?? 0}`,
    `- deepDivePermit.currentMicroRoute: ${permit.currentMicroRoute || "(none)"}`,
    `- deepDivePermit.subgoal: ${permit.subgoal || "(none)"}`,
    `- deepDivePermit.milestone: ${permit.milestone || "(none)"}`,
    `- deepDivePermit.exitCondition: ${permit.exitCondition || "(none)"}`,
    `- deepDivePermit.expectedHighValueEvidence: ${permit.expectedHighValueEvidence || "(none)"}`
  ].join("\n");
}

function renderAcceptanceBody(task) {
  const acceptance = task.acceptanceModel || {};
  return [
    `- claimLevel: ${acceptance.claimLevel || "provisional"}`,
    `- acceptanceGap: ${acceptance.acceptanceGap || ""}`,
    `- nextEvidenceGate: ${acceptance.nextEvidenceGate || ""}`,
    `- acceptancePath: ${acceptance.acceptancePath || ""}`,
    `- validators: ${(acceptance.validators || []).join(", ") || ""}`,
    `- completionBlockedBy: ${(acceptance.completionBlockedBy || []).join(" | ") || ""}`,
    // 2.8 用户约束记忆：被否决方案显式暴露在交付物里，每轮恢复时对照排除（task-note --kind=reject 落盘）。
    `- userRejectedApproaches: ${(acceptance.userRejectedApproaches || []).join(" | ") || "（无）"}`
  ].join("\n");
}

function renderArtifactsBody(taskDir, task) {
  const rel = (relPath) => relFromRepo(taskFile(taskDir, relPath), taskDir);

  return [
    `- report: ${rel("report.md")}`,
    `- fixtures: ${rel("run/fixtures.json")}`,
    `- task-contract: ${rel("state/task-contract.md")}`,
    `- acceptance-checklist: ${rel("state/acceptance-checklist.md")}`,
    `- fact-observations: ${rel("state/fact-observations.json")}`,
    `- candidate-insights: ${rel("state/candidate-insights.json")}`,
    `- route-state: ${rel(task.routeState.statePath)}`,
    `- route-plan: ${rel(task.routeState.planPath)}`,
    `- clues: ${rel(task.routeState.cluesPath)}`,
    `- narrative: ${rel("state/narrative.md")}`,
    `- progress: ${rel(task.routeState.progressPath)}`
  ].join("\n");
}

// 杠杆3：report.md 的「关键线索」段直接由 state/clues.md（线索唯一真源）派生。
// 若一条线索都没沉淀，渲染一段显眼告警——让「不记录线索」的代价直接暴露在交付物里：
// 报告取材于 clues.md，不记录 = 交付物为空。这把「落盘」从利他记账变成自利刚需。
function renderCluesBody(routeState) {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const clues = (routeState?.clues || []).filter((clue) => clean(clue.content));
  if (clues.length === 0) {
    return [
      "> ⚠️ **本任务未沉淀任何线索**（`state/clues.md` 为空）。",
      "> 本段及整份报告取材于 `state/clues.md`——没有落盘的线索，这份交付物就是空的。",
      "> 发现可复用线索请立即用 Edit 往 `state/clues.md` 的「## 线索」下追加 bullet，或 `task-note --kind=clue`。"
    ].join("\n");
  }
  return clues
    .map((clue) => {
      const conf = clean(clue.confidence) || "provisional";
      const ep = clean(clue.sourceEntrypoint) ? ` {${clean(clue.sourceEntrypoint)}}` : "";
      return `- [${conf}] ${clean(clue.content)}${ep}`;
    })
    .join("\n");
}

// 读取 state/narrative.md 中指定 `## 小节` 下的有效 bullet（过滤模板占位说明）。
// narrative.md 是「叙事真源」脚手架：逆向分析过程 / 难点与对抗 优先取材于此，
// 缺失或为空时回退到 clues.md / retrospectives 派生，再无则渲染告警。
function readNarrativeSection(taskDir, headingPatterns) {
  const file = taskFile(taskDir, "state/narrative.md");
  if (!fs.existsSync(file)) {
    return [];
  }
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const sections = splitMarkdownSections(text);
  const target = sections.find((section) => matchesHeading(section.headingLine, headingPatterns));
  if (!target) {
    return [];
  }
  return text
    .slice(target.bodyStart, target.end)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    // 丢弃模板里以 `<` / `(填` / `示例：` 开头的占位说明，只保留真实沉淀。
    .filter((line) => line && !/^(?:<|（?填|\(填|示例[:：]|例如[:：])/.test(line));
}

// 杠杆同 renderCluesBody：有真源则渲染，无真源则渲染显眼告警 bullet，
// 把「不写还原叙事」的代价直接暴露在交付物里。即便没有 pivot 也产出 3~6 个关键节点。
function renderReverseProcessBody(taskDir, routeState) {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const lines = readNarrativeSection(taskDir, headingAliases.reverseProcess);
  if (lines.length > 0) {
    return lines.map((line) => `- ${line}`).join("\n");
  }
  // 回退真源 1：clues.md（每条线索带来源切入点 + 验证方式，天然是「怎么取证」的节点）。
  const clues = (routeState?.clues || []).filter((clue) => clean(clue.content));
  // 回退真源 2：retrospectives（pivot/试错决策）。
  const retros = (routeState?.retrospectives || []).filter((retro) => clean(retro.summary));
  const derived = [];
  for (const clue of clues) {
    const ep = clean(clue.sourceEntrypoint) ? `【${clean(clue.sourceEntrypoint)}】` : "";
    const verify = clean(clue.verification) ? `（取证：${clean(clue.verification)}）` : "";
    derived.push(`- ${ep}${clean(clue.content)}${verify}`);
  }
  for (const retro of retros) {
    const reason = clean(retro.failedBecause) ? `，原因：${clean(retro.failedBecause)}` : "";
    derived.push(`- 关键决策/试错：${clean(retro.summary)}${reason}`);
  }
  if (derived.length > 0) {
    return [
      "> 以下还原链路节点由 `state/clues.md` / retrospectives 自动派生；",
      "> 入口定位手法、为何先看该函数等叙事请在 `state/narrative.md` 的「## 逆向分析过程」补全。",
      ...derived
    ].join("\n");
  }
  return [
    "> ⚠ 未沉淀逆向分析过程叙事（`state/narrative.md`「## 逆向分析过程」为空，`state/clues.md` 也无线索）。",
    "> 本段要求还原链路叙事：入口定位手法 → 关键取证点 → 逐步还原的关键决策/试错；即便无 pivot 也须写出 3~6 个关键节点。",
    "> 交付前必须补全：用 Edit 往 `state/narrative.md` 的「## 逆向分析过程」追加 bullet，或先在 `state/clues.md` 沉淀线索。"
  ].join("\n");
}

// 主要算法说明：无条件渲染（不受 localReproductionRequested 门控）。
// 结构化骨架固定输出，每个槽位有真源（narrative.md「## 主要算法说明」）则填，否则留显眼告警占位，
// 把「报告没讲清算法」的代价暴露出来——接手人不该只看到一堆 run/*.md 路径。
function renderAlgorithmBody(taskDir) {
  const lines = readNarrativeSection(taskDir, headingAliases.algorithm);
  if (lines.length > 0) {
    return lines.map((line) => `- ${line}`).join("\n");
  }
  return [
    "> ⚠ 未沉淀主要算法说明（`state/narrative.md`「## 主要算法说明」为空）。",
    "> 接手人只看 run/*.md 路径无法读懂算法；本段负责「知识浓缩」，须按下列骨架逐项写清并删除本告警：",
    "- 算法家族与判定依据：（HMAC-SHA256 / AES-CBC / 魔改 MD5 / JSVMP 内联 等，写明判定证据）",
    "- 输入清单：（每个输入字段 + 来源：请求参数 / 时间戳 / nonce / 设备指纹 / 会话态）",
    "- 归一化规则：（canonical string 怎么拼：字段排序、分隔符、编码、大小写）",
    "- 密钥材料：（key / iv / salt / nonce 来源与派生链：硬编码？动态下发？指纹派生？）",
    "- 输出与 carrier：（算出来放进哪个 header / body 字段、编码方式）",
    "- 真实样例：（一组脱敏的 输入 → 输出）",
    "- 最小伪代码：（5~15 行可复现）",
    "- 数据流图：（文本版即可，如 `ts+nonce+body → sort → canonical → HMAC(key) → base64 → X-Sign`）"
  ].join("\n");
}

// 难点与对抗：保护清单 / 每个卡点的突破手法+验证 / 残余风险。
// 真源优先 narrative.md「## 难点与对抗」，回退 retrospectives（卡哪→怎么破），再无则告警。
function renderDifficultyBody(taskDir, routeState) {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const lines = readNarrativeSection(taskDir, headingAliases.difficulty);
  if (lines.length > 0) {
    return lines.map((line) => `- ${line}`).join("\n");
  }
  const retros = (routeState?.retrospectives || []).filter((retro) => clean(retro.summary));
  if (retros.length > 0) {
    return [
      "> 以下卡点/突破由 retrospectives 自动派生；保护清单与残余风险请在 `state/narrative.md`「## 难点与对抗」补全。",
      ...retros.map((retro) => {
        const why = clean(retro.failedBecause) ? `卡点：${clean(retro.failedBecause)}；` : "";
        const decision = clean(retro.decision) ? `突破/决策：${clean(retro.decision)}` : clean(retro.summary);
        return `- ${why}${decision}`;
      })
    ].join("\n");
  }
  return [
    "> ⚠ 未沉淀难点与对抗（`state/narrative.md`「## 难点与对抗」为空，无 retrospective 可派生）。",
    "> 本段要求复盘「卡哪 → 怎么破 → 对抗什么」，按下列骨架写清并删除本告警：",
    "- 保护清单：（反调试 / anti-tamper / 补环境 drift / 复合保护层 等命中项）",
    "- 每个卡点的突破手法 + 验证：（卡点 → 突破方法 → 如何验证已突破）",
    "- 残余风险：（仍未对抗 / 仅部分绕过 / 可能失效的点）"
  ].join("\n");
}

// 调用示例：自包含——依赖+安装命令、完整运行命令、样例输入、预期输出片段、API 任务的完整请求/响应。
// 复用 renderLocalReproBody 的真源（deliveryRequirements + pure-* + example），缺关键项时给告警。
function renderCallExampleBody(taskDir, task) {
  const delivery = task.deliveryRequirements || {};
  const pureArtifact = findPureArtifact(taskDir);
  const example = relIfExists(taskDir, "run/local-repro-example.js");
  const apiExample = relIfExists(taskDir, "run/web-replay.js");
  const runCommand =
    cleanLocalReproValue(delivery.runCommand) ||
    (example ? `node ${example}` : pureArtifact ? `node ${pureArtifact}` : "");
  const sampleInput = cleanLocalReproValue(delivery.sampleInput);
  const outputSummary =
    cleanLocalReproValue(delivery.outputSummary) ||
    cleanLocalReproValue(task.acceptanceModel?.acceptancePath);
  // 叙事真源里若手写了完整安装/依赖/请求响应说明，附加在结构化字段之后。
  const narrative = readNarrativeSection(taskDir, headingAliases.callExample);

  const lines = [];
  if (!runCommand && !sampleInput && !outputSummary && !pureArtifact && narrative.length === 0) {
    return [
      "> ⚠ 未沉淀调用示例（无 `run/pure-*`、无 `run/local-repro-example.js`、deliveryRequirements 也无运行命令）。",
      "> 若已还原算法或 run/ 下有可执行成品脚本，本段强制非空且自包含；请补全并删除本告警：",
      "- 依赖与安装命令：（如 `pip install pycryptodome` / `npm i`）",
      "- 完整运行命令：（如 `node run/local-repro-example.js`）",
      "- 样例输入：（脱敏）",
      "- 预期输出片段：（脱敏）",
      "- API 任务：完整请求（method/url/headers/body）与响应样本片段"
    ].join("\n");
  }
  lines.push(`- 成品脚本: ${pureArtifact || "（无 pure-* 实现）"}`);
  lines.push(`- 依赖与安装命令: ${cleanLocalReproValue(delivery.installCommand) || "（待补：如 pip install / npm i）"}`);
  lines.push(`- 完整运行命令: ${runCommand || "⚠ 待补：run/ 下有成品脚本时此项必填"}`);
  lines.push(`- 样例输入: ${sampleInput || "⚠ 待补（脱敏）"}`);
  lines.push(`- 预期输出片段: ${outputSummary || "⚠ 待补（脱敏）"}`);
  lines.push(`- API 调用示例: ${delivery.apiCallExampleRequired === true ? (apiExample || "⚠ 待补 run/web-replay.js 的请求/响应样例") : "（非 API 任务，可省）"}`);
  for (const extra of narrative) {
    lines.push(`- ${extra}`);
  }
  return lines.join("\n");
}

export function autoFixCloseoutArtifacts(taskDir, task) {
  ensureReportExists(taskDir);
  const routeState = readRouteStateDocument(taskDir, task);

  if (routeState) {
    syncMarkdownViews(taskDir, task, routeState);
    applyRouteStateToTask(task, routeState);
    writeTaskJson(taskDir, task);
  }

  const reportPath = taskFile(taskDir, "report.md");
  let report = taskFileMatchesTemplate(taskDir, "report.md")
    ? "# 逆向报告\n"
    : fs.readFileSync(reportPath, "utf8");
  const execution = routeState?.execution || {};
  const nextAction = execution.nextExecutableAction || "";

  report = upsertMarkdownSection(
    report,
    headingAliases.summary,
    "## 任务摘要",
    renderTaskSummaryBody(task, routeState, taskDir)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.current,
    "## 当前阶段",
    [`- 当前阶段：\`${task.phase}\``, `- 活跃切入点：${routeState?.activeEntrypoints?.join(", ") || ""}`].join("\n")
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.contract,
    "## 任务契约",
    renderTaskContractBody(task)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.execution,
    "## 自动续跑决策",
    [
      `- 执行状态：\`${execution.status || task.routeState.executionStatus || "not-evaluated"}\``,
      `- 暂停类别: ${execution.pauseCategory || task.routeState.pauseCategory || "none"}`,
      `- 暂停原因: ${execution.pauseReason || task.routeState.pauseReason || ""}`,
      `- 下一可执行动作：\`${nextAction}\``
    ].join("\n")
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.executionModel,
    "## 执行状态机",
    renderExecutionModelBody(task, routeState)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.acceptance,
    "## 验收闭环",
    renderAcceptanceBody(task)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.clues,
    "## 关键线索",
    renderCluesBody(routeState)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.next,
    "## 下一步",
    `- ${nextAction}`
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.artifacts,
    "## 产物路径",
    renderArtifactsBody(taskDir, task)
  );

  report = upsertMarkdownSection(
    report,
    headingAliases.entrypoint,
    "## 切入点循环",
    renderEntrypointLoopBody(routeState)
  );

  // 报告详实度四段：无条件 upsert（解绑 localReproductionRequested 门控）。
  // 为空时各自渲染告警 bullet，绝不留死段；这是 focus 缺口（过程/算法/难点/调用示例）的落地点。
  report = upsertMarkdownSection(
    report,
    headingAliases.reverseProcess,
    "## 逆向分析过程",
    renderReverseProcessBody(taskDir, routeState)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.algorithm,
    "## 主要算法说明",
    renderAlgorithmBody(taskDir)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.difficulty,
    "## 难点与对抗",
    renderDifficultyBody(taskDir, routeState)
  );
  report = upsertMarkdownSection(
    report,
    headingAliases.callExample,
    "## 调用示例",
    renderCallExampleBody(taskDir, task)
  );

  if (task.deliveryRequirements?.localReproductionRequested === true) {
    report = upsertMarkdownSection(
      report,
      headingAliases.localRepro,
      "## 本地复现交付",
      renderLocalReproBody(taskDir, task)
    );
  }

  fs.writeFileSync(reportPath, report);
}

function printValidationWarnings(prefix, warnings) {
  for (const warning of warnings || []) {
    console.warn(`${prefix}: WARNING - ${warning}`);
  }
}

async function main() {
  const taskRef = process.argv[2];
  if (!taskRef) {
    console.error("usage: node tools/task/task-close.mjs <task-id|task-path>");
    process.exit(1);
  }

  const taskDir = resolveTaskDir(taskRef);
  const rawTaskFindings = collectRawTaskShapeFindings(readRawTaskJson(taskDir));
  if (rawTaskFindings.length > 0) {
    console.error(`task-close: raw task.json shape is invalid for ${relFromRepo(taskDir)}`);
    for (const finding of rawTaskFindings) {
      console.error(`- ${finding}`);
    }
    process.exit(2);
  }
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  ensureTaskScaffold(taskDir, task);
  ensureTaskWorkspaceBridges(taskDir, task);
  writeTaskJson(taskDir, task);
  const taskSkillRoot = path.resolve(task.roots?.skillRoot || skillRoot);
  const taskWorkspaceRoot = path.resolve(task.roots?.workspaceRoot || workspaceRoot);
   
  const childEnv = {
    ...process.env,
    WEB_REVERSE_SKILL_ROOT: taskSkillRoot,
    WEB_REVERSE_WORKSPACE_ROOT: taskWorkspaceRoot
  };
  process.env.WEB_REVERSE_SKILL_ROOT = taskSkillRoot;
  process.env.WEB_REVERSE_WORKSPACE_ROOT = taskWorkspaceRoot;

  // 红线2 收尾自愈：把散落 workspace 根目录的本任务产物搬进 run/（不静默删，保住逆向成果），
  // 在 validation/closeout 散落门禁之前执行，使「先违规、close 时自动归位」成为可收尾路径。
  // 优先用 task.roots?.workspaceRoot（已记录在 task.json 的可靠路径），避免路径推导在非标准 workspace 下出错。
  const relocated = relocateStrayWorkspaceArtifacts(taskDir, task.roots?.workspaceRoot);
  for (const move of relocated) {
    console.log(`[relocate] ${move.from} -> ${move.to}`);
  }

  autoFixCloseoutArtifacts(taskDir, task);

  const validationModule = await import(
    pathToFileURL(path.join(taskSkillRoot, "tools", "task", "validation.mjs")).href
  );
  const {
    evaluateCloseoutGate,
    persistValidation,
    runFormalValidation
  } = validationModule;

  const validationResult = runFormalValidation(taskDir);
  persistValidation(taskDir, validationResult);
  printValidationWarnings("verify-once", validationResult.warnings);
  if (!validationResult.ok) {
    console.error("verify-once: FAILED");
    for (const finding of validationResult.errors || validationResult.findings || []) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
  }
  console.log("verify-once: passed");

  const gate = evaluateCloseoutGate(taskDir);
  printValidationWarnings("closeout", gate.warnings);
  if (!gate.ok) {
    console.error("closeout: FAILED");
    for (const finding of gate.errors || gate.findings || []) {
      console.error(`- ${finding}`);
    }
    process.exit(1);
  }

  

  const updatedTask = ensureTaskRuntimeShape(readTaskJson(taskDir));
synchronizeCloseoutState(taskDir, updatedTask);

  const removed = cleanupTaskArtifacts(taskDir);
  for (const relPath of removed) {
    console.log(`[cleanup] removed ${relPath}`);
  }

  console.log(`task-close: completed ${relFromRepo(taskDir)}`);
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  await main();
}
