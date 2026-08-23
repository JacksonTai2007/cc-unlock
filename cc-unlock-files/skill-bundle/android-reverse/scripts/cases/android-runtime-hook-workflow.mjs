export default {
  caseId: "android-runtime-hook-workflow",
  status: "abstract-case",
  category: "runtime-hooking",
  tags: [
    "runtime-hooking",
    "frida",
    "hook"
  ],
  focus: [
    "Frida Java",
    "Frida Native",
    "运行时样本"
  ],
  deliverables: [
    "report.md",
    "run/frida-java-template.js",
    "run/frida-native-template.js"
  ],
  checkpoints: [
    "至少一条 Java hook 成功",
    "至少一条 Native hook 或明确说明为何不需要",
    "已沉淀运行时样本"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从最接近目标结论的 Java 或 Native 边界做最小 hook",
      firstProbe: "选择参数最完整、线程最稳定、调用频次可控的入口",
      expandWhen: "已采到稳定样本并能解释业务动作",
      parkWhen: "hook 噪音过高或一直未命中"
    },
    {
      id: "E2",
      hypothesis: "若主入口未命中，问题可能在时机、线程、进程或更低层入口",
      firstProbe: "调整 spawn/attach、线程、进程和更近源头的 hook 点",
      expandWhen: "新 hook 点能更稳定地产生目标样本",
      parkWhen: "多轮切换后仍只有噪音或重复样本"
    }
  ],
  probeSequence: [
    "先选最小、最稳的 hook 点",
    "再确认线程、进程与时机",
    "最后将样本落盘并决定是否扩展到更深层"
  ],
  evidenceAnchors: [
    "hook 脚本、参数样本、返回值、线程与时机记录",
    "frida-java-template、frida-native-template、runtime-evidence"
  ],
  pivotSignals: [
    "hook 一直未命中或只命中噪音路径",
    "相同动作在不同进程表现不同",
    "当前 hook 点距离真实结论仍过远"
  ],
  successSignals: [
    "已拿到可解释目标动作的稳定样本",
    "已明确下一步应扩展或下钻的入口"
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
    "运行时结论要有样本"
  ]
};

