export default {
  caseId: "android-jni-bridge-workflow",
  status: "abstract-case",
  category: "jni-bridge",
  tags: [
    "jni-bridge",
    "registernatives",
    "loadlibrary"
  ],
  focus: [
    "loadLibrary",
    "RegisterNatives",
    "Java-Native 映射"
  ],
  deliverables: [
    "report.md",
    "run/register-natives-trace.js",
    "run/jni-bridge-map.md",
    "run/call-chain.md"
  ],
  checkpoints: [
    "已定位 SO",
    "已建立至少一条桥接链路",
    "已回填 jni-bridge-map 并给出下一步 Native 深挖目标"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从 System.loadLibrary、JNI_OnLoad、RegisterNatives 恢复边界映射",
      firstProbe: "定位 loadLibrary、导出符号、注册表与 Java native 方法声明",
      expandWhen: "已恢复至少一条 Java-Native 映射链",
      parkWhen: "注册与装载点均无法稳定回指业务逻辑"
    },
    {
      id: "E2",
      hypothesis: "若注册表被隐藏或动态生成，先从调用样本和返回值回推桥接",
      firstProbe: "在 native 方法调用前后做最小 hook，记录参数、返回值和线程",
      expandWhen: "已把运行时样本接回 SO 函数与 Java 调用方",
      parkWhen: "样本过于稀疏或无法稳定复现"
    }
  ],
  probeSequence: [
    "先恢复装载点与注册点",
    "再建立 Java 到 Native 再回 Java 或业务输出的最小链",
    "最后决定 Native 深挖范围"
  ],
  evidenceAnchors: [
    "loadLibrary、JNI_OnLoad、RegisterNatives、Java_* 符号",
    "调用参数、返回值、桥接日志、jni-bridge-map"
  ],
  pivotSignals: [
    "注册表被混淆、动态生成或只在子进程出现",
    "SO 逻辑复杂但桥接边界仍不清晰",
    "Java 层样本与 Native 推断不一致"
  ],
  successSignals: [
    "已恢复至少一条高价值桥接链",
    "已明确下一步应深挖的 SO 或函数簇"
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
    "未映射桥接前不下 Native 高置信结论"
  ]
};

