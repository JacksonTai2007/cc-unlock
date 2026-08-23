export default {
  caseId: "android-vmp-analysis-workflow",
  status: "active",
  category: "vmp-analysis",
  tags: [
    "vmp",
    "vm interpreter",
    "handler table",
    "opcode mapping",
    "bytecode restoration",
    "dispatcher",
    "virtual machine protection",
    "dexprotector",
    "liapp"
  ],
  focus: [
    "先识别 VMP 类型和保护产品",
    "优先使用 trace-based 方法而非完整逆向",
    "只关注关键路径的 handler 映射"
  ],
  deliverables: [
    "run/vmp-analysis-notes.md",
    "handler 映射表（至少覆盖关键路径）",
    "还原后的关键方法伪代码"
  ],
  checkpoints: [
    "已确认 VMP 类型（Dalvik/Native/混合）",
    "已识别保护产品",
    "handler 表已提取",
    "操作码映射已构建（至少关键路径）",
    "还原结果已与运行时行为交叉验证"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "从壳特征和 VM dispatcher 模式可快速识别 VMP 类型和产品",
      firstProbe: "搜索壳特征字符串和 SO 库，在 IDA 中定位 VM dispatcher 结构",
      expandWhen: "VMP 类型已确认，dispatcher 结构已理解",
      parkWhen: "未找到标准壳特征，可能是自定义保护方案"
    },
    {
      id: "E2",
      hypothesis: "运行时 trace 可在不完整逆向的情况下获取关键逻辑",
      firstProbe: "使用 Frida Stalker trace VM 解释器，记录 handler 调用序列和参数",
      expandWhen: "trace 数据可读，能提取输入→处理→输出的关键路径",
      parkWhen: "trace 数据量过大且无法有效过滤"
    }
  ],
  probeSequence: [
    "确认 VMP 保护存在并识别类型",
    "识别保护产品（影响分析策略）",
    "提取 handler 表",
    "构建操作码映射（关键路径优先）",
    "trace-based 验证（Frida Stalker / Unicorn）",
    "字节码还原或伪代码生成"
  ],
  exitCriteria: [
    "handler 映射表已完成（关键路径）",
    "还原后的伪代码可读",
    "vmp-analysis-notes.md 已填写",
    "至少一个 keyFinding 已记录"
  ],
  evidenceAnchors: [
    "VM dispatcher 结构和 handler 表",
    "操作码映射表（opcode→语义）",
    "还原前后的代码对比",
    "trace 数据和 Frida Stalker 输出"
  ],
  pivotSignals: [
    "handler 数量巨大 → 先用自动化工具过滤，只分析关键路径",
    "静态还原代价过高 → 转 trace-based 方法",
    "VMP + 白盒密码组合 → 参考白盒密钥恢复流程"
  ],
  successSignals: [
    "关键方法的 handler 映射已完成",
    "还原后的伪代码与运行时行为一致",
    "VMP 类型和产品已正确识别"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Verify",
    "Close"
  ],
  caveats: [
    "不追求完整逆向 VM 解释器，只恢复关键路径可读性",
    "还原后必须与运行时行为交叉验证",
    "不同保护产品的 VMP 策略差异很大，需先确认产品类型"
  ]
}
