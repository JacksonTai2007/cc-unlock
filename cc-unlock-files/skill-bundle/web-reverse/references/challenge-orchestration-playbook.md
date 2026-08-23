# Challenge Orchestration Playbook

Version: 1

适用场景：页面根据 fingerprint、session、telemetry、token refresh 或风险分支编排 challenge token、验证码、无感校验或 fallback 路由。

## 目标

- 识别 challenge 触发条件、状态机与分支路由。
- 识别 challenge token 的 carrier、刷新条件与失效条件。
- 识别 challenge 与 fingerprint / session / protocol 的绑定关系。

## 建议流程

1. 先写状态机，不要直接追一条 token API。
2. 记录 challenge 类型、触发入口、成功回调、重试与 fallback 条件。
3. 区分 bootstrap challenge、silent challenge、visual challenge 与 refresh 路径。
4. 把 challenge token 的上下游 carrier 记清，再决定是否深入其他专题。

## 最低交付

- `run/challenge-route-notes.md`
- `run/challenge-state-machine.json`

## 禁止事项

- 只抓一个 token 请求，不建立状态机。
- 不区分 challenge 类型与 fallback。
- 忽略 session / fingerprint 绑定关系。

## visual challenge 转专项

当 challenge 类型落到**滑块 / 点选 / 旋转验证码**（出现 `gettype`、`w` 参数、滑块底图，平台如 GeeTest/数美/顶象/百度/易盾）时，先在此建好状态机，再转 `captcha-slider-playbook.md` 做密文还原（各平台加密差异、GeeTest `w` 构造、底图还原、缺口/轨迹生成），配套脚本 `scripts/captcha/slide-gap.py` / `track-gen.py` / `geetest-w.py`。验收口径不变：端到端服务端返回成功，由 `run/verify-once.mjs` 复现。
