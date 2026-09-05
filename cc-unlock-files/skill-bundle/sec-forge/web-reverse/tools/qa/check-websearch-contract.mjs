import { failWith, exists, readJson, readText } from "./common.mjs";

const findings = [];

for (const file of [
  "references/websearch-escalation-playbook.md",
  "docs/reference/search-decision-policy.md"
]) {
  if (!exists(file)) {
    findings.push(`missing websearch/evidence reference: ${file}`);
  }
}

// [阶段1·去焊接] 不再要求 SKILL.md 含名为「执行内搜索检查」的 section（section-name 文本断言
// 焊死正文、阻碍精简）。搜索契约由 websearch-escalation-playbook.md / search-decision-policy.md /
// web-search-tool.md 承载（上方已断言其存在）；SKILL.md 的「记录与搜索」段给出指针即可。

const prompts = readText("PROMPTS.md");
if (!/外部搜索纠偏/.test(prompts)) {
  findings.push("PROMPTS.md missing 外部搜索纠偏 section");
}

const outputContract = readText("docs/reference/output-contract.md");
if (!/state\/external-research\.md/.test(outputContract) || !/state\/external-research\.json/.test(outputContract)) {
  findings.push("output-contract missing external research artifacts");
}

const taskTemplate = readJson("artifacts/tasks/_TEMPLATE/task.json");
if (!("searchMode" in (taskTemplate.externalRefs || {}))) {
  findings.push("task template externalRefs missing searchMode");
}

failWith(findings, "check-websearch-contract");
