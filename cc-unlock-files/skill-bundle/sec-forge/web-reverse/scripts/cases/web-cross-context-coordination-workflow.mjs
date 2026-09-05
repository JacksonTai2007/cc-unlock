export default {
  caseId: "web-cross-context-coordination-workflow",
  status: "abstract-case",
  category: "cross-context-coordination",
  tags: ["cross-context-coordination", "broadcastchannel", "atomics", "worklet"],
  focus: [
    "枚举上下文",
    "恢复协同通道",
    "稳定消息时序"
  ],
  deliverables: [
    "report.md",
    "run/context-map.md",
    "run/message-graph.json",
    "run/verify-once.mjs"
  ],
  checkpoints: [
    "已确认上下文集合",
    "已记录消息图和共享状态",
    "已说明时序不稳定点"
  ],
  caveats: [
    "不要在未固定时间窗时直接全量追踪"
  ]
};
