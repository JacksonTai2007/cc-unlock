export default {
  caseId: "web-dynamic-code-workflow",
  status: "abstract-case",
  category: "dynamic-code",
  tags: ["dynamic-code", "eval", "function"],
  focus: [
    "eval / Function / string-timer / blob-script 动态执行面枚举",
    "解码边界与执行边界取证",
    "动态代码明文捕获与离线沙箱复现",
    "区分防护层动态代码与真实业务层动态代码"
  ],
  deliverables: [
    "report.md",
    "run/dynamic-code-capture-template.js",
    "run/dynamic-code-notes.md"
  ],
  checkpoints: [
    "已确认至少一条真实动态执行链路",
    "已记录解码后或拼接后的关键明文",
    "已判断是否需要离线沙箱复现",
    "已区分防护型动态代码与业务型动态代码"
  ],
  caveats: [
    "捕获到 eval 并不等于拿到真实业务逻辑，必须确认触发阶段和代码职责",
    "动态代码执行不得默认带真实网络或写入副作用进入离线沙箱"
  ]
};
