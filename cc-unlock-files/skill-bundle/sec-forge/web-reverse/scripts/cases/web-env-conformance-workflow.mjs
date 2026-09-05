export default {
  caseId: "web-env-conformance-workflow",
  status: "abstract-case",
  category: "env-conformance",
  tags: ["env", "conformance", "first-divergence"],
  focus: [
    "first divergence 驱动的宿主行为对齐",
    "descriptor / scheduler / typed-array / crypto 差异判断",
    "最小因果补丁策略",
    "local rebuild 到 pure extraction 之间的准入边界"
  ],
  deliverables: [
    "report.md",
    "run/env-conformance-template.js",
    "run/env-conformance-notes.md"
  ],
  checkpoints: [
    "已确认 first divergence",
    "已确认失真面属于 api / descriptor / scheduler / typed-array / crypto 之一",
    "已记录最小补丁与复跑结果",
    "已标注仍未对齐项"
  ],
  caveats: [
    "补环境通过不等于 pure extraction 完成，必须确认行为级一致性",
    "如果异步顺序或 descriptor 未对齐，不得给出高置信语义结论"
  ]
};
