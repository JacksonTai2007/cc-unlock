export default {
  caseId: "web-instrumentation-hooking-workflow",
  status: "abstract-case",
  category: "instrumentation-hooking",
  tags: ["instrumentation-hooking", "hook", "trace", "preload"],
  focus: [
    "定位关键 hook 面",
    "控制侵入性",
    "记录统一事件流"
  ],
  deliverables: [
    "report.md",
    "run/preload.js",
    "run/runtime-hooks.js",
    "run/hook-events.jsonl",
    "run/hook-safety-notes.md"
  ],
  checkpoints: [
    "已确认 hook 面和触发阶段",
    "已记录统一事件流",
    "已评估完整性和反注入风险"
  ],
  caveats: [
    "不要为了抓证据直接破坏目标运行时"
  ]
};
