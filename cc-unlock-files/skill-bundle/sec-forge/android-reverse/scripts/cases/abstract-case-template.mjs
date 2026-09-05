export default {
  caseId: "android-abstract-case-template",
  status: "abstract-case",
  category: "template",
  tags: [
    "template"
  ],
  focus: [
    "按阶段推进",
    "按证据收敛",
    "按契约交付"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/fixtures.json"
  ],
  checkpoints: [
    "已明确当前阶段",
    "已沉淀关键证据",
    "已给出下一步动作"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从最低成本、最高信息增益的入口证明目标主链是否真实存在",
      firstProbe: "执行最小静态分诊或轻量运行时探针，确认组件、装载点或网络入口",
      expandWhen: "探针命中关键类、关键进程、关键符号或关键请求",
      parkWhen: "探针连续未命中且无法产出新的证据锚点"
    },
    {
      id: "E2",
      hypothesis: "若主入口噪音过大，切到边界入口先恢复 Java-Native、容器或网络分层",
      firstProbe: "改做桥接、运行时类型或网络分层识别",
      expandWhen: "边界恢复后能把证据回接到主业务链",
      parkWhen: "边界证据无法解释当前目标或缺少可继续扩展的线索"
    }
  ],
  probeSequence: [
    "先列 2-5 个候选 entrypoints，再只激活 1-2 条低成本路线",
    "先做最小 probe，再决定是否扩大静态、动态或 patch 投入",
    "每轮先把证据落盘，再生成下一轮 route 决策"
  ],
  evidenceAnchors: [
    "Manifest、组件、资源、字符串、xref、符号",
    "hook 输出、日志、抓包、内存或运行时证据"
  ],
  pivotSignals: [
    "当前入口连续未命中",
    "发现更低成本且信息增益更高的新入口",
    "现有证据无法支撑高置信结论"
  ],
  successSignals: [
    "已形成能回指原始证据的阶段结论",
    "已明确下一可执行动作而不是停留在状态汇报"
  ],
  caveats: [
    "只保留抽象流程与验收口径"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "PureExtraction",
    "Port",
    "Close"
  ]
};

