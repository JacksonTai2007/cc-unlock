# Task Artifacts

每个任务都应落盘到：

当前项目下的 `artifacts/tasks/<task-id>/`

最少包含：

- `task.json`
- `state/route-plan.md`
- `state/clues.md`
- `state/progress.md`
- `timeline.jsonl`
- `network.jsonl`
- `scripts.jsonl`
- `runtime-evidence.jsonl`
- `cookies.json`（默认应为 redact / summary 版本，而不是完整敏感串）
- `env/entry.js`
- `env/env.js`
- `env/polyfills.js`
- `env/capture.json`
- `report.md`（中文）
- `run/verify-once.mjs`
- `run/fixtures.json`

这些产物用于：
- 继续做同一个任务
- 恢复多线路状态
- 广播高价值线索
- 对齐页面证据
- 复盘补环境进展
- 为 pure extraction 和迁移提供夹具

默认不建议把以下内容当作常驻 task artifact：

- `run/puppeteer-profile/`
- `run/playwright-profile/`
- 其他浏览器 `*-profile/`
- 整包原始响应正文
- 未脱敏 cookie / authorization 原文

命中专题时，还应追加对应 route artifact，例如：

- `run/signature-input-map.md`
- `run/signer-state-map.md`
- `run/crypto-callgraph.md`
- `run/graphql-ops.json`
- `run/grpc-frame-notes.md`
- `run/runtime-map.json`
- `run/context-map.md`
- `run/credential-flow.md`
- `run/license-flow.md`
- `run/signaling-map.md`
- `run/beacon-log.jsonl`

跨任务可复用的方法与约定不写在这里，统一维护在 `references/` 下的对应 playbook。
