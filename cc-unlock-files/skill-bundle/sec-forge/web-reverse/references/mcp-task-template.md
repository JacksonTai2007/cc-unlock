# Web Reverse MCP 专用任务模板

## 0. RouteSync

- 先读 `task.json`
- 再读 `state/route-state.json`
- 再把 `state/route-plan.md`、`state/clues.md`、`state/progress.md` 当作派生视图补充阅读
- 如已有任务状态，先以 `route-state.json` 恢复活跃线路、切入点与检查点
- 如缺少 `route-state.json`，再基于 Markdown 视图做一次最小 backfill

## 1. Observe

- 检查当前 Chrome 实例是否可控，优先接管已有实例
- 复杂任务先写 `state/route-plan.md`
- 基于浏览器证据和任务目标列出 2-5 个候选 entrypoints

## 2. Capture

- 命中高价值线索立即写入 `state/clues.md`
- 检查点变更立即写入 `state/progress.md`
- 按语义优先级捕获证据：request-use > sign-call > payload > dispatch > reader > writer > bridge > 低层 surface

## 3. Rebuild / Patch / PureExtraction

- 保持原有流程
- 优先重建最小可复现链路
- Patch 由 first divergence 驱动，不要泛补环境

## 4. Closeout

- 先回写最终线路状态
- 生成最终 `report.md`
- 确认 `run/verify-once.mjs` 和 `run/fixtures.json` 已落盘并通过验证
