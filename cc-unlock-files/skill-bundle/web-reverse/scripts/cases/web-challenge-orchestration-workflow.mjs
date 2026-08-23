export default {
  caseId: "web-challenge-orchestration-workflow",
  status: "abstract-case",
  category: "challenge-orchestration",
  tags: ["challenge-orchestration", "captcha", "risk-route"],
  runtime: "browser-observe",
  focus: [
    "建立 challenge 状态机",
    "确认 token carrier 与刷新条件",
    "确认 fingerprint/session/protocol 绑定点"
  ],
  deliverables: [
    "report.md",
    "run/challenge-route-notes.md",
    "run/challenge-state-machine.json"
  ],
  checkpoints: [
    "已确认 challenge 类型",
    "已建立至少一个状态迁移",
    "已确认 token carrier 或刷新条件之一"
  ],
  caveats: [
    "challenge 专题不能只留下一条 API 请求，必须记录状态机和绑定点"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/challenge-route-notes.md",
    "run/challenge-state-machine.json"
  ],
  notes: [
    "guided 阶段优先累计真实状态机和失败模式，不追求过早 synthetic 化"
  ]
};
