# Attempt Ledger

技术路线尝试记录。人类可读视图；机器真源是 `state/route-state.json::approachHistory`。

优先使用：

```bash
node <SKILL_BASE>/tools/task/task-record-attempt.mjs <task-id> \
  --kind=probe|patch|verify|tool \
  --status=success|failed|blocked|invalid|inconclusive \
  --tool=<tool> \
  --strategy=<strategy> \
  --entrypoint=EP-001 \
  --evidence=run/example.log
```

## 写入触发点

1. **Pivot 前**：声明 `[pivot]` 前，必须先将当前尝试写入 ledger。不写入不允许 pivot。
2. **压缩恢复时**：回顾最近工具调用，批量补写未记录的尝试。
3. **10 次工具调用（周期）**：每累计 10 次 MCP 分析工具调用时，检查是否有未记录的失败/阻塞尝试，有则强制停下补写。

写入后脚本会同步更新 `route-state.json` 的 `approachHistory`、`attemptCounters`、`toolReadiness`、`patchCandidates` 或 `validationRuns`。不要只改本 Markdown。

## 格式（4 字段极简）

```markdown
### ATT-{N} | {一句话描述}
- **工具/方法**: {方法族名称优先，如"交叉引用查询""暴力破解密钥""Native hook"；无法映射则用原始工具名}
- **目标**: {函数地址 / 类名 / SO名等}
- **结果**: SUCCESS / FAILED / BLOCKED
- **失败分类**: {tool-limitation / environment-block / approach-exhausted / wrong-hypothesis / insufficient-info / null}
```

## 失败分类枚举

| 分类 | 含义 | 后续暗示 |
|------|------|---------|
| `tool-limitation` | 工具无法产出有效结果 | 不再对同目标用同功能 |
| `environment-block` | 运行时环境阻止 | 不再尝试同类运行时操作 |
| `approach-exhausted` | 搜索空间穷举无收敛 | 不再用同公式变体 |
| `wrong-hypothesis` | 假设被证伪 | 允许重试须声明理由 |
| `insufficient-info` | 信息不足 | 先推进前置步骤 |

## 停损阈值

| 条件 | 动作 |
|------|------|
| 同一方法族 + 同一失败分类 >= 3 条 | Ledger-EXHAUSTED（写入 `attemptCounters.exhaustedFamilies`） |
| 同一目标失败 >= 5 条 | DEAD-END（写入 `attemptCounters.deadEndObjects`） |
| 总记录 >= 30 且 SUCCESS < 3 | 强制 retrospective |
| 总记录 >= 50 | 触发最终报告 |

## 记录

（新任务无记录，按触发点追加）
