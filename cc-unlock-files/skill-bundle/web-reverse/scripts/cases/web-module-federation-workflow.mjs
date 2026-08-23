export default {
  caseId: "web-module-federation-workflow",
  status: "abstract-case",
  category: "module-federation",
  tags: ["module-federation", "remote-entry", "share-scope"],
  runtime: "browser-observe",
  focus: [
    "定位 remoteEntry 与 share scope",
    "区分 remote loader 与业务模块",
    "确认 remote module 如何进入实际执行链"
  ],
  deliverables: [
    "report.md",
    "run/module-federation-notes.md",
    "run/remote-entry-map.json"
  ],
  checkpoints: [
    "已确认 remoteEntry",
    "已确认至少一个 remote module",
    "已记录 share scope 或依赖拼装"
  ],
  caveats: [
    "remote runtime 与本地 chunk loader 需要分开记，不要写成一坨 runtime note"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/module-federation-notes.md",
    "run/remote-entry-map.json"
  ],
  notes: [
    "先写 remote 装载图，再判断是否深入源码恢复"
  ]
};
