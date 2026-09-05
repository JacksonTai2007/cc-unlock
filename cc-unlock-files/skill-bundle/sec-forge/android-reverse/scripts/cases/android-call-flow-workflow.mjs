export default {
  caseId: "android-call-flow-workflow",
  status: "abstract-case",
  category: "call-flow",
  tags: [
    "call-flow",
    "activity",
    "viewmodel"
  ],
  focus: [
    "UI 触发点",
    "目标 sink",
    "最小链路回填"
  ],
  deliverables: [
    "report.md",
    "run/call-chain.md"
  ],
  checkpoints: [
    "已识别入口组件或触发动作",
    "已识别最终 sink",
    "已把最小有效调用链写入 run/call-chain.md"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从 UI 事件恢复业务调用链到 ViewModel/Repository",
      firstProbe: "检查 Activity、Fragment、onClick、observer、navigation 与数据绑定",
      expandWhen: "已串到 Repository、网络或 Native sink",
      parkWhen: "UI 入口与真实业务逻辑脱节"
    },
    {
      id: "E2",
      hypothesis: "若 UI 入口噪音大，先从 sink 反推回页面与状态源",
      firstProbe: "从网络调用、数据库写入、JNI 或关键字符串反查上游",
      expandWhen: "已建立双向可印证的调用链",
      parkWhen: "上游链路过度分叉且缺少关键锚点"
    }
  ],
  probeSequence: [
    "优先选择成本最低的 UI 或 sink 入口",
    "先建立最小链路，再补状态流和分支条件",
    "将链路回写到 call-chain 工件"
  ],
  evidenceAnchors: [
    "Activity/Fragment/ViewModel/Repository 调用点",
    "observer、navigation、网络或 Native sink 证据"
  ],
  pivotSignals: [
    "UI 入口只是壳页面或转发页面",
    "sink 明显位于 Native 或后台组件",
    "链路缺少状态条件解释"
  ],
  successSignals: [
    "已形成 UI 到 sink 的最小闭环",
    "已标出下一步应深挖的模块或分支"
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
    "不要把与目标行为无关的支线调用链混入主结论"
  ]
};
