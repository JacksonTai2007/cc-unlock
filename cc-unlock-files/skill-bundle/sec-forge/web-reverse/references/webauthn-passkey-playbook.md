# WebAuthn Passkey Playbook

适用场景：

- 命中 `navigator.credentials / PublicKeyCredential / webauthn.create / webauthn.get`
- 需要分析注册或登录的 challenge、assertion 和设备绑定
- WebAuthn 与风控、session 或 challenge 路线耦合

工作顺序：

1. 先区分 registration 和 authentication 两类 ceremony
2. 记录 challenge、rpId、user、allowCredentials、transports
3. 采集浏览器请求回包、客户端输入和服务端返回关系
4. 最后说明哪些步骤依赖真实认证器，哪些步骤可 synthetic 复验

最低交付：

- `run/credential-flow.md`
- `run/request-response-samples.json`
- `run/verify-once.mjs`

注意事项：

- 不要把真实硬件能力承诺成纯 synthetic 闭环
- 要明确 challenge 和 assertion 是如何与 session / risk route 绑定的
