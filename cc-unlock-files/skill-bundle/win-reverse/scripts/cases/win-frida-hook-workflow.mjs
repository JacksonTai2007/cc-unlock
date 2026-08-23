export default {
  caseId: "win-frida-hook-workflow",
  status: "abstract-case",
  category: "frida-hooking",
  tags: [
    "frida-hooking",
    "frida",
    "interceptor"
  ],
  focus: [
  "运行时注入",
  "API hook",
  "事件采集"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/frida-hook-template.js"
  ],
  checkpoints: [
  "已明确附加模式与权限要求",
  "已定位目标函数或 API",
  "已沉淀脚本与事件日志格式"
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
