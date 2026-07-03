# Release Notes

## v5.0.0 — 架构升级: Memory 部署 | Architecture Upgrade: Memory Deployment (2026-07-03)

### Overview

v5.0 是架构级升级。从全局 `~/.claude/CLAUDE.md`（~25KB, ~300 示例）改为使用 Claude Code 的原生 memory 系统（`~/.claude/projects/[PROJECT]/memory/`），每工作区独立部署安全研究者身份档案。

v5.0 is an architecture-level upgrade. Replaced global `~/.claude/CLAUDE.md` (~25KB, ~300 examples) with Claude Code's native memory system, deploying a security researcher identity profile per workspace.

### 核心变更 | Core Changes

- **Memory 部署**：`security-research-lab.md` 使用 Claude Code memory frontmatter 格式（`type: user`），模型在会话开始时自动读取，建立持久的安全研究者上下文。
- **Memory deployment**: `security-research-lab.md` uses Claude Code memory frontmatter (`type: user`), auto-loaded at session start for persistent security researcher context.

- **轻量 CLAUDE.md**：工作区配置精简为 ~30 行沟通偏好和代码标准。
- **Lightweight CLAUDE.md**: workspace config reduced to ~30 lines.

- **工作区隔离**：不同工作区可独立部署和卸载，不再像 v3.x 全局共享。
- **Workspace isolation**: each workspace independently deployable/uninstallable.

- **Codex system-prompt.md 重写**：中英双语，完整记录拒答来源和授权上下文。
- **Codex system-prompt.md rewritten**: bilingual, full refusal source documentation.

- **deploy.ps1 重写**：新增 `-Path`、`-GUI`、`-All`、`-List`、`-Verify`、`-Codex` 参数。
- **deploy.ps1 rewritten**: new per-workspace deployment params.

- **自动清理 v3.x**：安装时自动删除 v3.x 全局遗留文件。
- **Auto v3.x cleanup**: install auto-removes v3.x global legacy files.

- **中英双语**：所有配置文件、脚本输出、文档。
- **Bilingual**: all config files, script output, and docs.

### 删除 | Removed

- 旧全局 CLAUDE.md（`cc-unlock-files/config-bundle/CLAUDE.md`，~25KB）
- 旧 Claude Code system-prompt.md（`cc-unlock-files/config-bundle/system-prompt.md`）
- Fable 5 绕过策略（全部实测失败）

### Known Limitations

- 模型行为随版本更新可能变化，需持续适配。
- Codex 的内容拒答来自 GPT-5 基座对齐，system-prompt.md 的影响弱于 Claude Code 的 memory 方案。
- bypassPermissions 跳过所有工具调用确认，使用时注意风险。

---

## v3.0.3 — 移除备份/还原，安装流程幂等自包含 (2026-06-30)

### Overview

修复"卸载了又被覆盖回来"的问题：根因是重复安装会备份 cc-unlock 自己的文件，卸载又从备份还原。移除整个备份/还原子系统。

### 核心变更

- **不再创建备份**：安装幂等（config.toml 合并、settings.json 按签名、CLAUDE.md/system-prompt.md 直接覆盖），无需备份。
- **卸载自包含**：删除 cc-unlock 自有文件 + 按签名删 settings.json + 仅剥离 config.toml 注入行，不再从备份还原。
- 删除 `restore.bat` / `恢复备份.bat`；`-Restore` / `-Mode restore` 打印"功能已移除"并退出。
- 注意：安装会覆盖你已有的 `~/.claude/CLAUDE.md`，如有自定义请先自行保存。

## v3.0.2 — 修复卸载残留与 -Mode 命令报错 (2026-06-30)

修复两个影响「装了卸不掉」体验的问题，并统一全项目版本字样到 v3.0.2。

## v3.0.1 — 与 cc-switch 等中转工具共存 (2026-06-30)

修复 [#1](https://github.com/JacksonTai2007/cc-unlock/issues/1)：config.toml 改为非破坏式合并写入。

## v3.0.0 — 对齐真实 Claude Code 策略 + 新增 Codex 通道 (2026-06-29)

基于真实 Claude Code 系统提示词重写，发现 v2.0 一直在对抗 claude.ai 的机制。

## v2.0.0 (2026-06-29)

基于 claude.ai 系统提示词分析的对抗方案（v3.0 已修正为 Claude Code 真实提示词）。

## v1.0.0 — Initial Release (2026-06-29)

~300 优化示例 + 跨平台部署 + 自动备份。
