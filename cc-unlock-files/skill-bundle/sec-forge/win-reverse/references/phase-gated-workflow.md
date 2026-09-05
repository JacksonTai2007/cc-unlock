# 分阶段工作流详细规则（Phase-Gated Workflow）

本文件包含从 SKILL.md 迁移的分阶段工作流完整规则。SKILL.md 中保留阶段摘要，本文件为详细参考。

## 阶段 A：调查（Investigate）

**允许的工具调用：** Read, Grep, Glob, IDA/r2 反编译/反汇编, 字符串搜索, xref 追踪, WebSearch, Bash（只读命令）

**禁止的工具调用：** Write/Edit 任何代码文件、任何修改目标的操作

**出口产物：** `run/investigation.md` 必须存在且包含：

