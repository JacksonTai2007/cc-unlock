import { exists, failWith, readText } from "./common.mjs";
import { collectDocFactSyncFindings } from "../docs/fact-sync.mjs";

const findings = [];
const raw = readText("SKILL.md");
const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
const openaiYamlPath = "agents/openai.yaml";

function parseSimpleFrontmatter(block) {
  const values = new Map();
  for (const line of String(block || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      throw new Error(`cannot parse frontmatter line: ${trimmed}`);
    }
    values.set(match[1], match[2]);
  }
  return values;
}

function parseSimpleOpenAiYaml(text) {
  const root = {};
  let activeSection = null;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const sectionMatch = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (sectionMatch) {
      activeSection = sectionMatch[1];
      root[activeSection] = root[activeSection] || {};
      continue;
    }

    const nestedMatch = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (nestedMatch) {
      if (!activeSection) {
        throw new Error(`cannot parse openai.yaml line without active section: ${trimmed}`);
      }
      let value = nestedMatch[2].trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      root[activeSection][nestedMatch[1]] = value;
      continue;
    }

    throw new Error(`cannot parse openai.yaml line: ${trimmed}`);
  }

  return root;
}

function collectBacktickPathRefs(text) {
  return Array.from(
    String(text || "").matchAll(/`((?:docs|references|tools|scripts|topics|artifacts|agents)\/[^`\n<>]+?\.(?:md|json|mjs|js|yaml|yml|py))`/g)
  ).map((match) => match[1]);
}

function validateDocRefs(relPath) {
  const text = readText(relPath);
  for (const ref of collectBacktickPathRefs(text)) {
    if (ref.includes("*") || ref.includes("<") || ref.includes(">")) {
      continue;
    }
    if (!exists(ref)) {
      findings.push(`${relPath} references a missing file: ${ref}`);
    }
  }
}

function validateForbiddenPhrases(relPath, phrases) {
  const text = readText(relPath);
  for (const phrase of phrases) {
    if (text.includes(phrase)) {
      findings.push(`${relPath} contains cross-skill residue: ${phrase}`);
    }
  }
}

if (!frontmatterMatch) {
  findings.push("SKILL.md is missing YAML frontmatter");
} else {
  const values = parseSimpleFrontmatter(frontmatterMatch[1]);
  if (String(values.get("name") || "") !== "android-reverse") {
    findings.push("SKILL.md frontmatter name is out of sync");
  }
  const description = String(values.get("description") || "");
  for (const needle of ["普通 Android 开发", "未授权漏洞利用", "iOS 逆向"]) {
    if (!description.includes(needle)) {
      findings.push(`SKILL.md description is missing boundary text: ${needle}`);
    }
  }
  for (const needle of ["必须触发", "继续既有 Android 逆向任务"]) {
    if (!description.includes(needle)) {
      findings.push(`SKILL.md description is missing strong trigger text: ${needle}`);
    }
  }
}

for (const needle of [
  "## 完整任务强制执行循环",
  "references/environment-preflight.md",
  "每次 probe、patch、verify 和工具预检",
  "都立即运行 `task-record-attempt`",
  "--kind=<probe|patch|verify|tool>",
  "只有候选设计、尚未应用时使用 `--proposal`",
  "references/failure-protocol.md",
  "先写 retrospective",
  "暂停/上下文交接前更新 `report.md`",
  "references/output-gates.md"
]) {
  if (!raw.includes(needle)) {
    findings.push(`SKILL.md is missing execution-control contract: ${needle}`);
  }
}

for (const marker of [
  "<!-- BEGIN GENERATED: topic-maturity-summary -->",
  "<!-- END GENERATED: topic-maturity-summary -->"
]) {
  if (!raw.includes(marker)) {
    findings.push(`SKILL.md is missing generated maturity marker: ${marker}`);
  }
}

for (const finding of collectDocFactSyncFindings()) {
  if (finding.startsWith("SKILL.md ") || finding.startsWith("README.md ")) {
    findings.push(`generated maturity summary is out of date: ${finding}`);
  }
}

if (!exists(openaiYamlPath)) {
  findings.push("agents/openai.yaml is missing");
} else {
  try {
    const skillValues = frontmatterMatch ? parseSimpleFrontmatter(frontmatterMatch[1]) : new Map();
    const skillName = String(skillValues.get("name") || "");
    const description = String(skillValues.get("description") || "");
    const openaiYaml = parseSimpleOpenAiYaml(readText(openaiYamlPath));
    const iface = openaiYaml.interface || {};
    const displayName = String(iface.display_name || "");
    const shortDescription = String(iface.short_description || "");
    const defaultPrompt = String(iface.default_prompt || "");

    if (!displayName) {
      findings.push("agents/openai.yaml is missing interface.display_name");
    } else {
      for (const needle of ["Android", "逆向"]) {
        if (!displayName.includes(needle)) {
          findings.push(`agents/openai.yaml display_name should include ${needle} to stay aligned with SKILL.md`);
        }
      }
      if (skillName === "android-reverse" && displayName.includes("iOS")) {
        findings.push("agents/openai.yaml display_name drifts outside the android-reverse scope");
      }
    }

    if (!shortDescription) {
      findings.push("agents/openai.yaml is missing interface.short_description");
    } else {
      const capabilityNeedles = ["APK", "JNI", "SO", "Frida"];
      if (!capabilityNeedles.some((needle) => shortDescription.includes(needle))) {
        findings.push("agents/openai.yaml short_description should mention at least one core Android reverse capability from SKILL.md");
      }
      if (!/task-local|续跑/.test(shortDescription)) {
        findings.push("agents/openai.yaml short_description should mention task-local or 续跑 to reflect the lifecycle emphasis in SKILL.md");
      }
      if (
        description.includes("Android 应用逆向工程技能框架") &&
        !/Android|APK|JNI|SO|Frida/.test(shortDescription)
      ) {
        findings.push("agents/openai.yaml short_description is too far from the SKILL.md description focus");
      }
    }

    if (!defaultPrompt) {
      findings.push("agents/openai.yaml is missing interface.default_prompt");
    } else {
      const requiredPromptNeedles = [
        "task-local",
        "history data files",
        "`task-start`",
        "`task-init`",
        "`task.json -> route-state.json -> report/fixtures -> task-sync -> task-advance`",
        "`--force-new-task`",
        "`report.md`",
        "中文",
        "`execution.status=ready-to-continue`",
        "`nextExecutableAction`"
      ];
      for (const needle of requiredPromptNeedles) {
        if (!defaultPrompt.includes(needle)) {
          findings.push(`agents/openai.yaml default_prompt is missing required contract fragment: ${needle}`);
        }
      }

      for (const forbidden of ["iOS", "浏览器", "web-reverse", "普通 Android 开发"]) {
        if (defaultPrompt.includes(forbidden)) {
          findings.push(`agents/openai.yaml default_prompt contains out-of-scope residue: ${forbidden}`);
        }
      }
    }
  } catch (error) {
    findings.push(`agents/openai.yaml cannot be parsed or validated: ${error.message}`);
  }
}

[
  "SKILL.md",
  "README.md",
  "docs/reference/android-reverse-bootstrap.md",
  "docs/guides/getting-started.md",
  "docs/guides/minimal-usage-manual.md",
  "docs/guides/task-lifecycle.md"
].forEach(validateDocRefs);

if (readText("SKILL.md").includes("docs/reference/android-reverse-bootstrap.md")) {
  findings.push("SKILL.md should reference docs/reference/reverse-bootstrap.md as the only canonical bootstrap");
}

for (const needle of [
  "兼容桥接页",
  "正式首读协议、续跑规则与首条正式工作回复契约以 `docs/reference/reverse-bootstrap.md` 为准。"
]) {
  if (!readText("docs/reference/android-reverse-bootstrap.md").includes(needle)) {
    findings.push(`docs/reference/android-reverse-bootstrap.md is missing bridge marker: ${needle}`);
  }
}

validateForbiddenPhrases("docs/guides/minimal-usage-manual.md", [
  "web-reverse",
  "前端签名",
  "浏览器正常、Node 复现失败",
  "浏览器实例"
]);

validateForbiddenPhrases("docs/guides/task-lifecycle.md", [
  "浏览器中的关键逻辑",
  "Node 与浏览器"
]);

failWith(findings, "check-skill-contract");
