export default {
  caseId: "mcp-reverse-pure-node-workflow",
  status: "abstract-case",
  category: "workflow",
  tags: ["workflow", "pure-node", "mcp"],
  focus: [
    "页面观察",
    "运行时采样",
    "Node 补环境",
    "PureExtraction"
  ],
  deliverables: [
    "report.md",
    "run/verify-once.mjs",
    "run/fixtures.json"
  ],
  checkpoints: [
    "找到目标请求和触发动作",
    "拿到至少一条真实样本",
    "记录 first divergence",
    "产出 Node pure"
  ],
  caveats: [
    "不要跳过页面证据直接补环境"
  ]
};
