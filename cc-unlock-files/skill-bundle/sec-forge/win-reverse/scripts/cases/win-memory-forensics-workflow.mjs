export default {
  caseId: "win-memory-forensics-workflow",
  status: "abstract-case",
  category: "memory-forensics",
  tags: ["memory-forensics", "vad", "minidump"],
  focus: ["内存布局", "最小 dump 粒度", "重建目标"],
  deliverables: ["report.md", "task.json", "run/memory-layout.md"],
  checkpoints: ["已建立最小 region 图", "已说明 dump 时机", "已定义 dump 后验证方式"],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port", "Close"],
  caveats: ["先定义为什么 dump、要 dump 什么，再决定用哪种工具拿内存"]
};
