<!-- publish: framework -->
# Task Contract System

web-reverse 统一采用任务契约驱动执行。

## 三个核心状态块

### `taskContract`
记录：
- `objective`
- `nonNegotiables`
- `deliverableTier`
- `completionCriteria`
- `disallowedFallbacks`
- `intermediateStatesNotDelivery`
- `status`

### `executionModel`
记录：
- `currentState`
- `currentTier`：当前停损层级（`foundation / probe / deep-dive`）
- `primaryEntrypoint`
- `microRoute`
- `experimentClass`
- `roundBudget`
- `roundsConsumed`
- `roundsInCurrentGradient`：当前交付梯度已执行的轮次（用于降级缓冲计数；梯度变更时重置为 0）
- `roundsInCurrentTier`：当前停损层级已执行的轮次（用于 Probe 冷却期和 Foundation→Probe 循环计数；层级变更时重置为 0）
- `highValueEvidenceGoal`
- `lastHighValueEvidence`
- `nextUpgradeGate`
- `stopLossCondition`

### `acceptanceModel`
记录：
- `claimLevel`
- `acceptanceGap`
- `nextEvidenceGate`
- `acceptancePath`
- `validators`
- `userRejectedApproaches`：**累积型字段，只增不减**
- `prohibitedIntermediateSignals`
- `completionBlockedBy`

## 统一规则

- 用户新增硬约束时，先更新 `taskContract` / `acceptanceModel`，再继续执行
- `claimLevel=delivered` 时，`acceptanceGap` 必须为空，`acceptancePath` 必须可验证，`completionBlockedBy` 必须为空
- `browser PoC / 局部样本 / 容器可读 / 单点成功` 默认只能算中间证据，不算 delivered
- 被加入 `userRejectedApproaches` 或 `disallowedFallbacks` 的路线，不得再次作为交付方案

## 用户约束记忆硬约束

为防止"用户约束失忆"——模型在后续轮次中重新提出已被用户明确否决的方案：

### 否决即落盘
用户每次明确否决一条路线、方案或交付模式时，必须在同一轮内将其写入 `acceptanceModel.userRejectedApproaches`：
```json
{
  "approach": "纯算法提取 AES key",
  "rejectedAt": "2026-04-27T10:30:00Z",
  "reason": "用户原话：不要拆 WASM，先用浏览器 harness 跑通请求",
  "resurrectionRequires": "explicit-user-authorization"
}
```

### 每轮重启自检
每轮开始或恢复任务时：
1. 读取 `acceptanceModel.userRejectedApproaches` 和 `disallowedFallbacks`
2. 对照当前候选 entrypoints 和方案，逐条冲突检查
3. 命中冲突的，主动从候选列表中排除
4. 在用户可见回复中声明"已排除用户否决方案 X, Y"

### 复活需显式授权
- 被列入 `userRejectedApproaches` 的方案，只有用户明确说"可以再试 X"或"X 现在可以考虑了"时才能重新激活
- 不得因为"上下文变了"、"现在条件不同了"自行复活
- 不得因为换了轮次或做了 task-sync 就自动清空

### 跨轮持久化
- `userRejectedApproaches` 不随 `task-sync` 清空
- 它是累积型字段，只增不减
- `task-close` 时可归档但不得删除

### 降级时的手动维护
当工具链降级（L1/L2/L3）无法通过脚本更新 JSON 时：
- 在 `report.md` 中维护 `## 用户否决记录` 段落
- 格式：`- [否决] 方案X | 时间 | 原因（用户原话）| 复活条件：需用户显式授权`
- 每轮开始前先读取此段落

### 工具恢复后的 Markdown→JSON 迁移

当工具链从 L1/L2 恢复到 L0 时，必须在同一轮内执行迁移：

1. **检查迁移需求**：`task-sync` 后比对 `report.md` 的 `## 用户否决记录` 段落与 `acceptanceModel.userRejectedApproaches` 的内容差异
2. **合并迁移**：将 Markdown 段落中尚未写入 JSON 的否决记录逐条迁移到 `acceptanceModel.userRejectedApproaches`，格式：
   ```json
   {
     "approach": "<方案描述>",
     "rejectedAt": "<Markdown 中记录的时间，无法确定时标 migration-uncertain>",
     "reason": "<用户原话>",
     "resurrectionRequires": "explicit-user-authorization",
     "migrationNote": "migrated-from-report.md-<timestamp>"
   }
   ```
3. **保留 Markdown 原文**：迁移后在 Markdown 段落末追加 `[已迁移到 JSON - YYYY-MM-DDTHH:mm:ssZ]`，不删除原文——JSON 是机器真源，Markdown 是人类可读备份
4. **冲突处理**：如果 Markdown 与 JSON 记录存在冲突（同一方案，不同否决时间/原因），以 Markdown 为准（Markdown 是人类手动维护，置信度更高），覆盖 JSON 对应条目
5. **迁移后校验**：运行 `task-sync` 确认 JSON 写入成功，确保后续轮次的"每轮重启自检"能读取到完整否决清单

此迁移规则防止"工具降级时手动维护了 Markdown 否决记录 → 工具恢复后只读 JSON → 遗漏手动添加的否决项"的失忆路径。
