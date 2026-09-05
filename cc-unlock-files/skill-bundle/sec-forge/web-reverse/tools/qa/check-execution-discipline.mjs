import { failWith, readText } from "./common.mjs";

const findings = [];

function requireIncludes(relPath, needles) {
  const text = readText(relPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      findings.push(`${relPath} is missing required execution-discipline text: ${needle}`);
    }
  }
}

function getMarkdownSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`(^|\\n)## ${escaped}\\r?\\n([\\s\\S]*?)(?=\\n## |$)`));
  return match ? match[2] : "";
}

function requireSection(relPath, heading) {
  const section = getMarkdownSection(readText(relPath), heading);
  if (!section) {
    findings.push(`${relPath} is missing required section: ${heading}`);
  }
  return section;
}

function requirePatterns(text, relPath, label, checks) {
  for (const check of checks) {
    if (!check.pattern.test(text)) {
      findings.push(`${relPath} is missing ${label}: ${check.name}`);
    }
  }
}

// [阶段1·去焊接] 已移除对 SKILL.md 正文 section/pattern 的断言（startup-gate / reply-gate）：
// 校验「正文写了某短语」属于 presence 检查而非 efficacy，且把正文焊死、阻碍精简。
// 这些行为纪律的效力改由 eval（eval_set.json + skill-creator）验收；reverse-workflow.md
// 等参考文档的机制性 needle 断言保留如下。
void requireSection;
void requirePatterns;

requireIncludes("docs/reference/reverse-workflow.md", [
  "不得把“我会继续 / 我将自动推进 / 下一步继续”当作阶段收尾",
  "先运行 `node tools/task/assert-can-reply.mjs <task-id>`",
  "任何“已落盘 / 已更新 / 已打通 / 已成功”的表述，都必须先经过文件存在性或验证结果自检"
]);

requireIncludes("docs/reference/output-contract.md", [
  "当前目录可能是 skill 项目目录，任务 artifact 也可能位于外部 workspace",
  "先运行 `node tools/task/assert-can-reply.mjs <task-id>`",
  "未核实文件真实存在前，不得写“已落盘 / 已更新 / 已写入”",
  "未拿到最新验证结果前，不得写“已成功 / 已打通 / 已请求成功”"
]);

requireIncludes("agents/openai.yaml", [
  "assert-can-reply",
  "外部 workspace",
  "我会继续",
  "已落盘/已成功"
]);

failWith(findings, "check-execution-discipline");
