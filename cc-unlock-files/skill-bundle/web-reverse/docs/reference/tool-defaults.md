# Tool Defaults

- hook 先 summary 后 raw
- 首屏链路优先 preload hook
- breakpoint 默认后置
- patch 每轮只做一个补丁决策
- 默认连续两轮无进展必须回退；但已开启 `deepDivePermit` 的 VM / WASM / 混淆微路线，改按 `maxRounds + exitCondition + highValueEvidence` 决定是否继续
- 重要动作必须写 task artifact
- 浏览器 profile 默认写临时目录，不默认沉到 task-local
- 会话与响应样本默认先做最小化 / redact，再决定是否保留原文
- 外部搜索默认只作为纠偏器，不作为证据替代器
- 外部搜索默认优先：官方文档 > GitHub > issue > 高质量公开分析
