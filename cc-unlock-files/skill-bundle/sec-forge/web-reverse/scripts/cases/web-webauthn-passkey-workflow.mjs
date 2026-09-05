export default {
  caseId: "web-webauthn-passkey-workflow",
  status: "abstract-case",
  category: "webauthn-passkey",
  tags: ["webauthn-passkey", "webauthn", "passkey", "publickeycredential"],
  focus: [
    "区分注册和登录 ceremony",
    "映射 challenge 和 assertion",
    "说明真实认证器依赖"
  ],
  deliverables: [
    "report.md",
    "run/credential-flow.md",
    "run/request-response-samples.json",
    "run/verify-once.mjs"
  ],
  checkpoints: [
    "已确认 ceremony 类型",
    "已记录请求响应样本",
    "已说明 synthetic 与真实设备边界"
  ],
  caveats: [
    "不要把真实认证器依赖表述成纯 synthetic 闭环"
  ]
};
