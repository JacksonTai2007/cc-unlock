export default {
  caseId: "web-storage-workflow",
  status: "abstract-case",
  category: "storage",
  tags: ["storage", "localStorage", "indexeddb"],
  focus: [
    "存储键清点",
    "token / seed / cache 角色区分",
    "写入到请求链路映射"
  ],
  deliverables: [
    "report.md",
    "run/storage-snapshot.json",
    "run/storage-notes.md"
  ],
  checkpoints: [
    "已明确关键存储键",
    "已说明写入与读取链路",
    "已生成脱敏快照"
  ],
  caveats: [
    "不要原样导出所有存储内容"
  ]
};
