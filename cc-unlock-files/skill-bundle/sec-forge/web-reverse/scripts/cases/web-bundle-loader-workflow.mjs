export default {
  caseId: "web-bundle-loader-workflow",
  status: "abstract-case",
  category: "bundle-loader",
  tags: ["bundle-loader", "chunk", "async-loader"],
  focus: [
    "loader 类型识别",
    "entry 与 async chunk 映射",
    "目标函数 chunk 落点"
  ],
  deliverables: [
    "report.md",
    "run/chunk-loader-notes.md"
  ],
  checkpoints: [
    "已识别 loader 类型",
    "已建立 entry 到 async chunk 映射",
    "已定位目标函数所在 chunk"
  ],
  caveats: [
    "不要只看入口 chunk 就结束"
  ]
};
