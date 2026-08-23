export default {
  caseId: "android-unidbg-simulation-workflow",
  status: "active",
  category: "unidbg-simulation",
  tags: [
    "unidbg",
    "unicorn",
    "qbdi",
    "angr",
    "emulation",
    "simulation",
    "environment patching",
    "jni patch"
  ],
  focus: [
    "先确定模拟目标和工具选择",
    "按 JNI→文件→Syscall 三阶段补全环境",
    "模拟结果必须与真实设备对照验证"
  ],
  deliverables: [
    "run/unidbg-simulation-notes.md",
    "Unidbg Java 调用代码",
    "模拟结果与真实设备对照"
  ],
  checkpoints: [
    "已确定目标 SO 函数和参数签名",
    "已选择合适的模拟工具（Unidbg/Unicorn/angr）",
    "JNI 环境已补全（阶段 1）",
    "文件访问已补全（阶段 2）",
    "系统调用已处理（阶段 3）",
    "模拟结果已与真实设备对照验证"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "Unidbg 可完整模拟目标 SO 的加密/签名函数",
      firstProbe: "搭建 Unidbg 基础环境，加载目标 SO，处理 JNI_OnLoad，逐步补全 JNI 回调",
      expandWhen: "JNI_OnLoad 成功，基础 JNI 回调已补全",
      parkWhen: "SO 依赖大量设备硬件特性无法在 Unidbg 中模拟"
    },
    {
      id: "E2",
      hypothesis: "Unicorn 指令级 trace 可用于反混淆和算法还原",
      firstProbe: "使用 Unicorn 加载目标函数代码段，设置内存和寄存器，trace 执行路径",
      expandWhen: "trace 数据可读，能识别关键分支和算法模式",
      parkWhen: "函数依赖过多外部状态，无法在 Unicorn 中独立运行"
    }
  ],
  probeSequence: [
    "确定模拟目标（SO/函数/参数）",
    "选择模拟工具（Unidbg/Unicorn/QBDI/angr）",
    "搭建环境并加载目标 SO",
    "处理 JNI_OnLoad 和初始化",
    "三阶段补全环境（JNI→文件→Syscall）",
    "调用目标函数并提取结果",
    "与真实设备结果对照验证"
  ],
  exitCriteria: [
    "Unidbg 调用代码已完成",
    "模拟结果与真实设备一致",
    "unidbg-simulation-notes.md 已填写",
    "至少一个 keyFinding 已记录"
  ],
  evidenceAnchors: [
    "Unidbg 环境补全代码和补全的 JNI 调用列表",
    "模拟输出 vs 真实设备输出对照表",
    "缺失符号和 patch 记录"
  ],
  pivotSignals: [
    "Unidbg 补环境代价过高 → 考虑 Frida+设备 直接调用",
    "Unidbg JNI 环境补不全 → 检查是否有隐式系统调用",
    "模拟结果与设备不一致 → 逐层排查 JNI/文件/Syscall 差异"
  ],
  successSignals: [
    "目标函数可在 Unidbg 中正确调用",
    "模拟结果与真实设备一致",
    "环境补全代码结构清晰可复用"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Verify",
    "Close"
  ],
  caveats: [
    "必须先处理 JNI_OnLoad 再调用目标函数",
    "模拟结果必须用真实输入输出对验证",
    "Unidbg 不适合有 UI/Activity 依赖的函数"
  ]
}
