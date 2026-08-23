import fs from "node:fs";
import path from "node:path";
import {
  collectRawTaskShapeFindings,
  collectStrayWorkspaceArtifacts,
  deriveTaskMode,
  deriveTopicFocus,
  ensureTaskRuntimeShape,
  ensureTaskScaffold,
  ensureTaskWorkspaceBridges,
  exists,
  readRawTaskJson,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  skillRoot,
  taskFile,
  workspaceRoot,
  writeTaskJson
} from "./common.mjs";
import { parseCluesMarkdown } from "./route-state.mjs";
import { autoFixCloseoutArtifacts } from "./task-close.mjs";
import {
  collectPureFiles,
  collectSolverArtifacts,
  extractReportSectionBody,
  reportSectionIsFilled
} from "./validation.mjs";
import crypto from "node:crypto";

// 数当前 clues.md 里的有效线索条数（只统计 `- [置信度] …` 形式，记录规则段的说明 bullet 不计入）。
function countClues(taskDir, task) {
  const cluesFile = taskFile(taskDir, task.routeState?.cluesPath || "state/clues.md");
  if (!exists(cluesFile)) {
    return 0;
  }
  try {
    return parseCluesMarkdown(fs.readFileSync(cluesFile, "utf8")).length;
  } catch {
    return 0;
  }
}

// 从 state/external-research.json 真源推导「搜索活动量」。
// 不依赖模型回写任何计数字段：只要它把搜索结果真落进 external-research.json（queries/results/resultDigest），
// 这里就能感知。取多个字段的最大值，兼容「只填 searchRounds」「只 append queries」「只写 results」等写法。
function countSearchSignal(taskDir, task) {
  const file = taskFile(taskDir, task.routeState?.externalResearchJsonPath || "state/external-research.json");
  if (!exists(file)) {
    return 0;
  }
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    const arrLen = (v) => (Array.isArray(v) ? v.length : 0);
    return Math.max(
      Math.max(0, Number(doc.searchRounds) || 0),
      arrLen(doc.queries),
      arrLen(doc.results),
      arrLen(doc.resultDigest)
    );
  } catch {
    return 0;
  }
}

// 合规 P1-3：端到端是否仍为失败（验收未推进）。判据全从真源字段推导，不要求模型额外回写：
//   - claimLevel 仍低于 acceptance-ready（即 provisional/route-ready），尚未拿到贴近验收的直接证据；且
//   - acceptanceGap 非空 或 completionBlockedBy 非空（仍有未闭合的验收缺口）。
// 二者同时成立 = 端到端结果仍为失败/未通过（如图像识别路线通过率仍为 0）。
function endToEndStillFailing(task) {
  const acceptance = task.acceptanceModel || {};
  const claimLevel = String(acceptance.claimLevel || "provisional").trim().toLowerCase();
  // acceptance-ready / delivered 视为已逼近或达成验收，不算「仍为失败」。
  if (claimLevel === "acceptance-ready" || claimLevel === "delivered") {
    return false;
  }
  const nonEmpty = (v) => String(v || "").trim().length > 0;
  return nonEmpty(acceptance.acceptanceGap) || nonEmpty(acceptance.completionBlockedBy);
}

// 合规 P1-3：对 run/ 下成品脚本（pure-* 与求解器候选）算一个内容指纹。
// 用于区分「同一失败的新变体」——脚本内容变了但端到端仍失败时，不应计入有效推进。
function computeSolverSignature(taskDir) {
  let candidates = [];
  try {
    candidates = candidates.concat(collectPureFiles(taskDir));
  } catch {
    // ignore
  }
  try {
    candidates = candidates.concat(collectSolverArtifacts(taskDir).map((item) => item.rel));
  } catch {
    // ignore
  }
  const rels = Array.from(new Set(candidates)).sort();
  if (rels.length === 0) {
    return "";
  }
  const hash = crypto.createHash("sha1");
  for (const rel of rels) {
    try {
      hash.update(rel);
      hash.update("\0");
      hash.update(fs.readFileSync(taskFile(taskDir, rel)));
      hash.update("\0");
    } catch {
      // 文件读不到就跳过，不影响其余文件参与签名。
    }
  }
  return hash.digest("hex");
}

