import { failWith, readText } from "./common.mjs";

const findings = [];

function requireOrder(relPath, needles) {
  const text = readText(relPath);
  let lastIndex = -1;
  for (const needle of needles) {
    const nextIndex = text.indexOf(needle);
    if (nextIndex < 0) {
      findings.push(`${relPath} is missing required anchor: ${needle}`);
      return;
    }
    if (nextIndex < lastIndex) {
      findings.push(`${relPath} violates required order: ${needles.join(" -> ")}`);
      return;
    }
    lastIndex = nextIndex;
  }
}

function requireIncludes(relPath, needles) {
  const text = readText(relPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      findings.push(`${relPath} is missing required text: ${needle}`);
    }
  }
}

function requireExcludes(relPath, needles) {
  const text = readText(relPath);
  for (const needle of needles) {
    if (text.includes(needle)) {
      findings.push(`${relPath} still contains forbidden text: ${needle}`);
    }
  }
}

requireIncludes("docs/reference/output-contract.md", [
  "默认最少交付只覆盖通用任务闭环",
  "只有当任务显式命中“本地复现 / API 调用示例”交付约束时，才要求 `run/pure-*.js` 或 `pure_*.py`。"
]);

requireExcludes("docs/reference/output-contract.md", [
  "- `run/pure-*.js`\n"
]);

requireOrder("references/mcp-task-template.md", [
  "- 先读 `task.json`",
  "- 再读 `state/route-state.json`",
  "- 再把 `state/route-plan.md`、`state/clues.md`、`state/progress.md` 当作派生视图补充阅读"
]);

requireIncludes("references/mcp-task-template.md", [
  "先以 `route-state.json` 恢复活跃线路、切入点与检查点",
  "如缺少 `route-state.json`，再基于 Markdown 视图做一次最小 backfill"
]);

requireOrder("scripts/cases/README.md", [
  "2. 再读 `artifacts/tasks/<task-id>/task.json`",
  "3. 再读 `artifacts/tasks/<task-id>/state/route-state.json`",
  "4. 再读 `artifacts/tasks/<task-id>/state/route-plan.md`"
]);

requireIncludes("scripts/cases/README.md", [
  "- `route-state.json` 是恢复真源，Markdown 只用于补充查看",
  "- case 只负责提供抽象 workflow，不替代 task-local 当前状态"
]);

failWith(findings, "check-operating-contracts");
