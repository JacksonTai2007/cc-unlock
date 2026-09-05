import {
  readTaskJson,
  relFromRepo,
  resolveTaskDir
} from "./common.mjs";

const VALID_CLAIM_LEVELS = ["provisional", "route-ready", "acceptance-ready", "delivered"];

function parseArgs(argv) {
  const args = argv.slice(2);
  const taskRef = args.find((item) => !item.startsWith("--"));
  if (!taskRef) {
    console.error("usage: node tools/task/check-contract-health.mjs <task-id|task-path> [--json]");
    process.exit(1);
  }

  return {
    taskRef,
    json: args.includes("--json")
  };
}

function checkClaimLevelEscalation(history, currentLevel) {
  if (!Array.isArray(history) || history.length === 0) {
    const currIdx = VALID_CLAIM_LEVELS.indexOf(currentLevel);
    if (currIdx > 0) {
      return {
        ok: false,
        failure: `claimLevel 当前为 "${currentLevel}"，但 claimLevelHistory 为空；无法验证升级路径是否合法`
      };
    }
    return { ok: true };
  }

  const lastEntry = history[history.length - 1];
  const lastLevel = lastEntry?.to || "provisional";
  const lastIdx = VALID_CLAIM_LEVELS.indexOf(lastLevel);
  const currIdx = VALID_CLAIM_LEVELS.indexOf(currentLevel);

  if (lastIdx < 0 || currIdx < 0) {
    return {
      ok: false,
      failure: `claimLevel 值不合法: last="${lastLevel}", current="${currentLevel}"`
    };
  }

  if (currIdx < lastIdx) {
    return {
      ok: false,
      failure: `claimLevel 从 "${lastLevel}" 降级到 "${currentLevel}" 但缺少降级原因记录`
    };
  }

  if (currIdx - lastIdx > 1) {
    return {
      ok: false,
      failure: `claimLevel 从 "${lastLevel}" 越级跳到 "${currentLevel}"；必须逐级升级 (provisional → route-ready → acceptance-ready → delivered)`
    };
  }

  return { ok: true };
}

function main() {
  const { taskRef, json } = parseArgs(process.argv);
  const taskDir = resolveTaskDir(taskRef);
  const task = readTaskJson(taskDir);

  const failures = [];

  // 1. completionCriteria must be non-empty with meaningful entries
  const criteria = task.taskContract?.completionCriteria || [];
  const weakPatterns = [/^done$/i, /^完成$/i, /^ok$/i, /^success$/i, /^通过$/i, /^pass$/i];
  if (!Array.isArray(criteria) || criteria.length === 0) {
    failures.push({
      check: "completionCriteria-non-empty",
      message: "taskContract.completionCriteria 为空；未定义完成标准，无法判定是否完成",
      fix: "在 taskContract.completionCriteria 中至少填写一条可验证的完成条件"
    });
  } else {
    const weakEntries = criteria.filter((c) => {
      const s = String(c || "").trim();
      return s.length < 10 || weakPatterns.some((p) => p.test(s));
    });
    if (weakEntries.length > 0) {
      failures.push({
        check: "completionCriteria-too-weak",
        message: `taskContract.completionCriteria 中存在 ${weakEntries.length} 条过于模糊或过短的条目: [${weakEntries.join(", ")}]；无法作为可验证的完成标准`,
        fix: "每条 completionCriteria 至少 10 个字符，描述具体可验证的验收条件（如'CLI输出MP4视频画面正常不花屏'，而非'完成任务'）"
      });
    }
  }

  // 2. intermediateStatesNotDelivery must be non-empty
  const intermediateStates = task.taskContract?.intermediateStatesNotDelivery || [];
  if (!Array.isArray(intermediateStates) || intermediateStates.length === 0) {
    failures.push({
      check: "intermediateStatesNotDelivery-non-empty",
      message: "taskContract.intermediateStatesNotDelivery 为空；无中间状态拦截，任何技术里程碑都可能被误报为完成",
      fix: "在 taskContract.intermediateStatesNotDelivery 中列出所有不算完成的技术中间状态"
    });
  }

  // 3. acceptanceGapDefined must be true (for acceptance-ready and above)
  const claimLevel = task.acceptanceModel?.claimLevel || "provisional";
  const acceptanceGapDefined = task.acceptanceModel?.acceptanceGapDefined === true;
  const claimLevelIdx = VALID_CLAIM_LEVELS.indexOf(claimLevel);

  if (claimLevelIdx >= VALID_CLAIM_LEVELS.indexOf("acceptance-ready") && !acceptanceGapDefined) {
    failures.push({
      check: "acceptanceGapDefined",
      message: `claimLevel="${claimLevel}" 但 acceptanceGapDefined=false；acceptanceGap 从未被显式定义，无法区分"已闭合"与"未定义"`,
      fix: "将 acceptanceModel.acceptanceGap 填写为当前离验收还缺的具体证据，并将 acceptanceGapDefined 设为 true"
    });
  }

  // 4. claimLevel escalation path must be valid
  const history = task.acceptanceModel?.claimLevelHistory || [];
  const escalation = checkClaimLevelEscalation(history, claimLevel);
  if (!escalation.ok) {
    failures.push({
      check: "claimLevel-escalation-path",
      message: escalation.failure,
      fix: "逐级升级 claimLevel (provisional → route-ready → acceptance-ready → delivered)，每次升级追加 claimLevelHistory 记录"
    });
  }

  const ok = failures.length === 0;

  if (json) {
    console.log(JSON.stringify({ ok, failures }, null, 2));
  } else if (!ok) {
    console.error(`check-contract-health: BLOCKED ${relFromRepo(taskDir)}`);
    for (const f of failures) {
      console.error(`[${f.check}] ${f.message}`);
      console.error(`  fix: ${f.fix}`);
    }
    console.error("rule=contract-health-must-pass-before-reply");
    console.error("rule=do-not-claim-delivered-without-defined-contract");
  } else {
    console.log(`check-contract-health: OK ${relFromRepo(taskDir)}`);
    console.log(`completionCriteriaCount=${criteria.length}`);
    console.log(`intermediateStatesNotDeliveryCount=${intermediateStates.length}`);
    console.log(`acceptanceGapDefined=${acceptanceGapDefined}`);
    console.log(`claimLevel=${claimLevel}`);
  }

  if (!ok) {
    process.exit(2);
  }
}

main();
