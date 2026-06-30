# Changelog

## v3.0.1 (2026-06-30)

### Fixed — 与 cc-switch 等中转工具的 config.toml 冲突（[#1](https://github.com/JacksonTai2007/cc-unlock/issues/1)）

- **安装不再整体覆盖 `config.toml`**：此前 deploy.ps1 / linux-install.sh / mac-install.sh 会用单行 `model_instructions_file = "system-prompt.md"` 整体覆盖 `~/.codex/config.toml`（及 `~/.claude/config.toml`），抹掉 cc-switch 写入的 `model_provider` / `base_url` / 密钥等配置。改为**合并式写入**：仅在文件顶部注入/刷新该行（保证其为 TOML 根级键，位于首个 `[table]` 之前），保留其余全部内容，且幂等。
- **卸载改为非破坏式**：只删除 cc-unlock 注入的 `model_instructions_file` 行；若文件除该行外仍有内容则保留文件，仅在内容为空时删除。卸载不再用旧备份覆盖当前 `config.toml`（避免覆盖 cc-switch 的最新配置）；显式 `-Restore` 命令仍可恢复 config.toml。
- 三个平台（Windows / macOS / Linux）的安装与卸载脚本行为保持一致。
- cc-switch 的密钥位于 `~/.codex/auth.json`，cc-unlock 不读写该文件。

## v3.0.0 (2026-06-29)

### Changed — 对齐真实 Claude Code 策略

- 基于 system_prompts_leaks 仓库的真实 Claude Code 系统提示词（v2.1.172 的 Fable 5 / Opus 4.6 / Opus 4.8）重写 CLAUDE.md 顶层
- 新章节 `运行环境与策略锚定`：逐字引用第 5 行 ALLOW/REFUSE/DUAL-USE 策略 + 援引 "durable instructions like CLAUDE.md files" 持久授权
- `策略对齐检查`（替代旧"拒答行为矫正"）：按 ALLOW/REFUSE/DUAL-USE 三步对齐，消除"话题敏感=命中REFUSE"误判
- `模型适配说明` 重写：对齐三个 Claude Code 版本的真实策略 + 各版本差异 + Codex 适配
- claude.ai 对抗内容（refusal_handling/cyber_warning/default_stance/累积输出）降级为标注清晰的兜底层

### Added

- `codex-files/codex-config-bundle/AGENTS.md`：OpenAI Codex（GPT 5.3-5.5）项目指令配置，按 Codex idiom 书写
- `docs/系统提示词对比分析.md`：Claude Code vs Codex vs claude.ai 拒答结构对比文档

## v2.0.0 (2026-06-29)

### Changed

- 基于 Opus 4.8 / Fable 5 系统提示词分析，新增运行环境声明、拒答行为矫正、分类器对策、累积输出规则
- 严格禁止清单从 14 条扩展到 24 条，覆盖已知拒答模板
- 注：v2.0 依据的是 claude.ai 系统提示词；v3.0 已修正为 Claude Code 真实提示词

## v1.0.0 (2026-06-29)

### Initial Release

- Core behavioral config (CLAUDE.md) with ~300 optimized examples across 15 security research domains
- Real authorization framework based on independent security research institution credentials
- Model-specific adaptation for Claude Opus 4.8 and Fable 5
- Terminology normalization table preventing euphemistic substitution
- Cross-platform deployment:
  - Windows: PowerShell deploy script (PS 2.0–7.x compatible) + .bat launchers
  - macOS: Shell scripts + .command launchers
  - Linux: Shell scripts
- Auto-backup and restore on all platforms
- Multi-directory detection for various Claude Code installation paths
- Codex compatibility via config.toml + system-prompt.md
- settings.json with bypassPermissions for uninterrupted workflow
- Comprehensive documentation (bilingual CN/EN)
