export default {
  caseId: "web-worker-workflow",
  status: "abstract-case",
  category: "worker",
  tags: ["worker", "service-worker", "message-channel", "workbox", "fetch-event"],
  focus: [
    "worker 类型与 URL 清点",
    "消息流与职责映射",
    "fetch 拦截与 cache routing 角色确认",
    "主线程与 worker 角色划分"
  ],
  deliverables: [
    "report.md",
    "run/worker-notes.md"
  ],
  checkpoints: [
    "已列出 worker 类型和 URL",
    "已记录关键消息样例",
    "已说明 worker 或 service worker 角色"
  ],
  caveats: [
    "不要只看主线程而忽略 worker"
  ]
};
