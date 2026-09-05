export default {
  caseId: "win-static-triage-workflow",
  status: "abstract-case",
  category: "static-triage",
  tags: [
    "static-triage",
    "pe",
    "section"
  ],
  focus: [
  "PE 头与节区",
  "导入面与资源面",
  "主入口与运行时迹象",
  "Web 套壳 / WebView 技术路线指纹"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/static-triage-notes.md"
  ],
  checkpoints: [
  "已识别入口与运行时类型",
  "已记录主要导入与资源特征",
  "若安装目录含前端资源，已初判 wrapper/runtime 与 bundle 特征",
  "已判断是否继续进壳、.NET、驱动或网络线"
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
