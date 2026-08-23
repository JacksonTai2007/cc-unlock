export default {
  caseId: "web-anti-debug-workflow",
  status: "abstract-case",
  category: "anti-debug",
  tags: ["anti-debug", "preload", "runtime-hook"],
  focus: [
    "反调试模式枚举",
    "preload / runtime 注入时机判断",
    "绕过结果验证",
    "绕过后回到目标链路取证"
  ],
  deliverables: [
    "report.md",
    "run/anti-debug-snippets.js",
    "run/verify-once.mjs"
  ],
  checkpoints: [
    "已确认触发模式",
    "已确认注入时机",
    "已记录绕过结果",
    "已回到目标链路继续取证"
  ],
  caveats: [
    "页面不再暂停不等于所有反调试已解决",
    "必须记录未解决模式"
  ]
};
