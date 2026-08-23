import fs from "node:fs";
import {
  collectEvidenceCommercialSignals,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  taskFile
} from "./common.mjs";

// 合规 BL-08「落盘」校验：判定一次声明的搜索是否留下了真实研究痕迹，
// 而非只把 searchRounds 计数 +1。要求 external-research.md 存在且有实质行，
// 或 externalRefs 里有 matchedRefs / resultDigest 落盘。
function searchResultLanded(taskDir, task) {
  const matched = Array.isArray(task.externalRefs?.matchedRefs) ? task.externalRefs.matchedRefs.length : 0;
  const digest = Array.isArray(task.externalRefs?.resultDigest) ? task.externalRefs.resultDigest.length : 0;
  if (matched > 0 || digest > 0) {
    return true;
  }
  try {
    const filePath = taskFile(taskDir, "state/external-research.md");
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const text = fs.readFileSync(filePath, "utf8");
      // 至少有一条非标题、非空的实质行（不是仅脚手架）。
      return text.split(/\r?\n/).some((line) => /^[-*]\s+\S/.test(line.trim()) && !/状态:|搜索轮次:/.test(line));
    }
  } catch {
    // ignore
  }
  return false;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) {
    console.error("usage: node tools/task/check-search-gate.mjs <task-id|task-path> [--json]");
    process.exit(1);
  }

  return {
    taskRef,
    json: args.includes("--json")
  };
}

function hasCommercialSignals(triggerSignals) {
  if (!Array.isArray(triggerSignals)) return false;
  const highSignalPatterns = [/wasm/i, /jsvmp/i, /\bvmp\b/i, /commercial/i, /drm/i, /_cn/i, /_ak/i, /_bm/i, /sensor/i, /turnstile/i, /perimeter/i, /akamai/i, /cloudflare/i];
  return triggerSignals.some((signal) =>
    highSignalPatterns.some((pattern) => pattern.test(String(signal)))
  );
}

