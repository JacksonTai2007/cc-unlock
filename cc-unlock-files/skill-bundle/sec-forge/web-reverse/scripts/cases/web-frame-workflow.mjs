export default {
  caseId: "web-frame-workflow",
  status: "abstract-case",
  category: "frame",
  tags: ["frame", "iframe", "postMessage"],
  focus: [
    "frame 树枚举",
    "跨 frame 消息流追踪",
    "关键逻辑所属 frame 确认"
  ],
  deliverables: [
    "report.md",
    "run/frame-notes.md"
  ],
  checkpoints: [
    "已列出 frame 树",
    "已确认目标逻辑所在 frame",
    "已记录关键消息流"
  ],
  caveats: [
    "不要默认主 frame 就是唯一分析目标"
  ]
};
