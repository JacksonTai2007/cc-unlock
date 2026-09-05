import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTopicRegistryFromSource } from "../topic-manifests.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const maturityOrder = ["synthetic-e2e", "guided", "closed-loop", "reference-only"];

const blockTargets = [
  {
    path: "SKILL.md",
    blockId: "topic-maturity-summary",
    render: renderSkillTopicMaturitySummary
  },
  {
    path: "README.md",
    blockId: "topic-maturity-summary",
    render: renderReadmeTopicMaturitySummary
  },
  {
    path: "SKILL.md",
    blockId: "bootstrap-new-task-brief",
    render: () => renderBootstrapNewTaskBrief()
  },
  {
    path: "SKILL.md",
    blockId: "bootstrap-resume-task-brief",
    render: () => renderBootstrapResumeTaskBrief()
  },
  {
    path: "SKILL.md",
    blockId: "bootstrap-drill-task-brief",
    render: () => renderBootstrapDrillBrief()
  },
  {
    path: "PROMPTS.md",
    blockId: "default-flow",
    render: () => renderPromptDefaultFlow()
  },
  {
    path: "docs/reference/reverse-bootstrap.md",
    blockId: "bootstrap-new-task",
    render: () => renderBootstrapNewTask()
  },
  {
    path: "docs/reference/reverse-bootstrap.md",
    blockId: "bootstrap-resume-task",
    render: () => renderBootstrapResumeTask()
  },
  {
    path: "docs/reference/reverse-bootstrap.md",
    blockId: "bootstrap-drill-task",
    render: () => renderBootstrapDrill()
  },
  {
    path: "docs/guides/getting-started.md",
    blockId: "bootstrap-new-task",
    render: () => renderBootstrapNewTask()
  },
  {
    path: "docs/guides/getting-started.md",
    blockId: "bootstrap-resume-task",
    render: () => renderBootstrapResumeTask()
  },
  {
    path: "docs/guides/getting-started.md",
    blockId: "bootstrap-drill-task",
    render: () => renderBootstrapDrill()
  },
  {
    path: "docs/guides/minimal-usage-manual.md",
    blockId: "bootstrap-new-task",
    render: () => renderBootstrapNewTask()
  },
  {
    path: "docs/guides/minimal-usage-manual.md",
    blockId: "bootstrap-resume-task",
    render: () => renderBootstrapResumeTask()
  },
  {
    path: "docs/guides/minimal-usage-manual.md",
    blockId: "bootstrap-drill-task",
    render: () => renderBootstrapDrill()
  }
];

function sortTopics(topics) {
  return [...topics].sort((left, right) => String(left.key || "").localeCompare(String(right.key || "")));
}

