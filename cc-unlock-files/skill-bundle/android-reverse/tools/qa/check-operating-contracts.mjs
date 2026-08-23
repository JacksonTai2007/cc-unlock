import { failWith, readText } from "./common.mjs";

const findings = [];

function requireIncludes(relPath, needles) {
  const text = readText(relPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      findings.push(`${relPath} is missing required text: ${needle}`);
    }
  }
}

requireIncludes("scripts/cases/README.md", [
  "`route-state.json` 是恢复真源，Markdown 只用于补充查看",
  "case 只负责提供抽象 workflow，不替代 task-local 当前状态"
]);

requireIncludes("docs/guides/minimal-usage-manual.md", [
  "run/verification.spec.json"
]);

requireIncludes("docs/guides/getting-started.md", [
  "`execution.status=ready-to-continue`",
  "不要停在状态汇报"
]);

requireIncludes("PROMPTS.md", [
  "本轮要取得的成功证据",
  "`execution.status=ready-to-continue`",
  "继续执行 `nextExecutableAction`"
]);

requireIncludes("agents/openai.yaml", [
  "每次 probe/patch/verify/tool preflight 后先落原始证据并执行 `task-record-attempt`",
  "相同策略三次失败时读取失败协议并 retrospective",
  "`execution.status=ready-to-continue` 时继续执行 `nextExecutableAction`"
]);

requireIncludes("references/environment-preflight.md", [
  "纯静态路线不因没有设备而阻塞",
  "不要为了形式完整枚举当前路线不会使用的全部 MCP",
  "task.json::executionContext.deviceMode=none",
  "state/route-state.json::toolReadiness",
  "若当前路线需要设备但 adb 不可用"
]);

failWith(findings, "check-operating-contracts");