function main() {
  const { taskRef, json } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);
  const task = readTaskJson(taskDir);

  const failures = [];

  const roundsConsumed = task.executionModel?.roundsConsumed || 0;
  const progressionRounds = task.executionModel?.progressionRounds || 0;
  // 全局轮次 = 显式 roundsConsumed 与自动 progressionRounds 取大者；
  // 向后兼容显式管理 roundsConsumed 的任务，同时让 task-snapshot --round 的自动计数也能驱动本闸。
  const effectiveRounds = Math.max(roundsConsumed, progressionRounds);
  const lastProgressRound = task.executionModel?.lastProgressRound || 0;
  const searchRounds = task.externalRefs?.searchRounds || 0;
  const lastSearchRound = task.externalRefs?.lastSearchRound || 0;
  const triggerSignals = task.externalRefs?.triggerSignals || [];
  const knowledgeGap = task.taskContract?.knowledgeGap === true;

  const roundsSinceProgress = effectiveRounds - lastProgressRound;
  const roundsSinceSearch = effectiveRounds - lastSearchRound;

  // 合规 BL-08 / P1-5：从证据真源（objective / clues.md / external-research / protectionHints）机械提取
  // 已知商业 provider 命中，不依赖 agent 主动填 triggerSignals——堵住「不填信号即绕过」的会话级事故。
  const evidenceProviderHits = collectEvidenceCommercialSignals(taskDir, task);
  const hasProviderEvidence = evidenceProviderHits.length > 0;

  // 0. 已知商业保护 provider「首轮即搜」（P1-5）：命中易盾/瑞数/数美/akamai 等公开资料高频 provider，
  //    从第 1 轮起就必须搜过一次——不再等「连续两轮无进展」。这些 provider 有大量现成公开逆向资料，
  //    零搜索硬啃是会话级事故的直接成因。
  if (hasProviderEvidence && searchRounds === 0 && effectiveRounds >= 1) {
    failures.push({
      check: "known-provider-must-search-first-round",
      message: `证据命中已知商业保护 provider [${evidenceProviderHits.join(", ")}] 但 searchRounds=0；此类 provider 有现成公开资料，必须首轮即搜`,
      fix: "针对命中的 provider 名 + host + 错误码/字段名执行一轮 websearch（GitHub→全网两级），结果写入 state/external-research.md/json 并更新 externalRefs.lastSearchRound/searchRounds"
    });
  }

  // 0b. 落盘校验（BL-08）：声明搜过（searchRounds>0）但 external-research 既无 matchedRefs/resultDigest
  //    又无实质 md 内容 = 假搜索/计数注水。命中即 BLOCK。
  if (searchRounds > 0 && !searchResultLanded(taskDir, task)) {
    failures.push({
      check: "search-claimed-without-landed-research",
      message: `externalRefs.searchRounds=${searchRounds} 但未发现落盘的搜索结果（state/external-research.md 无实质内容，且 matchedRefs/resultDigest 均为空）`,
      fix: "把本轮搜索的命中参考写入 externalRefs.matchedRefs/resultDigest 并由 task-sync 渲染到 state/external-research.md/json；只把 searchRounds+1 不算搜过"
    });
  }

  // 1. 连续 2+ 轮无进展 且 连续 2+ 轮未搜索
  const stallThreshold = Math.min(4, Math.max(2, task.executionModel?.roundBudget || 2));
  if (roundsSinceProgress >= 2 && roundsSinceSearch >= 2 && effectiveRounds >= stallThreshold) {
    failures.push({
      check: "stalled-without-search",
      message: `连续 ${roundsSinceProgress} 轮未逼近验收且连续 ${roundsSinceSearch} 轮未执行 websearch`,
      fix: "执行至少一轮结构化 websearch，将结果写入 externalRefs 和 state/external-research.md，然后更新 lastSearchRound"
    });
  }

  // 2. knowledgeGap=true 且 1+ 轮未搜索
  if (knowledgeGap && roundsSinceSearch >= 1 && effectiveRounds >= 2) {
    failures.push({
      check: "knowledgeGap-without-search",
      message: `knowledgeGap=true 且已过 ${roundsSinceSearch} 轮未执行 websearch`,
      fix: "本地经验未命中必须通过 websearch 补充；执行搜索后将结果写入 state/external-research.md/json，然后更新 lastSearchRound"
    });
  }

  // 3. 检测到商业保护/WASM/JSVMP 信号但从未搜索（triggerSignals 或证据真源命中均触发）
  const triggerCommercialHits = triggerSignals.filter((s) => /wasm|jsvmp|\bvmp\b|commercial|drm|_cn|_ak|_bm|sensor|turnstile|perimeter|akamai|cloudflare/i.test(String(s)));
  if ((hasCommercialSignals(triggerSignals) || hasProviderEvidence) && searchRounds === 0 && effectiveRounds >= 3) {
    failures.push({
      check: "commercial-signals-without-search",
      message: `检测到高信号 [${[...triggerCommercialHits, ...evidenceProviderHits].join(", ") || "(evidence)"}] 但从未执行 websearch (searchRounds=0)`,
      fix: "商业保护/WASM/JSVMP 信号必须在进入深挖前通过 websearch 确认 provider/family/protocol；执行搜索并更新 externalRefs"
    });
  }

  // 4. searchMode=auto 但从未搜索且已消耗 5+ 轮
  const searchMode = task.externalRefs?.searchMode || "auto";
  if (searchMode === "auto" && searchRounds === 0 && effectiveRounds >= 5) {
    failures.push({
      check: "auto-search-never-executed",
      message: `searchMode=auto 但已消耗 ${effectiveRounds} 轮从未执行 websearch`,
      fix: "auto 模式下消耗 5+ 轮仍未搜索属异常；至少执行一轮轻量搜索确认 provider/family 方向"
    });
  }

  const ok = failures.length === 0;

  if (json) {
    console.log(JSON.stringify({
      ok,
      failures,
      metrics: { roundsConsumed, progressionRounds, effectiveRounds, roundsSinceProgress, roundsSinceSearch, searchRounds, lastSearchRound, knowledgeGap }
    }, null, 2));
  } else if (!ok) {
    console.error(`check-search-gate: BLOCKED ${relFromRepo(taskDir)}`);
    console.error(`effectiveRounds=${effectiveRounds} (roundsConsumed=${roundsConsumed} progressionRounds=${progressionRounds}) roundsSinceProgress=${roundsSinceProgress} roundsSinceSearch=${roundsSinceSearch} searchRounds=${searchRounds}`);
    for (const f of failures) {
      console.error(`[${f.check}] ${f.message}`);
      console.error(`  fix: ${f.fix}`);
    }
    console.error("rule=search-gate-must-pass-before-continue");
    console.error("rule=do-not-continue-local-probing-without-external-search");
  } else {
    console.log(`check-search-gate: OK ${relFromRepo(taskDir)}`);
    console.log(`effectiveRounds=${effectiveRounds} (roundsConsumed=${roundsConsumed} progressionRounds=${progressionRounds}) roundsSinceProgress=${roundsSinceProgress} roundsSinceSearch=${roundsSinceSearch} searchRounds=${searchRounds}`);
  }

  if (!ok) {
    process.exit(2);
  }
}

main();
