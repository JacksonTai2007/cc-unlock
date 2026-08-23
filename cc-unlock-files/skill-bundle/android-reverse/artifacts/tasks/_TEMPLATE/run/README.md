# Run Artifacts

这里放 task-local 的运行脚本、hook 模板、notes 和验证夹具。

脚本命名约定：

- 默认版：`run/*.js`
  先做最小 probe，优先验证边界与切入点。
- 增强版：`run/*-advanced.js`
  用于 `A6 / A7`、多进程、壳、早期注入、Native pinning、复杂完整性等高对抗场景。
  先跑默认版拿到第一层证据，再切增强版扩面，避免一上来把噪音拉满。
  若增强版内置 `ACTIVE_PRESET`，优先切到最接近当前症状的 preset，再做局部细调。

至少保留：

- `fixtures.json`
- `verify-once.mjs`

