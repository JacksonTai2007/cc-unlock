export default {
  caseId: "web-microfrontend-runtime-workflow",
  status: "abstract-case",
  category: "microfrontend-runtime",
  tags: ["microfrontend-runtime", "systemjs", "single-spa", "qiankun"],
  focus: [
    "识别 remote loader",
    "绘制宿主和子应用边界",
    "追踪共享依赖与路由切换"
  ],
  deliverables: [
    "report.md",
    "run/runtime-map.json",
    "run/remote-deps.md",
    "run/verify-once.mjs"
  ],
  checkpoints: [
    "已确认装载器类型",
    "已映射宿主和 remote 关系",
    "已记录共享依赖和切换边界"
  ],
  caveats: [
    "不要把所有微前端都等同于 module federation"
  ]
};
