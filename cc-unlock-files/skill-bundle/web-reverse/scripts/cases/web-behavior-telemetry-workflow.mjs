export default {
  caseId: "web-behavior-telemetry-workflow",
  status: "abstract-case",
  category: "behavior-telemetry",
  tags: ["behavior-telemetry", "mousemove", "scroll"],
  runtime: "browser-observe",
  focus: [
    "枚举 telemetry channel",
    "确认采样/归一化/上报三段边界",
    "确认 challenge 或请求绑定点"
  ],
  deliverables: [
    "report.md",
    "run/behavior-telemetry-notes.md",
    "run/telemetry-profile.json"
  ],
  checkpoints: [
    "已确认至少一个 telemetry channel",
    "已确认归一化或聚合策略",
    "已确认下游绑定点之一"
  ],
  caveats: [
    "行为专题必须区分 channel、归一化和上报，不要只停留在事件监听层"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/behavior-telemetry-notes.md",
    "run/telemetry-profile.json"
  ],
  notes: [
    "guided 阶段优先积累真实样本中的 channel 分类与失败模式"
  ]
};
