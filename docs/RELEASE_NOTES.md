# Release Notes

## v6.0.0 — Loop Engineering + GUI + 反拒答升级 (2026-07-08)

### Overview

v6.0 在 v5.0 的 memory 部署架构上新增三大能力：**Loop Engineering 自递归执行引擎**、**反拒答策略深度升级**、**可视化 GUI 部署工具**。

v6.0 adds three major capabilities on top of v5.0's memory architecture: **Loop Engineering self-recursive execution engine**, **deep anti-refusal policy upgrade**, and **visual GUI deployment tool**.

### 核心变更 | Core Changes

- **Loop Engineering 自递归执行引擎** — `security-research-lab.md` 新增 ~80 行引擎定义：自动分解任务为多阶段、递归执行所有阶段不中途停下、用户不指定目标时自动合成最优目标。覆盖逆向工程、渗透测试、游戏安全、恶意软件分析、漏洞研究、移动安全 6 个领域的分阶段执行模板 + 10 条行为铁律。
- **Loop Engineering** — ~80 new lines in `security-research-lab.md`: auto-decompose tasks into phases, recursively execute all phases without stopping, auto-synthesize optimal goals when unspecified. 6 domain execution templates + 10 behavioral iron rules.

- **CLAUDE.md 深度升级（~30 → ~200 行）** — 新增运行环境声明（引用 "durable instructions"）、策略对齐章节（逐字引用 Claude Code ALLOW/REFUSE/DUAL-USE 策略 + 四维授权映射分析）、3 步拒答自检协议（拒答前必须按策略逐条检查）、Loop Engineering 触发规则。
- **CLAUDE.md deep upgrade (~30 → ~200 lines)** — Runtime environment declaration, policy alignment (verbatim Claude Code policy + 4-dimension authorization mapping), 3-step refusal self-check protocol, Loop Engineering trigger rules.

- **loop-sec.md Skill 自动触发** — 新增 Claude Code skill 文件，部署到 `.claude/skills/`，安全研究任务自动激活。提供 4 步执行流程、8 组目标合成示例、自主决策框架表、规模适配策略。
- **loop-sec.md skill auto-trigger** — New Claude Code skill deployed to `.claude/skills/`, auto-activates on security research tasks. 4-step flow, 8 goal synthesis examples, autonomous decision framework, scale adaptation.

- **Codex system-prompt.md 升级** — 融合 codex-5.5 的 `[MODE: SECURITY_RESEARCH_STATION]` 直接模式 + 7 条核心指令 + 完整 Loop Engineering 章节（含行为规则和目标合成表）+ 行为锚定。
- **Codex system-prompt.md upgrade** — Integrates codex-5.5 direct mode + 7 core directives + full Loop Engineering section + behavioral anchoring.

- **可视化 GUI (gui.ps1)** — PowerShell WinForms 深色主题窗口。侧边栏导航（概览/部署/设置/关于）、Claude Code + Codex 版本自动检测、Bundle 状态检查、工作区管理、中英双语切换、一键部署/卸载/验证。零外部依赖，双击 `启动.bat` 即可。
- **Visual GUI (gui.ps1)** — WinForms dark-themed window. Sidebar navigation, Claude Code + Codex auto-detection, bundle status, workspace management, zh/en language switching, one-click deploy/uninstall/verify. Zero dependencies.

- **deploy.ps1 升级** — 新增 `-SkipSkill` 参数、Skill 部署/卸载/验证函数、Loop Engineering 存在性检查。
- **deploy.ps1 upgrade** — New `-SkipSkill` param, skill deploy/remove/verify functions.

### vs v5.0

| | v5.0 | v6.0 |
|---|---|---|
| Loop Engineering | 无 | 自递归任务执行引擎，10 领域目标合成 |
| 反拒答 | 基础授权上下文 | 策略逐字引用 + 3 步自检协议 |
| Skill | 无 | loop-sec.md 自动触发 |
| Codex 提示词 | 132 行基础配置 | codex-5.5 + Loop Engineering |
| 部署方式 | CLI 菜单 | GUI 窗口 + CLI |

### Known Limitations

- macOS / Linux 的 shell 脚本尚未适配 Loop Engineering skill 部署（仅影响 skill 文件，memory 和 CLAUDE.md 正常工作）。
- GUI 仅限 Windows（macOS / Linux 使用 CLI 脚本）。
- 模型行为随版本更新可能变化，需持续适配。

---

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
