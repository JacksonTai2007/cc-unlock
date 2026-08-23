export default {
  caseId: "abstract-case-template",
  status: "abstract-case",
  category: "template",
  tags: [],
  runtime: "pure-node",
  focus: [
    "按阶段推进",
    "按契约交付",
    "按证据收敛"
  ],
  deliverables: [
    "report.md",
    "run/fixtures.json"
  ],
  checkpoints: [
    "已明确当前阶段",
    "已记录关键证据",
    "已给出下一步动作"
  ],
  caveats: [
    "只保留抽象流程和验收口径"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "PureExtraction",
    "Port"
  ],
  requiredArtifacts: [
    "task.json",
    "runtime-evidence.jsonl",
    "report.md",
    "run/fixtures.json"
  ],
  notes: [
    "只保留抽象流程和验收口径",
    "不保留真实站点可执行实现"
  ]
};
