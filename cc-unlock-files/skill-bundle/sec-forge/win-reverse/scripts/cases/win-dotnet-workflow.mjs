export default {
  caseId: "win-dotnet-workflow",
  status: "abstract-case",
  category: "dotnet",
  tags: [
    "dotnet",
    "clr",
    "il"
  ],
  focus: [
  "运行时识别",
  "IL/元数据定位",
  "最小 IL 修补"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/dotnet-notes.md"
  ],
  checkpoints: [
  "已识别 CLR 与混淆器形态",
  "已定位关键类型/方法/资源",
  "已形成 IL patch 或运行时 hook 方案"
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
