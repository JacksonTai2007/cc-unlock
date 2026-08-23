export default {
  caseId: "android-dex-loader-workflow",
  status: "abstract-case",
  category: "dex-loader",
  tags: [
    "dex-loader",
    "shell",
    "classloader"
  ],
  focus: [
    "动态加载",
    "脱壳",
    "再分析"
  ],
  deliverables: [
    "report.md",
    "run/class-loader-trace.js",
    "run/dex-loader-dump-notes.md"
  ],
  checkpoints: [
    "已定位加载器",
    "已记录 class loader 树与 dump 状态",
    "已回到静态分析路径"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先恢复 ClassLoader 与真实 dex 可见时机",
      firstProbe: "检查 DexClassLoader、InMemoryDexClassLoader、stub Application 与 asset 解包点",
      expandWhen: "已确认真实业务 dex 的加载进程和加载时机",
      parkWhen: "加载链始终不稳定或无法捕获"
    },
    {
      id: "E2",
      hypothesis: "若 loader 已知但逻辑仍不可见，先做最小 dump 与再分诊",
      firstProbe: "记录 dump 时机、命中文件、ClassLoader 树与回流路径",
      expandWhen: "dump 结果能回到静态分析主线",
      parkWhen: "多轮 dump 仍只有 stub 或噪音 dex"
    }
  ],
  probeSequence: [
    "先定位 loader 与真实进程",
    "再记录 dump 时机和结果",
    "最后回到静态分析与桥接恢复"
  ],
  evidenceAnchors: [
    "ClassLoader 链、stub Application、dex dump 记录",
    "真实业务类可见性、再分诊笔记"
  ],
  pivotSignals: [
    "主进程与真实加载进程不一致",
    "首个 dump dex 仍然只有壳代码",
    "真实逻辑位于动态下载或多层加载链"
  ],
  successSignals: [
    "已确认真实业务 dex 的来源和可见时机",
    "已把 dump 结果接回主分析链"
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
    "未 dump 前不把 stub 代码当主逻辑"
  ]
};

