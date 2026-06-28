# Release Notes

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

