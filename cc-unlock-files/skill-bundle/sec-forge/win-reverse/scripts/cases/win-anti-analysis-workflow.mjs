export default {
  caseId: "win-anti-analysis-workflow",
  status: "abstract-case",
  category: "anti-analysis",
  tags: [
    "anti-analysis",
    "debugger",
    "timing"
  ],
  focus: [
  "检测面枚举",
  "触发条件",
  "旁路与最小补丁"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/anti-analysis-notes.md"
  ],
  checkpoints: [
  "已明确检测面与触发时机",
  "已区分用户态与内核态阻断点",
  "已形成可复用 bypass 方案"
],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "PureExtraction",
    "Port",
    "Close"
  ],
  caveats: [
    "先用证据收敛，不在本 case 内替代真实 task-local 进度"
  ]
};
