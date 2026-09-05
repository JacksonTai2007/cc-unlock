export default {
  caseId: "android-art-runtime-workflow",
  status: "abstract-case",
  category: "art-runtime",
  tags: [
    "art-runtime",
    "deopt",
    "zygote"
  ],
  focus: [
    "ART / OAT / VDEX",
    "inline / deopt",
    "early instrumentation"
  ],
  deliverables: [
    "report.md",
    "run/art-runtime-notes.md"
  ],
  checkpoints: [
    "已确认关键进程和触发时机",
    "已判断是否存在编译或 inline 风险",
    "已给出 attach 或 deopt 策略"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先证明真实逻辑运行在哪个进程、什么时机执行",
      firstProbe: "检查进程名、spawn/attach 方案、首轮 logcat 和早期 hook 命中情况",
      expandWhen: "已定位真实执行进程与关键触发时机",
      parkWhen: "无法稳定复现进程或时机"
    },
    {
      id: "E2",
      hypothesis: "若 hook 未命中，根因可能在 inline/OAT/VDEX 或过晚注入",
      firstProbe: "记录编译状态、inline 风险、是否需要 deopt、延迟 hook 或多进程并行",
      expandWhen: "修正策略后命中率明显提升",
      parkWhen: "修正策略已穷尽但命中率仍无改善"
    }
  ],
  probeSequence: [
    "先确认执行进程与触发时机",
    "再确认编译状态、inline 风险与注入模式",
    "最后记录修正策略和结果"
  ],
  evidenceAnchors: [
    "进程列表、attach/spawn 记录、hook 命中日志",
    "OAT/VDEX/odex 迹象、deopt 记录、时序证据"
  ],
  pivotSignals: [
    "主进程 hook 未命中但业务行为真实发生",
    "同一 hook 在 attach 与 spawn 下表现不同",
    "功能链只在子进程或 isolated process 生效"
  ],
  successSignals: [
    "已解释未命中的真正原因",
    "已得到可复用的 attach/deopt/多进程策略"
  ],
  caveats: [
    "hook 未命中前先排查进程、时机与编译状态，不直接判定逻辑不存在"
  ]
};

