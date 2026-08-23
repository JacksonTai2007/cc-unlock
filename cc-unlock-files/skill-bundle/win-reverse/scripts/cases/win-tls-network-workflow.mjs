export default {
  caseId: "win-tls-network-workflow",
  status: "abstract-case",
  category: "tls-network",
  tags: [
    "tls-network",
    "winhttp",
    "wininet"
  ],
  focus: [
  "网络栈识别",
  "TLS 边界",
  "协议抓点"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/tls-network-notes.md"
  ],
  checkpoints: [
  "已识别网络库与调用边界",
  "已区分明文点与 TLS 封装点",
  "已形成 hook/抓包/重放方案"
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
