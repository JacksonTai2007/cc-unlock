export default {
  caseId: "web-signature-workflow",
  status: "abstract-case",
  category: "signature",
  tags: ["signature", "request-acceptance", "params"],
  focus: [
    "定位签名字段",
    "追踪输入边界与动态输入来源",
    "本地请求验收"
  ],
  deliverables: [
    "report.md",
    "run/verify-once.mjs",
    "run/signature-input-map.md",
    "run/signature-fixtures.json"
  ],
  checkpoints: [
    "已确认关键签名字段",
    "已定位输入边界与动态输入来源",
    "已完成至少一次本地请求验收或等价验证",
    "已记录 canonical string 和输入映射"
  ],
  caveats: [
    "不要只抓最终签名而不追踪输入来源",
    "不要把随机化输出不一致误判为算法失败"
  ]
};
