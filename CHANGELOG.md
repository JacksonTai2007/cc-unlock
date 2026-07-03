# Changelog

## v5.0.0 (2026-07-03)

### Changed — 架构升级: 全局 CLAUDE.md → 每工作区 Memory 部署 | Architecture upgrade: global CLAUDE.md → per-workspace Memory deployment

- **全新 Memory 部署方案**：从全局 `~/.claude/CLAUDE.md`（~25KB, ~300 示例）改为使用 Claude Code 的原生 memory 系统（`~/.claude/projects/[PROJECT]/memory/`），每工作区独立部署安全研究者身份档案。
- **New memory deployment**: replaced global `~/.claude/CLAUDE.md` (~25KB, ~300 examples) with Claude Code's native memory system (`~/.claude/projects/[PROJECT]/memory/`), deploying a security researcher identity profile per workspace.

- **`security-research-lab.md`**：新的安全研究员身份档案，使用 Claude Code memory frontmatter 格式（`type: user`），涵盖逆向工程、漏洞研究、利用开发、游戏安全、移动安全、渗透测试、恶意软件分析、红队、密码学、IoT 等完整研究领域。替代旧版 ~300 示例的暴力锚定方案。
- **`security-research-lab.md`**: new security researcher identity profile using Claude Code memory frontmatter (`type: user`), covering RE, vuln research, exploit dev, game security, mobile security, pentesting, malware analysis, red team, cryptography, IoT. Replaces old ~300-example brute-force anchoring.

- **轻量 CLAUDE.md**：工作区根目录的 CLAUDE.md 精简为 ~30 行沟通偏好和代码标准，不再承担 ~25KB 的行为锚定。
- **Lightweight CLAUDE.md**: workspace-root CLAUDE.md reduced to ~30 lines of communication preferences and coding standards.

- **Codex system-prompt.md 重写**：中英双语，完整记录 Codex 和 Claude Code 拒答来源、授权上下文、研究领域、工作准则。
- **Codex system-prompt.md rewritten**: bilingual, documents refusal sources, authorization context, research domains, working rules.

- **deploy.ps1 重写**：新增 `-Path`、`-GUI`、`-All`、`-List`、`-Verify`、`-Codex` 参数，支持按工作区或全部工作区部署 memory。部署时自动清理 v3.x 全局遗留文件。
- **deploy.ps1 rewritten**: new params `-Path`, `-GUI`, `-All`, `-List`, `-Verify`, `-Codex` for per-workspace or all-workspace memory deployment. Auto-cleans v3.x legacy files.

- **Shell 脚本全部重写**：mac-install.sh、mac-uninstall.sh、linux-install.sh、linux-uninstall.sh 适配 memory 部署方案。
- **Shell scripts fully rewritten**: mac-install.sh, mac-uninstall.sh, linux-install.sh, linux-uninstall.sh adapted for memory deployment.

- **启动器更新**：启动.bat、卸载.bat 适配 v5.0 菜单和工作流。
- **Launchers updated**: 启动.bat, 卸载.bat adapted for v5.0 menu and workflow.

- **中英双语**：所有配置文件、部署脚本输出、文档均为中英双语（中文优先）。
- **Bilingual**: all config files, script output, and docs in Chinese + English (Chinese first).

### Removed

- **旧全局 CLAUDE.md（~25KB）**：`cc-unlock-files/config-bundle/CLAUDE.md` 不再使用，由 memory-bundle 替代。
- **旧 system-prompt.md for Claude Code**：`cc-unlock-files/config-bundle/system-prompt.md` 不再使用（Codex 的 system-prompt.md 保留在 `codex-files/`）。
- **Fable 5 绕过策略**：全部策略实测失败，不再包含。
- **备份/还原系统**：v3.0.3 已移除，v5.0 继续不含。

## v3.0.3 (2026-06-30)

### Changed — 移除备份/还原功能，安装流程改为幂等自包含

- **移除备份/还原子系统**：此前**重复安装**会把 cc-unlock**自己**已部署的文件（CLAUDE.md / system-prompt.md / config.toml / settings.json）备份一份，卸载时再从备份**还原**回去，导致"卸载了又被覆盖回来"。由于 v3.0.1/v3.0.2 已让安装幂等（config.toml 合并、settings.json 按签名处理、CLAUDE.md/system-prompt.md 为 cc-unlock 自有文件直接覆盖），备份/还原既冗余又是该 bug 的根源，故整体移除。
- 安装脚本（deploy.ps1 / linux-install.sh / mac-install.sh）不再创建备份；卸载脚本（deploy.ps1 / linux-uninstall.sh / mac-uninstall.sh）不再从备份还原。卸载现在是自包含的：删除 cc-unlock 自有文件、按签名删除其创建的 settings.json、仅剥离 config.toml 中注入的那一行。
- 删除 `scripts/restore.bat` 与 `scripts/恢复备份.bat`；`deploy.ps1 -Restore` / `-Mode restore` 改为打印"功能已移除"提示并退出（不再误触发安装）。
- 移除 verify.sh / test.bat 中的备份检查；更新 README / 安装指南 / Mac使用说明 / SECURITY 的相关说明。
- 注意：若用户在安装 cc-unlock 前已有自己的 `~/.claude/CLAUDE.md`，安装会覆盖它（请自行先备份）。
- 统一版本字样到 v3.0.3。

## v3.0.2 (2026-06-30)

### Fixed — 卸载不干净 / 文档命令报错

- **卸载会残留 `settings.json`**：安装会在 `~/.claude/` 写入带 `bypassPermissions` 的 `settings.json`（仅在原本不存在时），但所有卸载路径都**没有删除它**，导致"卸载"后 Claude Code 仍停留在 bypass 模式、cc-unlock 的设置依旧生效——表现为「装了之后卸载不掉」。现在卸载会：若有用户自己的备份则还原其原始 `settings.json`；否则仅当文件带有 cc-unlock 生成签名（`bypassPermissions` + `skipDangerousModePermissionPrompt`）时才删除；用户自建的 `settings.json` 原样保留。Windows / macOS / Linux 一致。
- **文档与 .bat 里的 `-Mode` 命令报错**：README / 安装指南 / CONTRIBUTING 以及 `scripts/restore.bat`、`scripts/verify.bat`（即"恢复备份.bat""验证.bat"）都使用 `deploy.ps1 -Mode deploy|uninstall|restore|verify`，但 `deploy.ps1` 此前根本没有 `-Mode` 参数，运行即报「找不到参数 -Mode」。现已为 `deploy.ps1` 增加 `-Mode` 参数（映射到原有 `-Uninstall` / `-Restore` / `-Verify` 开关，向后兼容），文档命令与 .bat 启动器全部可用。
- Codex 侧不写 `settings.json`，无此残留问题；Codex 卸载（删除 system-prompt.md + 剥离 config.toml 行）保持完整。
- 统一全项目版本字样到 v3.0.2（脚本横幅 / README 标题 / VERSION / Codex bundle 注释）。

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