// --round：把本次快照当作一个「回复轮边界」，推进全局 progressionRounds，并按真源文件判定本轮是否有效推进：
//   - clues.md 新增线索  → 推进 lastProgressRound（逼近停损解除）
//   - external-research.json 新增搜索 → 推进 lastSearchRound + 同步 searchRounds（解除搜索闸）
// 全部从真源文件推导，不要求模型额外回写计数——这是 FM3 停损遥测唯一的自动驱动点，纯 CLI、harness 无关。
function advanceProgressionRound(taskDir, task) {
  const model = task.executionModel;
  model.progressionRounds = Math.max(0, Number(model.progressionRounds) || 0) + 1;
  // 与停滞/搜索闸同尺度：闸用 effectiveRounds=max(roundsConsumed, progressionRounds)，
  // 故 lastProgressRound 也按 effectiveRounds 记，避免「任务混用显式 roundsConsumed + 自动轮次」时尺度错配导致虚报停滞。
  const effectiveRounds = Math.max(Number(model.roundsConsumed) || 0, model.progressionRounds);

  const clueCount = countClues(taskDir, task);
  const clueBaseline = Math.max(0, Number(model.progressClueBaseline) || 0);
  const clueGrew = clueCount > clueBaseline;

  // 合规 P1-3：区分「新线索」与「同一失败的新变体」。
  // 反失效模式：图像识别等路线连续多轮 0 通过，却因每轮换算法/参数、产出新脚本+新数字
  // 而被误判有进展（progressionRounds 持续 ++，停损不触发）。规则：本轮成品脚本内容变了，
  // 但端到端结果仍为失败（claimLevel 未达 acceptance-ready 且 acceptanceGap/completionBlockedBy 非空），
  // 则这次脚本变更属于「同一失败的新变体」，单凭它（及随附记下的失败说明 bullet）不算有效推进。
  const solverSignature = computeSolverSignature(taskDir);
  const solverBaseline = String(model.solverSignatureBaseline || "");
  const solverChanged = solverSignature !== "" && solverSignature !== solverBaseline;
  const sameFailureVariant = solverChanged && endToEndStillFailing(task);

  // 有效推进 = 线索增长，且不是「仅靠同一失败的新变体撑起来的增长」。
  const madeProgress = clueGrew && !sameFailureVariant;
  if (madeProgress) {
    model.lastProgressRound = effectiveRounds;
  }
  model.progressClueBaseline = clueCount;
  model.solverSignatureBaseline = solverSignature;

  // 搜索信号同样真源驱动：external-research.json 自上次快照有新增 → 本轮搜索过。
  task.externalRefs ||= {};
  const searchCount = countSearchSignal(taskDir, task);
  const searchBaseline = Math.max(0, Number(model.searchProgressBaseline) || 0);
  const didSearch = searchCount > searchBaseline;
  if (didSearch) {
    task.externalRefs.lastSearchRound = effectiveRounds;
  }
  model.searchProgressBaseline = searchCount;
  // 把真源推导出的搜索量同步进 task.json 缓存，供 assert-can-reply / check-search-gate 读取。
  task.externalRefs.searchRounds = Math.max(Number(task.externalRefs.searchRounds) || 0, searchCount);

  const sinceProgress = effectiveRounds - (Number(model.lastProgressRound) || 0);
  const progressLabel = madeProgress
    ? "本轮有新增线索"
    : sameFailureVariant
      ? "本轮仅换了图像识别/求解脚本变体但端到端仍失败——不算有效推进"
      : "本轮无新增线索";
  console.log(
    `task-snapshot: progressionRounds=${model.progressionRounds} ` +
      `(${progressLabel}${didSearch ? "，本轮有新增搜索" : ""}) roundsSinceProgress=${sinceProgress}`
  );
  if (sameFailureVariant) {
    console.log(
      "task-snapshot: ⚠️ 检测到「同一失败的新变体」：成品脚本已变更但端到端通过率仍为 0（验收未推进）。" +
        "按「停损」更换算法/参数而端到端仍失败不算有效推进；应 pivot / retrospective，勿在同一失败路线硬顶。"
    );
  }
  if (!madeProgress && sinceProgress >= 2) {
    console.log(
      `task-snapshot: ⚠️ 连续 ${sinceProgress} 轮无新增线索——按「停损」应 pivot / retrospective / 触发搜索；` +
        "继续同层硬顶不算有效推进。"
    );
  }
}

function isPlaceholderControlValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return /^pending[-_]/.test(normalized) || normalized === "replace-me" || normalized === "tbd" || normalized === "todo";
}

// 四段叙事标题正则（与 validation.mjs 保持一致）。
const snapshotReverseProcessHeading = /^##\s*(?:逆向分析过程|还原链路|Reverse(?:\s+Engineering)?\s+Process)\s*[：:]?\s*$/i;
const snapshotAlgorithmHeading = /^##\s*(?:主要算法说明|算法还原说明|Algorithm(?:\s+Explanation)?)\s*[：:]?\s*$/i;
const snapshotDifficultyHeading = /^##\s*(?:难点与对抗|难点分析|Difficulties?(?:\s+and\s+Countermeasures)?)\s*[：:]?\s*$/i;
const snapshotCallExampleHeading = /^##\s*(?:调用示例|Call Example|Usage Example)\s*[：:]?\s*$/i;

// 非阻断自检（架P0#2a）：snapshot 不跑 verify/closeout 门禁，但要把「report 仍是空壳」
// 的代价显式暴露——控制字段仍为 pending-*/空、或 workspace 根目录有散落产物时，
// stderr 告警 + 在 report.md 顶部写一行醒目横幅，让模型不会误以为 snapshot 等于已交付。
// P1-A1：run/ 下有成品脚本但四段任意一段未填充时，追加告警写入横幅。
function emitSnapshotSelfCheck(taskDir, task) {
  const warnings = [];
  const taskMode = deriveTaskMode(task);
  const { primaryTopic } = deriveTopicFocus(task);
  if (isPlaceholderControlValue(taskMode)) {
    warnings.push(`report.md 控制字段 taskMode 仍为占位（${taskMode || "空"}）——尚未选定主模式，未达可交付。`);
  }
  if (isPlaceholderControlValue(primaryTopic)) {
    warnings.push(`report.md 控制字段 primaryTopic 仍为占位（${primaryTopic || "空"}）——尚未选定主专题，未达可交付。`);
  }

  const workspaceRootDir = task.roots?.workspaceRoot;
  if (workspaceRootDir && path.resolve(workspaceRootDir) !== path.resolve(taskDir)) {
    const { stray } = collectStrayWorkspaceArtifacts(taskDir, workspaceRootDir);
    if (stray.length > 0) {
      const runRel = `artifacts/tasks/${path.basename(taskDir)}/run`;
      warnings.push(
        `workspace 根目录散落 ${stray.length} 个本任务产物（${stray.join(", ")}），违反红线2；` +
          `请移入 ${runRel}/（脚本/样本）或 state/（中间数据），否则 task-close 会被门禁拦下。`
      );
    }
  }

  // P1-A1：run/ 下有成品脚本时，检查四段叙事是否已填充（与 SKILL.md:56 承诺对齐）。
  // 仅 warning，不阻断；task-close 才是硬门禁。
  try {
    const pureFiles = collectPureFiles(taskDir);
    if (pureFiles.length > 0) {
      const reportPath = taskFile(taskDir, "report.md");
      if (exists(reportPath)) {
        const reportText = fs.readFileSync(reportPath, "utf8");
        const narrativeSections = [
          ["逆向分析过程", snapshotReverseProcessHeading],
          ["主要算法说明", snapshotAlgorithmHeading],
          ["难点与对抗", snapshotDifficultyHeading],
          ["调用示例", snapshotCallExampleHeading]
        ];
        const emptyNarrative = narrativeSections
          .filter(([, heading]) => !reportSectionIsFilled(extractReportSectionBody(reportText, heading)))
          .map(([label]) => label);
        if (emptyNarrative.length > 0) {
          warnings.push(
            `run/ 下存在成品脚本（${pureFiles[0]}）但四段叙事中以下小节仍为空壳：${emptyNarrative.join(" / ")}；` +
              `请在 state/narrative.md 对应小节补全，task-close 将按 error 拦下。`
          );
        }
      }
    }
  } catch {
    // 四段检查失败不阻断快照。
  }

  if (warnings.length === 0) {
    return;
  }

  for (const line of warnings) {
    console.warn(`task-snapshot: ⚠ ${line}`);
  }

  // 把告警写进 report.md 顶部横幅（幂等：先移除旧横幅再写新横幅）。
  try {
    const reportPath = taskFile(taskDir, "report.md");
    if (exists(reportPath)) {
      let report = fs.readFileSync(reportPath, "utf8");
      const bannerStart = "<!-- snapshot-selfcheck:begin -->";
      const bannerEnd = "<!-- snapshot-selfcheck:end -->";
      const stripped = report.replace(
        new RegExp(`${bannerStart}[\\s\\S]*?${bannerEnd}\\n?`, "g"),
        ""
      );
      const banner = [
        bannerStart,
        "> ⚠ **此为 task-snapshot 中止快照，非验收交付**。以下项未达交付门槛：",
        ...warnings.map((line) => `> - ${line}`),
        bannerEnd,
        ""
      ].join("\n");
      // 横幅插在首个一级/二级标题之前；无标题则插在文首。
      const headingMatch = stripped.match(/^#.*$/m);
      let next;
      if (headingMatch && typeof headingMatch.index === "number") {
        const insertAt = stripped.indexOf("\n", headingMatch.index);
        const cut = insertAt === -1 ? stripped.length : insertAt + 1;
        next = `${stripped.slice(0, cut)}\n${banner}${stripped.slice(cut)}`;
      } else {
        next = `${banner}\n${stripped}`;
      }
      fs.writeFileSync(reportPath, next);
    }
  } catch {
    // 写横幅失败不阻断快照。
  }
}

// task-snapshot：随时把当前 route-state 渲染进 report.md 的「中止快照」出口。
// 与 task-close 的区别：复用同一套 autoFixCloseoutArtifacts，但【跳过】verify-once /
// closeout 门禁与 cleanup。任何时刻（包括任务尚未验收、被中途打断）都能落盘一份
// 最新总结，避免「任务结束/中止却没有 report.md」的失效模式。
// 设计为 hook 安全：除用法错误外一律 exit 0，绝不阻断模型停止回复。

function main() {
  const argv = process.argv.slice(2);
  const taskRef = argv.find((arg) => !arg.startsWith("--"));
  const advanceRound = argv.includes("--round");
  if (!taskRef) {
    console.error("usage: node tools/task/task-snapshot.mjs <task-id|task-path> [--round]");
    process.exit(1);
  }

  const taskDir = resolveTaskDir(taskRef);
  if (!exists(taskFile(taskDir, "task.json"))) {
    // 无任务可快照（例如尚未 init）——对 Stop hook 而言这是正常情况，静默放行。
    console.log(`task-snapshot: no task.json under ${relFromRepo(taskDir)}; nothing to snapshot.`);
    return;
  }

  const rawFindings = collectRawTaskShapeFindings(readRawTaskJson(taskDir));
  if (rawFindings.length > 0) {
    console.warn(`task-snapshot: task.json shape looks invalid for ${relFromRepo(taskDir)}; skipping snapshot (non-blocking).`);
    for (const finding of rawFindings) {
      console.warn(`- ${finding}`);
    }
    return;
  }

  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  ensureTaskScaffold(taskDir, task);
  ensureTaskWorkspaceBridges(taskDir, task);
  if (advanceRound) {
    advanceProgressionRound(taskDir, task);
  }
  writeTaskJson(taskDir, task);

  const taskSkillRoot = path.resolve(task.roots?.skillRoot || skillRoot);
  const taskWorkspaceRoot = path.resolve(task.roots?.workspaceRoot || workspaceRoot);
  process.env.WEB_REVERSE_SKILL_ROOT = taskSkillRoot;
  process.env.WEB_REVERSE_WORKSPACE_ROOT = taskWorkspaceRoot;

  autoFixCloseoutArtifacts(taskDir, task);
  emitSnapshotSelfCheck(taskDir, task);

  console.log(`task-snapshot: report refreshed (no gate) ${relFromRepo(taskDir, taskDir)}`);
  console.log(`task-snapshot: report=${relFromRepo(taskFile(taskDir, "report.md"), taskDir)}`);
  console.log("task-snapshot: NOTE this is a checkpoint, not an acceptance closeout; run task-close to formally finish.");
}

try {
  main();
} catch (error) {
  // 中止快照不应让 hook 失败；记录到 stderr 后正常退出。
  console.warn(`task-snapshot: skipped due to error (non-blocking): ${error?.message || error}`);
}
