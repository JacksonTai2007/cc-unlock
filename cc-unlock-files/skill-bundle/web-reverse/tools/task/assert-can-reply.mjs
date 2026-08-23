import { spawnSync } from "node:child_process";
import {
  collectEvidenceCommercialSignals,
  collectRawTaskShapeFindings,
  deriveTaskMode,
  deriveTopicFocus,
  ensureTaskRuntimeShape,
  readRawTaskJson,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  taskFile
} from "./common.mjs";
import {
  normalizeRouteStateDocument,
  readRouteStateDocument,
  resolveExecutionState
} from "./route-state.mjs";
import { evaluateStateFreshness } from "./check-state-freshness.mjs";

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) {
    console.error("usage: node tools/task/assert-can-reply.mjs <task-id|task-path> [--require-validated-deliverable] [--json]");
    process.exit(1);
  }

  return {
    taskRef,
    json: args.includes("--json"),
    requireValidatedDeliverable: args.includes("--require-validated-deliverable")
  };
}

function main() {
  const { taskRef, json, requireValidatedDeliverable } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);
  const rawTaskFindings = collectRawTaskShapeFindings(readRawTaskJson(taskDir));
  if (rawTaskFindings.length > 0) {
    console.error(`assert-can-reply: BLOCKED ${relFromRepo(taskDir)}`);
    for (const finding of rawTaskFindings) {
      console.error(`rawTaskFailure=${finding}`);
    }
    console.error("rule=fix-raw-task-json-before-reply");
    process.exit(2);
  }
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  let routeState = readRouteStateDocument(taskDir, task);

  if (!routeState) {
    console.error("assert-can-reply: route-state.json is missing or unreadable; run task-sync first");
    process.exit(1);
  }

  routeState = normalizeRouteStateDocument(routeState, task);
  const execution = resolveExecutionState(task, routeState);
  const blockingStatuses = new Set([
    "ready-to-continue",
    "needs-route-rebuild",
    "needs-retrospective"
  ]);
  const nonUserBlockingPause =
    execution.pauseCategory !== "user" &&
    execution.pauseCategory !== "risk";
  const freshness = evaluateStateFreshness(taskDir, task);
  let blocked =
    blockingStatuses.has(execution.status) &&
    nonUserBlockingPause &&
    execution.discipline?.mustExecuteNow === true;
  let validationFailure = "";
  let deliveryStateFailure = "";
  let staleReason = "";
  let contractFailure = "";
  let searchFailure = "";

  // === Quality Gate: Contract Health ===
  // 仅对「非协作/非风险」回复施加契约健康与搜索就绪门禁。
  // pauseCategory=user/risk 时回复是为了请求协作或确认风险（如登录、补样本），
  // 此时不应因 completionCriteria 等契约字段未填而阻断——契约完整性属于「完成声明」
  // 的门禁（由 --require-validated-deliverable 与 acceptance 检查负责），不属于协作请求。
  if (!blocked && nonUserBlockingPause) {
    const healthFailures = [];
    const criteria = task.taskContract?.completionCriteria || [];
    const intermediateStates = task.taskContract?.intermediateStatesNotDelivery || [];
    const acceptanceGapDefined = task.acceptanceModel?.acceptanceGapDefined === true;
    const claimLevel = task.acceptanceModel?.claimLevel || "provisional";
    const VALID_CLAIM_LEVELS = ["provisional", "route-ready", "acceptance-ready", "delivered"];

    if (!Array.isArray(criteria) || criteria.length === 0) {
      healthFailures.push("completionCriteria 为空");
    } else {
      const weakPatterns = [/^done$/i, /^完成$/i, /^ok$/i, /^success$/i, /^通过$/i, /^pass$/i];
      const weakEntries = criteria.filter((c) => {
        const s = String(c || "").trim();
        return s.length < 10 || weakPatterns.some((p) => p.test(s));
      });
      if (weakEntries.length > 0) {
        healthFailures.push(`completionCriteria 中存在 ${weakEntries.length} 条模糊/过短条目: [${weakEntries.join(", ")}]`);
      }
    }
    if (!Array.isArray(intermediateStates) || intermediateStates.length === 0) {
      healthFailures.push("intermediateStatesNotDelivery 为空");
    }
    const claimLevelIdx = VALID_CLAIM_LEVELS.indexOf(claimLevel);
    if (claimLevelIdx >= VALID_CLAIM_LEVELS.indexOf("acceptance-ready") && !acceptanceGapDefined) {
      healthFailures.push(`claimLevel="${claimLevel}" 但 acceptanceGapDefined=false`);
    }
    // Check escalation path validity
    if (claimLevelIdx >= 0) {
      const history = task.acceptanceModel?.claimLevelHistory || [];
      if (Array.isArray(history) && history.length > 0) {
        const lastEntry = history[history.length - 1];
        const lastLevel = lastEntry?.to || "provisional";
        const lastIdx = VALID_CLAIM_LEVELS.indexOf(lastLevel);
        if (lastIdx >= 0 && claimLevelIdx - lastIdx > 1) {
          healthFailures.push(`claimLevel 从 "${lastLevel}" 越级跳到 "${claimLevel}"；必须逐级升级`);
        }
        if (lastIdx >= 0 && claimLevelIdx < lastIdx) {
          healthFailures.push(`claimLevel 从 "${lastLevel}" 降级到 "${claimLevel}" 但缺少降级原因记录`);
        }
      } else if (claimLevelIdx > 0) {
        healthFailures.push(`claimLevel="${claimLevel}" 但 claimLevelHistory 为空；无法验证升级路径`);
      }
    }

    if (healthFailures.length > 0) {
      blocked = true;
      contractFailure = `契约健康检查失败: ${healthFailures.join("; ")}`;
    }
  }

  // === Quality Gate: Search Readiness ===
  if (!blocked && nonUserBlockingPause) {
    const searchFailures = [];
    const roundsConsumed = task.executionModel?.roundsConsumed || 0;
    const progressionRounds = task.executionModel?.progressionRounds || 0;
    // 全局轮次取大者：兼容显式 roundsConsumed，同时让 task-snapshot --round 的自动计数驱动搜索就绪闸。
    const effectiveRounds = Math.max(roundsConsumed, progressionRounds);
    const lastProgressRound = task.executionModel?.lastProgressRound || 0;
    const searchRounds = task.externalRefs?.searchRounds || 0;
    const lastSearchRound = task.externalRefs?.lastSearchRound || 0;
    const triggerSignals = task.externalRefs?.triggerSignals || [];
    const knowledgeGap = task.taskContract?.knowledgeGap === true;
    const roundsSinceProgress = effectiveRounds - lastProgressRound;
    const roundsSinceSearch = effectiveRounds - lastSearchRound;
    const hasCommercialSignals = Array.isArray(triggerSignals) && triggerSignals.some((s) => /wasm|jsvmp|\bvmp\b|commercial|drm|_cn|_ak|_bm|sensor|turnstile|perimeter|akamai|cloudflare/i.test(String(s)));
    // 合规 BL-08 / P1-5：与 check-search-gate 一致，从证据真源机械提取已知 provider 命中，
    // 堵住「不填 triggerSignals 即让搜索门禁永不触发」的会话级绕过。
    const evidenceProviderHits = collectEvidenceCommercialSignals(taskDir, task);
    const hasProviderEvidence = evidenceProviderHits.length > 0;

    const stallThreshold = Math.min(4, Math.max(2, task.executionModel?.roundBudget || 2));
    // 已知商业 provider「首轮即搜」：命中即从第 1 轮起要求搜过一次。
    if (hasProviderEvidence && searchRounds === 0 && effectiveRounds >= 1) {
      searchFailures.push(`命中已知商业保护 provider [${evidenceProviderHits.join(", ")}] 但 searchRounds=0（此类 provider 有现成公开资料，必须首轮即搜）`);
    }
    if (roundsSinceProgress >= 2 && roundsSinceSearch >= 2 && effectiveRounds >= stallThreshold) {
      searchFailures.push(`停滞: ${roundsSinceProgress}轮无进展且${roundsSinceSearch}轮未搜索`);
    }
    if (knowledgeGap && roundsSinceSearch >= 1 && effectiveRounds >= 2) {
      searchFailures.push("knowledgeGap=true 但未搜索");
    }
    if ((hasCommercialSignals || hasProviderEvidence) && searchRounds === 0 && effectiveRounds >= 3) {
      searchFailures.push("检测到商业保护/WASM/JSVMP信号但从未搜索");
    }
    const searchMode = task.externalRefs?.searchMode || "auto";
    if (searchMode === "auto" && searchRounds === 0 && effectiveRounds >= 5) {
      searchFailures.push(`searchMode=auto 但已消耗 ${effectiveRounds} 轮从未执行 websearch`);
    }

    if (searchFailures.length > 0) {
      blocked = true;
      searchFailure = `搜索就绪检查失败: ${searchFailures.join("; ")}`;
    }
  }

  if (!blocked && !freshness.ok) {
    blocked = true;
    staleReason = freshness.findings.join("; ");
  }

  if (!blocked && requireValidatedDeliverable && execution.status !== "completed") {
    blocked = true;
    deliveryStateFailure =
      `execution.status=${execution.status}; final delivery claims require closeout-completed / completed state first`;
  }

  if (!blocked && requireValidatedDeliverable && String(task.acceptanceModel?.claimLevel || "").trim() !== "delivered") {
    blocked = true;
    contractFailure = `acceptanceModel.claimLevel=${task.acceptanceModel?.claimLevel || "(empty)"}; final delivery claims require claimLevel=delivered`;
  }

  if (!blocked && requireValidatedDeliverable && String(task.acceptanceModel?.acceptanceGap || "").trim()) {
    blocked = true;
    contractFailure = `acceptanceModel.acceptanceGap=${task.acceptanceModel.acceptanceGap}; final delivery claims require an empty acceptanceGap`;
  }

  if (!blocked && requireValidatedDeliverable && (task.acceptanceModel?.completionBlockedBy || []).length > 0) {
    blocked = true;
    contractFailure = `acceptanceModel.completionBlockedBy=${task.acceptanceModel.completionBlockedBy.join(" | ")}; final delivery claims require no outstanding completion blockers`;
  }

  // 控制字段占位门禁（架P0#2b）：宣称交付前，taskMode / primaryTopic 不得仍是 pending-* / 空，
  // 否则 report.md 是空壳——拦下「只跑 snapshot、控制字段停在 pending-* 就报完成」。
  if (!blocked && requireValidatedDeliverable) {
    const isPlaceholder = (value) => {
      const normalized = String(value || "").trim().toLowerCase();
      return !normalized || /^pending[-_]/.test(normalized) || normalized === "replace-me" || normalized === "tbd" || normalized === "todo";
    };
    const claimTaskMode = deriveTaskMode(task);
    const { primaryTopic: claimPrimaryTopic } = deriveTopicFocus(task);
    if (isPlaceholder(claimTaskMode)) {
      blocked = true;
      contractFailure = `taskMode=${claimTaskMode || "(empty)"}; final delivery claims require a concrete taskMode (not pending-*)`;
    } else if (isPlaceholder(claimPrimaryTopic)) {
      blocked = true;
      contractFailure = `primaryTopic=${claimPrimaryTopic || "(empty)"}; final delivery claims require a concrete primaryTopic (not pending-*)`;
    }
  }

  if (!blocked && requireValidatedDeliverable) {
    const verifyScript = taskFile(taskDir, "run/verify-once.mjs");
    const verify = spawnSync(process.execPath, [verifyScript, "--validate-only"], {
      cwd: taskDir,
      encoding: "utf8",
      timeout: 120000
    });
    if (verify.error) {
      blocked = true;
      validationFailure = `verify-once execution failed: ${verify.error.message}`;
    } else if (verify.status !== 0) {
      blocked = true;
      validationFailure = String(verify.stderr || verify.stdout || "verify-once --validate-only failed").trim();
    }
  }

  const payload = {
    task: relFromRepo(taskDir),
    phase: routeState.phase,
    canReply: !blocked,
    execution,
    requireValidatedDeliverable,
    validationFailure,
    deliveryStateFailure,
    contractFailure,
    searchFailure,
    staleReason
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else if (blocked) {
    console.error(`assert-can-reply: BLOCKED ${payload.task}`);
    console.error(`phase=${payload.phase}`);
    console.error(`execution.status=${execution.status}`);
    console.error(`execution.pauseCategory=${execution.pauseCategory}`);
    console.error(`execution.nextEntrypointId=${execution.nextEntrypointId || "(none)"}`);
    console.error(`execution.nextExecutableAction=${execution.nextExecutableAction || "(none)"}`);
    console.error(`execution.discipline.artifactTruthRoot=${execution.discipline?.artifactTruthRoot || "(none)"}`);
    if (staleReason) {
      console.error(`staleReason=${staleReason}`);
      console.error("rule=run-task-sync-before-reply");
    }
    if (contractFailure) {
      console.error(`contractFailure=${contractFailure}`);
      console.error("rule=contract-must-be-healthy-before-reply-or-delivery-claim");
    }
    if (searchFailure) {
      console.error(`searchFailure=${searchFailure}`);
      console.error("rule=search-gate-must-pass-before-reply");
    }
    if (validationFailure) {
      console.error(`validationFailure=${validationFailure}`);
      console.error("rule=final-summary-requires-verify-once-validate-only");
    }
    if (deliveryStateFailure) {
      console.error(`deliveryStateFailure=${deliveryStateFailure}`);
      console.error("rule=validated-deliverable-requires-completed-execution");
      console.error("rule=clear-user-pause-or-closeout-before-delivery-claim");
    }
    console.error("rule=do-not-send-user-visible-reply");
    console.error("rule=do-not-write-if-you-agree-i-will-continue");
    console.error("rule=execute-nextExecutableAction-first");
  } else {
    console.log(`assert-can-reply: OK ${payload.task}`);
    console.log(`phase=${payload.phase}`);
    console.log(`execution.status=${execution.status}`);
    console.log(`execution.pauseCategory=${execution.pauseCategory}`);
    console.log(`execution.nextExecutableAction=${execution.nextExecutableAction || "(none)"}`);
    if (requireValidatedDeliverable) {
      console.log("validation.status=passed");
    }
  }

  if (blocked) {
    process.exit(2);
  }
}

main();
