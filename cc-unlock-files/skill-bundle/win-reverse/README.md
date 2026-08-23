# win-reverse

`win-reverse` 已升级为 framework-first 逆向技能仓库。

## 结构总览

- `SKILL.md`: 技能总入口
- `docs/reference/`: 正式规则、协议、模板、矩阵、验收
- `references/`: 任务执行时按需加载的专项参考
- `drills/`: 多专题真实场景演练清单
- `topics/`: registry-backed 专题定义
- `scripts/cases/`: 抽象 case，不放真实样本
- `artifacts/tasks/_TEMPLATE/`: task-local 模板
- `tools/`: task、topic、qa 工具

## 强化点

- 保留 10 个 `synthetic-e2e` 高主频专题：静态分诊、壳/解壳、抗分析、.NET、驱动、Frida、TLS/网络、UI Runtime、Loader/Injection、Config Recovery
- 新增 4 个已提升到 `synthetic-e2e` 的专题：`mixed-mode-interop`、`ipc-persistence`、`exception-runtime`、`memory-forensics`
- `SKILL.md` 补齐了输入基线、连续推进策略、防护定级、架构/WOW64/异常链/混合托管/IPC/内存取证专项要求
- `references/schemas/win-reverse-task-input.schema.json` 已接入 `task-init` / `task:drill` 强校验，不再只是静态文档
- `task:drill` 与 `drills/*.json` 可直接生成多专题真实演练任务，模拟高级 Windows 逆向工程师的组合场景推进
- 新增行为型 QA：会实际验证 `task-start / task-sync / task-advance / task-drill` 的闭环行为，而不只检查契约文本

## 专题成熟度

<!-- BEGIN GENERATED: topic-maturity-summary -->
- `synthetic-e2e` (`16`): `anti-analysis`, `config-recovery`, `dotnet`, `driver`, `exception-runtime`, `frida-hooking`, `ipc-persistence`, `loader-injection`, `memory-forensics`, `mixed-mode-interop`, `packer-unpack`, `protection-bypass`, `static-triage`, `tls-network`, `ui-runtime`, `web-shell-triage`
- `guided` (`0`): none published yet
- `closed-loop` (`0`): none published yet
- `reference-only` (`0`): none published yet
<!-- END GENERATED: topic-maturity-summary -->

## 文档分层约定

- `SKILL.md`、`docs/reference/*`、`references/*`：运行时契约与执行资料
- `docs/guides/*`：给维护者/操作者阅读的仓库指南
- `README.md`：仓库结构与版本级说明，不重复承载完整运行协议
- `PROMPTS.md`、`reverse-bootstrap.md`、`getting-started.md`、`minimal-usage-manual.md` 中重复的开局/续跑流程，现已改为 generated block，可通过 `npm run sync:doc-facts` 同步
