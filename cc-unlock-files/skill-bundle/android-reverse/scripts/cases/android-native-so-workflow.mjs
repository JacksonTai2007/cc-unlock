export default {
  caseId: "android-native-so-workflow",
  status: "abstract-case",
  category: "native-so",
  tags: [
    "native-so",
    "elf",
    "symbol"
  ],
  focus: [
    "关键函数",
    "关键常量",
    "运行时交叉验证"
  ],
  deliverables: [
    "report.md",
    "run/native-notes.md",
    "run/frida-native-template.js"
  ],
  checkpoints: [
    "已识别主 SO",
    "已识别关键函数或关键常量",
    "已给出动态验证路径"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从符号、导入导出和关键常量恢复 SO 功能边界",
      firstProbe: "检查 ELF、符号、字符串、crypto constant、syscall 与导入函数",
      expandWhen: "已形成可解释的函数簇或模块边界",
      parkWhen: "SO 过大且当前证据无法缩小范围"
    },
    {
      id: "E2",
      hypothesis: "若静态噪音过大，先从 JNI、调用样本或网络/协议边界反推",
      firstProbe: "结合 JNI 映射、调用日志、请求样本或返回值定位目标函数",
      expandWhen: "已把静态函数簇接回业务动作",
      parkWhen: "静态函数语义仍无法与运行时行为印证"
    }
  ],
  probeSequence: [
    "先缩小 SO 内的目标范围",
    "再建立业务动作到函数簇的映射",
    "最后决定是否需要更深 IDA 语义恢复"
  ],
  evidenceAnchors: [
    "ELF、符号、导入导出、常量、syscall、xref",
    "JNI 边界、调用样本、native-notes"
  ],
  pivotSignals: [
    "静态符号全被剥离或误导",
    "真实目标函数只在运行时可见",
    "SO 语义与 Java/Network 证据不一致"
  ],
  successSignals: [
    "已锁定高价值函数簇或模块边界",
    "已明确继续深挖的最小范围"
  ],
  caveats: [
    "单靠伪代码不下高置信运行时结论"
  ]
};

