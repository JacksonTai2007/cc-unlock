export default {
  caseId: "win-mixed-mode-interop-workflow",
  status: "abstract-case",
  category: "mixed-mode-interop",
  tags: ["mixed-mode-interop", "pinvoke", "clrhost"],
  focus: ["托管/非托管边界", "桥接链", "最小稳定 hook 点"],
  deliverables: ["report.md", "task.json", "run/mixed-mode-notes.md"],
  checkpoints: ["已判定桥接方向", "已记录至少一条 bridge edge", "已给出最小验证点"],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port", "Close"],
  caveats: ["先分清业务语义究竟位于托管侧还是非托管侧，再决定深拆方向"]
};
