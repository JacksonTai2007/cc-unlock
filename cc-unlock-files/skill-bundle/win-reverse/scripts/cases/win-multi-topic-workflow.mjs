export default {
  caseId: "win-multi-topic-workflow",
  status: "abstract-case",
  category: "multi-topic",
  tags: [
    "multi-topic",
    "pivot",
    "entrypoint",
    "operator-loop"
  ],
  focus: [
    "多专题切入点排序",
    "证据链跨阶段收敛",
    "Observe/Capture/Rebuild 闭环内的主动 pivot"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "state/route-state.json",
    "run/fixtures.json"
  ],
  checkpoints: [
    "已确认主线专题和伴随专题的先后关系",
    "已把组合路径压缩为 1 到 2 个高价值切入点",
    "已明确本轮完成后如何自动推进下一阶段"
  ],
  caveats: [
    "不要平均推进所有专题；始终先做信息增益最高的切入点",
    "先固定主样本、主宿主和主证据链，再决定是否扩展到第二宿主或第二工具"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "PureExtraction",
    "Port",
    "Close"
  ]
};
