export default {
  caseId: "web-node-env-patching-workflow",
  status: "abstract-case",
  category: "node-env-patching",
  tags: ["env", "node", "patching"],
  focus: [
    "browser -> node 证据闭环",
    "first divergence 驱动的 drift taxonomy 归类",
    "最小补丁单元与残留未对齐项管理",
    "PureExtraction 准入前的行为级验收"
  ],
  deliverables: [
    "report.md",
    "run/env-conformance-template.js",
    "run/env-conformance-notes.md",
    "run/env-drift-matrix.md",
    "run/browser-env-snapshot.json"
  ],
  checkpoints: [
    "已确认 browser -> node 的 first divergence",
    "已标注 drift taxonomy 与最小补丁单元",
    "已记录 Rerun shift 与残留未对齐项",
    "已判断是否达到 PureExtraction 准入"
  ],
  caveats: [
    "补环境通过不等于 pure 完成",
    "如果 descriptor / scheduler 仍不一致，不得给出高置信纯算法结论",
    "不允许没有浏览器证据就扩写大范围宿主对象"
  ]
};
