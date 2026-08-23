export default {
  caseId: "android-deobfuscation-workflow",
  status: "active",
  category: "deobfuscation",
  tags: [
    "ollvm",
    "fla",
    "br",
    "bcf",
    "sub",
    "mba",
    "deobfuscation"
  ],
  focus: [
    "先识别混淆类型和产品",
    "按 BCF→字符串→FLA→BR→SUB 顺序处理",
    "关键路径优先"
  ],
  deliverables: [
    "run/deobfuscation-notes.md",
    "还原后的关键函数伪代码",
    "工具和参数记录"
  ],
  checkpoints: [
    "已识别混淆类型（FLA/BR/SUB/BCF/icall）",
    "已识别混淆产品（OLLVM/Hikari/Arkari/Goron/BlackObfuscator）",
    "已判断是否需要静态还原还是运行时 hook 即可",
    "字符串已优先解密",
    "关键路径控制流已恢复可读"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "通过 CFG 和指令模式快速识别混淆类型",
      firstProbe: "IDA 查看目标函数 CFG，识别分发器/状态变量/CSEL/不透明谓词特征",
      expandWhen: "识别出具体混淆类型和产品",
      parkWhen: "CFG 无明显混淆特征，可能不是 OLLVM"
    },
    {
      id: "E2",
      hypothesis: "运行时 hook 可能比静态还原更高效",
      firstProbe: "Frida hook 目标函数入口/出口，抓取输入输出",
      expandWhen: "输入输出可满足分析目标",
      parkWhen: "需要理解内部逻辑，不能仅靠输入输出"
    }
  ],
  probeSequence: [
    "IDA 查 CFG → 识别混淆类型和产品",
    "BCF 还原（D-810 或 .bss patch）",
    "字符串解密（hook/xref/JNI trace）",
    "FLA 还原（D-810 → 状态机 → angr → Unicorn）",
    "BR 还原（Keypatch → Unidbg 双模拟器 → Frida）",
    "SUB 还原（IDA 9.2 → GAMBA → Z3）"
  ],
  exitCriteria: [
    "关键函数伪代码可读",
    "deobfuscation-notes.md 已填写",
    "至少一个 keyFinding 已记录"
  ],
  evidenceAnchors: [
    "CFG 分发器结构、状态变量映射、.bss 不透明谓词",
    "CSEL+BR 模式、MOVK 组合常量、Arkari DestBBs/XorKeys 数组"
  ],
  pivotSignals: [
    "D-810 无效 → 切换 angr/Unicorn（魔改检测）",
    "组合混淆中 BCF 未先处理 → FLA 状态变量提取失败",
    "静态还原代价过高 → 转运行时 hook 抓输入输出"
  ],
  successSignals: [
    "关键路径控制流已恢复可读",
    "混淆类型和产品已正确识别并记录",
    "deobfuscation-notes.md 含完整 patch 记录"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "Close"
  ],
  caveats: [
    "不追求完美去混淆，只恢复关键路径可读性",
    "先识别混淆类型再选工具，不要直接上手 D-810",
    "组合混淆必须按 BCF→字符串→FLA→BR→SUB 顺序处理"
  ]
}
