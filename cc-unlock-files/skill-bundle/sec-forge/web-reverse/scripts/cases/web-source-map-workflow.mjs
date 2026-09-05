export default {
  caseId: "web-source-map-workflow",
  status: "abstract-case",
  category: "source-map",
  tags: ["source-map", "sourceMappingURL"],
  focus: [
    "map 存在方式确认",
    "sources 恢复",
    "关键函数源码落点"
  ],
  deliverables: [
    "report.md",
    "run/source-map-notes.md"
  ],
  checkpoints: [
    "已确认 source map 存在方式",
    "已恢复关键 source file",
    "已定位目标函数 source 落点"
  ],
  caveats: [
    "有 source map 时不应只停留在压缩 bundle 层"
  ]
};
