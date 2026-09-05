export default {
  caseId: "android-trace-analysis-workflow",
  status: "active",
  category: "trace-analysis",
  tags: [
    "trace",
    "trace-ui",
    "trace-slice",
    "taint",
    "ltv-taint",
    "gumtrace",
    "qtrace",
    "vmlifter",
    "instruction trace",
    "algorithm recovery",
    "semantic lift"
  ],
  focus: [
    "先确定 trace 目标（函数偏移、调用链、算法还原），再选采集工具",
    "采集只产生原始数据，必须配合切片/污点/语义提升才能转化为结论",
    "trace 量级决定后续分析成本，必须限定模块范围"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/trace-analysis-notes.md"
  ],
  checkpoints: [
    "已明确 trace 目标（指令级 / 基本块级 / 函数调用级）和最终用途",
    "已按 SO 可达性选定采集工具（Unidbg / Frida Stalker / QTrace / QBDI / eBPF）",
    "trace 已限定到目标模块范围（不含 libc / libart 噪音）",
    "切片或污点分析已把原始 trace 压缩到可读规模（通常 5-10%）",
    "若目标为算法还原，已用真实输入输出对验证 Python 复现"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "从'最终用途'出发（算法还原 / 参数追踪 / 反混淆 / VMP handler）可决定采集粒度与工具类型，避免采到无用 trace",
      firstProbe: "用一句话写出 trace 完成后要回答的具体问题（不是'分析签名'而是'确认 sign() 第 3 步是否为 HMAC-SHA256'），按用途反推粒度",
      expandWhen: "目标问题可被一句具体提问表达，且对应粒度（指令/基本块/函数）已明确",
      parkWhen: "目标问题仍是'看看 SO 在做什么'——此时应先做静态分诊定位关键函数，再回来做 trace"
    },
    {
      id: "E2",
      hypothesis: "从'SO 可达性'出发（能否在 Unidbg 跑 / 有无反 Frida / 是否允许内存映射）可决定采集环境，避免选了工具却跑不起来",
      firstProbe: "先尝试在 Unidbg 中调用目标函数；若失败，再评估真机环境是否允许 Frida Stalker / QTrace",
      expandWhen: "目标函数在 Unidbg 中可执行，或真机环境已确认对所选采集器无强检测",
      parkWhen: "Unidbg 跑不通且真机有强反 Frida → 切到 QBDI 或考虑静态恢复路径"
    }
  ],
  probeSequence: [
    "明确 trace 目标问题（具体到函数偏移和要回答的业务问题）",
    "按 SO 可达性选采集环境（离线 Unidbg 优先于真机）",
    "限定模块范围采集 trace，避免 libc/libart 噪音",
    "做反向或正向切片，把原始 trace 压缩到可读规模",
    "做污点分析定位关键数据流（如密钥来源、签名输入）",
    "做语义提升（VMLifter / 手写提升）压缩指令序列",
    "用真实输入输出对验证恢复的算法或追踪结论"
  ],
  evidenceAnchors: [
    "trace 采集配置（工具、模块范围、粒度、采样窗口）",
    "切片后的指令子集（带 def-use 链注释）",
    "污点传播路径图（输入字节到输出值的路径）",
    "语义提升后的伪代码或 Python 复现",
    "验证记录：原始输出 vs 复现输出的比对结果"
  ],
  pivotSignals: [
    "trace 量级过大且无法压缩 → 重新限定模块范围或缩小目标函数",
    "采集环境对目标有干扰（Stalker 被 PC 检测） → 切到 QTrace/QBDI 或 Unidbg 离线",
    "切片后无清晰数据流 → 目标可能是控制流混淆，应先做静态反混淆（见 deobfuscation topic）",
    "语义提升后 LLM 识别不出算法 → 怀疑魔改算法，切到 crypto-protocol topic 做差分分析"
  ],
  successSignals: [
    "目标问题已被 trace 数据回答（不是'已采集'而是'已得出结论'）",
    "切片或污点结果可直接回指到具体指令地址和寄存器值",
    "若做算法还原，Python 复现的输出与真实输出在多个样本上一致",
    "trace-analysis-notes.md 已填写且包含工具选择理由和验证记录"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Close"
  ],
  caveats: [
    "trace 采集和分析必须分离——采集在目标环境，分析在本地，不要在目标上做重量级分析",
    "Stalker 不修改原始指令但执行地址在 slab 区域，目标可通过 PC % module_base 检测",
    "原始 trace 不算证据，必须经过切片/污点/语义提升才能转化为结论",
    "算法恢复必须用真实输入输出对验证，否则只是推测",
    "本 topic 是其他 topic（deobfuscation / vmp-analysis / crypto-protocol）的支撑工具，不要在 trace 内部强行闭环业务结论"
  ]
}