function listTopicsByMaturity(topics, maturity) {
  return sortTopics(topics).filter((topic) => topic.maturity === maturity);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatTopicNames(topics) {
  return topics.length === 0 ? "none published yet" : topics.map((topic) => `\`${topic.key}\``).join(", ");
}

function renderReadmeTopicMaturitySummary(topics) {
  return maturityOrder.map((maturity) => {
    const group = listTopicsByMaturity(topics, maturity);
    return `- \`${maturity}\` (\`${group.length}\`): ${formatTopicNames(group)}`;
  }).join("\n");
}

function renderSkillTopicMaturitySummary(topics) {
  return renderReadmeTopicMaturitySummary(topics);
}

function renderBootstrapNewTask() {
  return [
    "1. 阅读 `SKILL.md`",
    "2. 阅读 `docs/reference/reverse-bootstrap.md`",
    "3. 若当前 workspace 没有 history data files，执行 `node tools/task/task-start.mjs <task-id>`",
    "4. 如果已知 topic 或交付约束，可一并传 `--topic=`、`--topics=`、`--local-repro`、`--protocol-replay`、`--task-input=...`",
    "5. `task-start` 在无历史文件时转发到 `task-init`；若 workspace 已有 history data files，则默认阻止新建第二个 task-local，除非显式传 `--force-new-task`",
    "6. 在进入 `task-sync` 前补齐最小输入：`target / objective / requirements / boundaries`，并尽量同时确定 `runtime.architecture / runtime.wow64 / runtime.managed / protectionTier`",
    "7. 执行 `node tools/task/task-sync.mjs <task-id>`",
    "8. 执行 `node tools/task/task-advance.mjs <task-id>`",
    "9. 若 `execution.status=ready-to-continue`，直接执行 `nextExecutableAction`，不要停在状态汇报"
  ].join("\n");
}

function renderBootstrapResumeTask() {
  return [
    "1. 先读 `task.json` 与 `state/route-state.json`",
    "2. 再把 `state/route-plan.md`、`state/clues.md`、`state/progress.md` 作为派生视图补充查看",
    "3. 执行 `node tools/task/task-sync.mjs <task-id>`",
    "4. 执行 `node tools/task/task-advance.mjs <task-id>`",
    "5. 若 `execution.status=ready-to-continue`，必须继续执行 `nextExecutableAction`，不要停在“已恢复”",
    "6. 只有 `pauseCategory=user/risk`、缺样本或 closeout 已完成时，才允许暂停等待用户"
  ].join("\n");
}

function renderBootstrapDrill() {
  return [
    "1. 运行 `npm run task:drill -- --list`",
    "2. 选择 drill 后执行 `npm run task:drill -- <scenario-id> <task-id>`",
    "3. 再按 `task.json -> route-state.json -> task-sync -> task-advance` 的标准闭环继续推进"
  ].join("\n");
}

function renderBootstrapNewTaskBrief() {
  return [
    "- 无历史文件：`task-start -> task-init -> task-sync -> task-advance`",
    "- 可直接附带 `--topic=`、`--topics=`、`--local-repro`、`--protocol-replay`、`--task-input=...`",
    "- `task-input` 现已按 schema 强校验",
    "- 若 `execution.status=ready-to-continue`，继续执行 `nextExecutableAction`"
  ].join("\n");
}

function renderBootstrapResumeTaskBrief() {
  return [
    "- 先读 `task.json` 与 `state/route-state.json`，再补读 `route-plan / clues / progress`",
    "- 续跑统一走 `task-sync -> task-advance`",
    "- 恢复完成后直接继续活跃阶段，不以“状态汇报”收尾",
    "- 只有 `pauseCategory=user/risk`、缺样本或 closeout 完成时才停下"
  ].join("\n");
}

function renderBootstrapDrillBrief() {
  return [
    "- 没有真实样本但要模拟真实推进：先 `npm run task:drill -- --list`",
    "- 再执行 `npm run task:drill -- <scenario-id> <task-id>`",
    "- drill 生成后按普通 task-local 一样续跑"
  ].join("\n");
}

function renderPromptDefaultFlow() {
  return [
    "1. 先读 `reverse-bootstrap / reverse-workflow / case-safety`",
    "2. 新任务走 `task-start -> task-sync -> task-advance`；续跑任务走 `task.json -> route-state.json -> task-sync -> task-advance`",
    "3. `task-input` 按 schema 强校验；先补齐 `target / objective / requirements / boundaries`，并先裁定 `architecture / wow64 / managed / protectionTier`",
    "4. 先列 `entrypoints`，再做最小 probe",
    "5. 命中 `mixed-mode / ipc / exception / memory` 时先补读对应 playbook",
    "6. 每轮先落盘；若 `execution.status=ready-to-continue`，继续执行 `nextExecutableAction`"
  ].join("\n");
}

function replaceGeneratedBlock(text, blockId, replacement) {
  const startMarker = `<!-- BEGIN GENERATED: ${blockId} -->`;
  const endMarker = `<!-- END GENERATED: ${blockId} -->`;
  const pattern = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`);
  if (!pattern.test(text)) {
    throw new Error(`missing generated block markers for ${blockId}`);
  }
  return text.replace(pattern, `${startMarker}\n${replacement.trimEnd()}\n${endMarker}`);
}

function renderExpectedFile(relPath, topics) {
  const fullPath = path.join(repoRoot, ...relPath.split("/"));
  let text = fs.readFileSync(fullPath, "utf8");
  for (const target of blockTargets.filter((item) => item.path === relPath)) {
    text = replaceGeneratedBlock(text, target.blockId, target.render(topics));
  }
  return text;
}

export function collectDocFactSyncFindings(topics = readTopicRegistryFromSource()) {
  const findings = [];
  const relPaths = Array.from(new Set(blockTargets.map((target) => target.path)));
  for (const relPath of relPaths) {
    const fullPath = path.join(repoRoot, ...relPath.split("/"));
    const actual = fs.readFileSync(fullPath, "utf8");
    const expected = renderExpectedFile(relPath, topics);
    if (actual !== expected) {
      findings.push(`${relPath} is out of date with topic manifests`);
    }
  }
  return findings;
}

export function syncDocFactFiles(topics = readTopicRegistryFromSource()) {
  const relPaths = Array.from(new Set(blockTargets.map((target) => target.path)));
  for (const relPath of relPaths) {
    const fullPath = path.join(repoRoot, ...relPath.split("/"));
    const next = renderExpectedFile(relPath, topics);
    if (fs.readFileSync(fullPath, "utf8") !== next) {
      fs.writeFileSync(fullPath, next, "utf8");
    }
  }
}
