import { failWith, readText } from "./common.mjs";

const findings = [];

function requireIncludes(relPath, needles) {
  const text = readText(relPath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      findings.push(`${relPath} is missing hook-discipline text: ${needle}`);
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

// [阶段1·去焊接] 已移除对 SKILL.md「Entrypoint / Hook 纪律」section/pattern 的断言：
// presence 而非 efficacy，且焊死正文阻碍精简。Hook 纪律效力改由 eval 验收；
// 参考文档（reverse-workflow / instrumentation / storage-playbook / openai.yaml）的机制性 needle 断言保留。
void requireSection;
void requirePatterns;

requireIncludes("docs/reference/reverse-workflow.md", [
  "优先命中**高语义 hook 面**",
  "不算真正 pivot，只算同类低层 hook 重试",
  "同一家族低层 hook 默认最大 2 轮"
]);

requireIncludes("references/instrumentation.md", [
  "## Hook 语义层级优先级",
  "先定“**钩哪一层**”，再定“**用哪种 hook 手法**”",
  "从 `document.cookie` 换到 `cookieStore`，或从 `script.src` 换到 `appendChild`，不算真正 pivot",
  "## 目标漂移自检"
]);

requireIncludes("references/storage-playbook.md", [
  "不要把“carrier 来源考古”误当成主线",
  "优先闭合 `reader -> sign -> request-use`",
  "当作已经完成了 pivot"
]);

requireIncludes("agents/openai.yaml", [
  "hook 取证必须先找高语义边界",
  "低层 surface 间切换不算真正 pivot",
  "同类低层 hook 连续两轮无新增证据就必须换语义层或换 entrypoint"
]);

failWith(findings, "check-hook-discipline");
