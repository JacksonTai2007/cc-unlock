export default {
  caseId: "win-exception-runtime-workflow",
  status: "abstract-case",
  category: "exception-runtime",
  tags: ["exception-runtime", "seh", "tls-callback"],
  focus: ["启动链", "异常驱动控制流", "安全断点点位"],
  deliverables: ["report.md", "task.json", "run/exception-runtime-notes.md"],
  checkpoints: ["已枚举关键入口边", "已判断异常属于哪类控制流", "已给出安全观测点"],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port", "Close"],
  caveats: ["先厘清启动链，再决定是否对异常处理器做 patch"]
};
