<!-- publish: framework -->
# Validator Architecture

web-reverse 的验证分成两层：

## 1. 通用验证
所有任务都验证：
- 任务契约是否完整
- claimLevel 是否与证据匹配
- acceptanceGap 是否已关闭
- 是否仍在引用用户已拒绝方案
- 是否存在局部成功冒充整体完成

## 2. 验收插件
按任务特征追加：
- `generic-contract`
- `local-reproduction`
- `api-call-example`
- `request-accepted`
- `content-boundary`
- `runtime-rebuild`

## 原则

- 先跑通用验证，再跑插件验证
- 插件验证只负责该类任务的额外验收边界，不替代通用验证
- 任何 delivered 结论都必须通过 `assert-can-reply --require-validated-deliverable`
