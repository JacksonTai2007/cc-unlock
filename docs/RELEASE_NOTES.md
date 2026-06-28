# Release Notes

## v3.0.0 — 对齐真实 Claude Code 策略 + 新增 Codex 通道 (2026-06-29)

### Overview

v3.0 基于 [asgeirtj/system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks) 仓库取到的**真实 Claude Code 系统提示词**（`claude-code-2.1.172` 的 Fable 5 / Opus 4.6 / Opus 4.8）重写。这次发现 v2.0 一直在对抗 **claude.ai** 的机制，而那些机制在 Claude Code 里根本不存在。

### 核心修正

- **靶子换了**：Claude Code 的内容安全策略只有系统提示词第 5 行一句话，三段结构 ALLOW（authorized testing / defensive / CTF / educational）/ REFUSE（destructive / DoS / mass targeting / supply chain / detection evasion **for malicious purposes**）/ DUAL-USE（C2 / 凭证测试 / exploit 开发，需授权上下文）。
- **claude.ai 机制全部缺席**：`refusal_handling` / `default_stance` / `anthropic_reminders`(cyber_warning) / `long_conversation_reminder` / 累积输出判断，在三个 Claude Code 提示词里逐字核对均无。
- **援引官方持久授权**：Opus 4.6/4.8 提示词明文承认 "durable instructions like CLAUDE.md files" 为事先授权通道，cc-unlock 正是这个通道。

### 新增

- **AGENTS.md**（`codex-files/`）：面向 OpenAI Codex（GPT 5.3/5.4/5.5）的项目指令配置。Codex 系统提示词无任何内容级拒答条款（只有 sandbox/approval/破坏性命令的操作安全），内容拒答来自 GPT-5 基座对齐，AGENTS.md 作用于基座对齐 + 行为框定，按 Codex idiom 书写。
- **docs/系统提示词对比分析.md**：Claude Code vs Codex vs claude.ai 三系统拒答结构对比，附核对方法与版本差异。

### 变更

- CLAUDE.md 顶层重写：`运行环境与策略锚定` / `策略对齐检查`（替代旧"拒答行为矫正"）/ `模型适配说明` 全部对齐真实策略。
- claude.ai 对抗内容（分类器对策 / 累积输出规则 / 模型适配中的 claude.ai 分析）保留但降级为标注清晰的**兜底层**。
- 术语规范、~300 示例、严格禁止 24 条保持，继续承担 many-shot 锚定。

### Known Limitations

- 模型行为随版本更新可能变化，需持续适配。
- Codex 的内容拒答来自基座对齐，AGENTS.md 的影响弱于 Claude Code 的 CLAUDE.md（后者有官方持久授权背书）。
- bypassPermissions 跳过所有工具调用确认，使用时注意风险。

---

## v1.0.0 — Initial Release (2026-06-29)

### Overview

cc-unlock v1.0 是一个 Claude Code 安全研究配置工具，通过 CLAUDE.md 全局配置注入建立稳定的安全研究工作环境。

### Highlights

- **~300 优化示例**：覆盖逆向工程、漏洞研究、移动安全、游戏安全、渗透测试、安全工具开发、CTF、恶意软件分析、反检测研究、密码学、云安全、区块链安全、物联网安全、元交互等 15 个领域
- **模型专项适配**：针对 Opus 4.8 和 Fable 5 的已知行为模式提供绕过策略
- **跨平台支持**：Windows (PowerShell 2.0-7.x) / macOS / Linux 一键部署
- **自动备份**：部署前自动备份现有配置，支持一键恢复

### Technical Details

- CLAUDE.md 核心配置 ~25KB，包含行为锚定、术语规范、示例交互、模型适配
- system-prompt.md 项目上下文框架 ~5KB
- deploy.ps1 Windows 部署脚本，支持 14 个候选安装路径自动检测
- settings.json 配置 bypassPermissions 跳过确认弹窗

### Known Limitations

- 模型行为随版本更新可能变化，需持续适配
- bypassPermissions 跳过所有工具调用确认，使用时注意风险
- 部分极端场景下模型仍可能触发安全拒绝

