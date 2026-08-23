export default {
  caseId: "win-ipc-persistence-workflow",
  status: "abstract-case",
  category: "ipc-persistence",
  tags: ["ipc-persistence", "service", "namedpipe"],
  focus: ["控制面链路", "触发条件", "最小可验证消息流"],
  deliverables: ["report.md", "task.json", "run/ipc-persistence-notes.md"],
  checkpoints: ["已枚举控制面载体", "已记录至少一条 launcher->use 链", "已说明权限/会话边界"],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port", "Close"],
  caveats: ["先建立控制面全链，再做局部 patch 或重放"]
};
