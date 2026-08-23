<!-- publish: framework -->
# Claim Hygiene

结论必须和证据强度匹配。

## 四级精度

- `provisional`：局部样本、局部 diff、搜索线索、容器可读、局部命中
- `route-ready`：足以指导下一轮 probe / patch / pivot
- `acceptance-ready`：已经拿到贴近目标边界的直接验证证据
- `delivered`：已通过最终验证并满足当前交付梯度

## 常见误升格

以下都不能直接写成“已成功 / 已完成 / 已闭环”：
- `ffprobe` 可读
- `0x47` TS sync byte 正常
- 单个 request baseline 成功
- 只在搜索中命中类似 provider / repo / issue
- 只拿到局部样本或局部 offset 变化

## 报告口径

- 有效：`当前仅到 provisional，内容层验证仍待完成`
- 有效：`当前达到 route-ready，可进入 request-use 验证`
- 无效：`看起来差不多已经成功了`
- 无效：`应该没问题了，先算完成`

## 建议映射到 report.md 的字段

- `claimLevel`: `provisional / route-ready / acceptance-ready / delivered`
- `evidenceStatus`: 当前证据是否覆盖到了验收边界
- `whyNotDeliveredYet`: 如果未完成，明确还差哪一步验证
- `acceptanceGap`: 当前离验收边界还缺哪条直接证据
- `nextEvidenceGate`: 下一轮准备跨过的最小证据门

## 升级门槛写法

- 不要只写“现在还是 provisional”，还要写清 `acceptanceGap`
- 不要只写“下一步继续抓”，还要写清 `nextEvidenceGate`
- 只有当 `nextEvidenceGate` 被实际跨过，才允许把 `claimLevel` 往上升级

## 分模式示例

- 请求验收场景：
  - `route-ready`：已拿到 request-use 证据，但还没 accepted request
  - `acceptance-ready`：浏览器 harness 中已稳定 accepted，待最终交付落盘
- 内容层验证场景：
  - `provisional`：只有容器层 / 流层正常
  - `acceptance-ready`：内容层验证已经通过，待 closeout
- 浏览器可控复用场景：
  - `route-ready`：harness 已能稳定持有会话并命中关键 callsite
  - `delivered`：harness 已稳定完成目标请求/解密/重放，并补齐交付物
