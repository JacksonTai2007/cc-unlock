export default {
  caseId: "web-graphql-rpc-workflow",
  status: "abstract-case",
  category: "graphql-rpc",
  tags: ["graphql-rpc", "graphql", "apq", "persisted-query"],
  focus: [
    "恢复 operation 和变量边界",
    "分析 persisted query / APQ",
    "完成最小 verify"
  ],
  deliverables: [
    "report.md",
    "run/verify-once.mjs",
    "run/graphql-ops.json",
    "run/query-map.md"
  ],
  checkpoints: [
    "已区分 transport 形态",
    "已恢复 operation 与变量映射",
    "已完成至少一次验证"
  ],
  caveats: [
    "不要只看 hash，不恢复真实 operation"
  ]
};
