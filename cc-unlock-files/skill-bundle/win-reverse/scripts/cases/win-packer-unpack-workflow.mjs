export default {
  caseId: "win-packer-unpack-workflow",
  status: "abstract-case",
  category: "packer-unpack",
  tags: [
    "packer-unpack",
    "packer",
    "oep"
  ],
  focus: [
  "壳类型与解包路径",
  "OEP 恢复",
  "IAT 重建"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/unpack-notes.md"
  ],
  checkpoints: [
  "已识别壳迹象与入口跳转",
  "已形成 dump/OEP 方案",
  "已记录 IAT 恢复状态"
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
