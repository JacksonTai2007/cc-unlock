export default {
  caseId: "win-loader-injection-workflow",
  status: "abstract-case",
  category: "loader-injection",
  tags: [
    "loader-injection",
    "manualmap",
    "createremotethread"
  ],
  focus: [
    "注入链入口",
    "远端映像与内存权限",
    "最小稳定 hook / dump 点"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/loader-injection-notes.md"
  ],
  checkpoints: [
    "已确认注入技术和触发时机",
    "已记录目标进程 / 模块 / 权限边界",
    "已给出最小观测或拦截点"
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
    "先确认合法宿主和装载边界，再决定是否做远端 patch 或重放"
  ]
};
