export default {
  caseId: "web-framework-runtime-workflow",
  status: "abstract-case",
  category: "framework-runtime",
  tags: ["framework-runtime", "nextjs", "vite", "astro", "hydration", "islands"],
  runtime: "browser-observe",
  focus: [
    "识别框架与渲染模式",
    "确认 payload/hydration/root boundary",
    "确认 native ESM / modulepreload / islands 边界",
    "拆开 framework runtime 与业务入口"
  ],
  deliverables: [
    "report.md",
    "run/framework-runtime-notes.md",
    "run/framework-payload-map.json"
  ],
  checkpoints: [
    "已确认框架类型或渲染模式",
    "已确认 payload carrier 或 modulepreload/runtime graph",
    "已确认 hydration 或 client runtime 边界"
  ],
  caveats: [
    "框架专题不能只停留在框架名，必须落到 payload 与 runtime 边界"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/framework-runtime-notes.md",
    "run/framework-payload-map.json"
  ],
  notes: [
    "guided 阶段优先记录 payload 边界与框架 runtime 行为"
  ]
};
