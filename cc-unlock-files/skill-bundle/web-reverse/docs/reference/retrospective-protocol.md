<!-- publish: framework -->
# Retrospective Protocol

Retrospective 不是情绪化复盘，而是为下一轮更便宜、更接近验收的动作清场。

## 触发条件

- 同一 entrypoint 在 probe 阶段连续 2 轮没有新增验收证据；foundation 阶段放宽为连续 2 轮没有新增基础 mapping/infrastructure
- 同一 entrypoint 在 foundation 阶段连续 4 轮仍无法升级到 probe（VM/WASM：连续 8 轮）
- 活跃 entrypoints 全部 `PARKED / EXHAUSTED`
- 同一假说衍生出多个同类脚本 / 样本采集，仍无突破
- 当前主模式 / 主专题明显选错
- `deepDivePermit` 开启后连续 2 轮没有新增高价值证据
- 阶段回退涉及 entrypoint 选择错误（仅阶段级调整、foundation 不完整回退不需要 retrospective）

停损参数以 `docs/reference/stop-loss-parameters.md` 为单一致源。

## 最小输出

至少写清：
- 当前停损层级（`foundation / probe / deep-dive`）与本轮在该层消耗的轮次
- 已降级假说
- 保留证据（含 foundation 阶段建立的基础 mapping/infrastructure）
- 作废解释
- 停止继续扩张的脚本 / 样本
- 冻结清单（哪些脚本、样本、hook 家族本轮后不再继续扩张）
- 新主模式 / 新主专题 / 新 entrypoints
- 下一轮最便宜 probe
- 是否进行全网搜索（`mcp__web-search__search_bing`）或 `browser-controlled reuse`
- 本轮是否跳过 `完整边界确认 / 标准家族识别 / direct-call / 搜索纠偏 / knowledge检索`
- 本轮停掉的是哪个 `microRoute`
- 本轮是否开启过 `deepDivePermit`；若开启，为什么继续 / 为什么结束
- 本轮新增的 `highValueEvidence` 是什么；若没有，为什么还不该停专题
- 若涉及阶段回退：回退路径、保留内容、回退后第一条 probe

## 推荐文件

- `run/retrospective.md`
- `state/route-plan.md`
- `state/progress.md`

## 推荐结构

```text
## 触发原因
## 已降级假说
## 保留证据
## 作废解释
## 冻结清单
## 本轮跳过了什么，为什么
## 本轮 microRoute / 是否开启 deepDivePermit
## 本轮新增的 highValueEvidence
## 新主模式 / 新主专题 / 新 entrypoints
## 下一轮最便宜 probe
## 是否进行全网搜索（`mcp__web-search__search_bing`）/ browser-controlled reuse
```

## 反模式

- “换个方向试试”但没有新 probe
- 只写本轮失败，不写为什么要停损
- 继续沿着被 retrospective 判定为低价值的脚本族扩张
- retrospective 后仍继续第 4 个同类统计脚本，却没有新的边界、family、direct-call 或全网搜索（`mcp__web-search__search_bing`）证据
- 机械执行”两轮停损”，却没有区分当前处于 foundation / probe / deep-dive 哪一层
- 没有说明停掉的是哪个微路线、为什么不该停整个专题
- 开了 `deepDivePermit`，却没有写子目标、里程碑、退出条件或高价值证据
- 在 foundation 阶段因为没有”验收证据”就 pivot，忽略已建立的基础 mapping/infrastructure 价值
- 阶段回退后从头开始，丢弃了可保留的 infrastructure（回退应保留已建立的 hook/carrier/entrypoint 链路）
- 把阶段回退当作失败而触发 retrospective，而不是先尝试降级到低阶段继续推进
