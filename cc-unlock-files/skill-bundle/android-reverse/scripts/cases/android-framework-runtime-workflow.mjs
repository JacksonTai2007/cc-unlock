export default {
  caseId: "android-framework-runtime-workflow",
  status: "abstract-case",
  category: "framework-runtime",
  tags: [
    "framework-runtime",
    "flutter",
    "hermes"
  ],
  focus: [
    "Flutter / Hermes / Unity",
    "runtime identification",
    "container boundary"
  ],
  deliverables: [
    "report.md",
    "run/framework-runtime-notes.md",
    "run/framework-runtime-map.json"
  ],
  checkpoints: [
    "已识别运行时类型",
    "已建立 Java 容器到框架边界",
    "已给出框架内取证策略并记录资源/模块映射"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先识别 Flutter、Hermes、Unity 中的真实运行时类型与承载资源",
      firstProbe: "检查 libapp.so、libil2cpp.so、index.android.bundle、assets/bin/Data 等锚点",
      expandWhen: "已确认容器边界与主资源位置",
      parkWhen: "运行时类型仍不明确或资源位置漂移"
    },
    {
      id: "E2",
      hypothesis: "若 Java 容器信息不足，先从框架入口和资源加载链反推",
      firstProbe: "定位容器 Activity、engine 初始化、bundle/asset 装载点",
      expandWhen: "已得到框架内部 hook、dump 或静态恢复路径",
      parkWhen: "容器边界无法接回目标功能"
    }
  ],
  probeSequence: [
    "先做运行时识别",
    "再恢复 Java 容器到框架入口的边界",
    "最后确定框架内证据获取策略"
  ],
  evidenceAnchors: [
    "运行时特征文件、容器初始化、资源装载点",
    "framework-runtime-notes、map、hook 或 dump 结果"
  ],
  pivotSignals: [
    "Java-only 路径无法解释真实功能",
    "关键逻辑位于框架资源或动态下载包",
    "容器与框架进程不一致"
  ],
  successSignals: [
    "已识别具体运行时并确定主资源位置",
    "已给出可执行的框架内取证路径"
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
    "未识别运行时前不沿用 Java-only 路径强拆"
  ]
};

