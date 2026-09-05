export default {
  caseId: "web-session-lifecycle-workflow",
  status: "abstract-case",
  category: "session-lifecycle",
  tags: ["session", "refresh", "bootstrap"],
  focus: [
    "登录态 / 匿名态 / 挑战态 bootstrap 取证",
    "cookie / csrf / token / nonce 载体映射",
    "刷新、续签与失效边界判断",
    "用户重新登录与浏览器会话复用边界"
  ],
  deliverables: [
    "report.md",
    "run/session-notes.md"
  ],
  checkpoints: [
    "已确认 bootstrap 阶段的会话建立方式",
    "已确认主要凭证载体与消费请求",
    "已确认刷新或续签触发条件",
    "已判断是否必须用户重新登录"
  ],
  caveats: [
    "拿到单次请求头不等于完成会话分析，必须说明后续刷新与失效边界",
    "除非会话彻底失效，不应因流程习惯反复要求用户重新登录"
  ]
};
