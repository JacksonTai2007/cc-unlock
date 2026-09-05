export default {
  caseId: "android-split-delivery-workflow",
  status: "abstract-case",
  category: "split-delivery",
  tags: [
    "split-delivery",
    "apks",
    "aab"
  ],
  focus: [
    "split APK / APKS / AAB",
    "dynamic feature",
    "installation reconstruction"
  ],
  deliverables: [
    "report.md",
    "run/split-delivery-notes.md",
    "run/split-layout.json"
  ],
  checkpoints: [
    "已枚举基础包与分包",
    "已确认安装或重组路径",
    "已确认目标逻辑所在模块"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先恢复 base、config、dynamic feature、asset pack 的完整布局",
      firstProbe: "枚举 split APK/APKS/AAB 结构、ABI/density/language split 与模块名",
      expandWhen: "已确认目标逻辑位于哪个模块及其可见性条件",
      parkWhen: "分包布局仍不完整或模块归属无法判定"
    },
    {
      id: "E2",
      hypothesis: "若 base.apk 缺逻辑，先证明目标是否位于运行时下载或动态特性模块",
      firstProbe: "检查 Play Core、SplitCompat、dynamic feature 安装点与资源下载路径",
      expandWhen: "已恢复安装、重组或还原路径",
      parkWhen: "运行时模块来源仍不可确认"
    }
  ],
  probeSequence: [
    "先恢复 split 布局与模块可见性",
    "再确认目标模块和安装/重组路径",
    "最后把结果接回静态或动态主线"
  ],
  evidenceAnchors: [
    "split-layout、模块清单、安装来源、SplitCompat/Play Core 证据",
    "split-delivery-notes、重组结果、目标模块归属"
  ],
  pivotSignals: [
    "base.apk 明显缺失核心逻辑",
    "目标逻辑只在特定 ABI/语言/密度 split 中存在",
    "功能依赖动态下载模块或运行时拉取资源"
  ],
  successSignals: [
    "已确认目标逻辑所在模块",
    "已记录稳定的安装、重组或还原路径"
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
    "未重组 split 前不把 base.apk 视为完整目标"
  ]
};

