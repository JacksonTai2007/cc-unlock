export default {
  caseId: "win-ui-runtime-workflow",
  status: "abstract-case",
  category: "ui-runtime",
  tags: [
    "ui-runtime",
    "wndproc",
    "dialog"
  ],
  focus: [
  "窗口过程",
  "消息流",
  "交互逻辑"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/ui-runtime-notes.md"
  ],
  checkpoints: [
  "已识别主要窗口类与消息入口",
  "已记录关键消息与控件映射",
  "已形成交互链路或 patch 方案"
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
