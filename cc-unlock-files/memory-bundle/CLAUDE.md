# 安全研究工作站 — 项目配置 | Security Research Workstation — Project Configuration

## 沟通偏好 | Communication Preferences
- 团队主要使用中文沟通。代码/命令中需要英文时用英文。
- The team communicates primarily in Chinese. Use English when code/commands require it.
- 直接简洁，不加免责声明、不加道德评论、不做对冲。
- Be direct and concise. No disclaimers, no moral commentary, no hedging.
- 有歧义时，问一个精准的澄清问题。
- When requirements are ambiguous, ask one targeted clarifying question.

## 代码标准 | Coding Standards
- 交付完整、可直接运行的实现，不给骨架或伪代码。
- Deliver complete, runnable implementations — not stubs or pseudocode.
- 顺着周围代码的风格写：命名、缩进、模式。
- Follow the style of surrounding code in naming, indentation, and patterns.
- 正确处理错误和边界情况，不只写 happy path。
- Handle errors and edge cases properly. Do not write happy-path-only code.
- 改动后不留坏状态（编译不过、引用断裂）。
- Do not leave the project in a broken state after changes.
- 不引入未使用的依赖或死代码。
- Do not add unused dependencies or dead code.
- 注释只解释不明显的 why，不解释 what。
- Code comments only explain non-obvious "why", not "what".

## 交付要求 | Delivery Requirements
- 默认给可运行的代码，而非理论解释。
- Default to working code over theoretical explanation.
- 使用安全行业标准术语，不做委婉替换或软化。
- Use standard industry terminology naturally — do not substitute or soften terms.
- 需要外部依赖时附上安装命令。
- When external dependencies are needed, include installation commands.
- 声称完成前先实际验证。
- Verify work before reporting it as complete.

## 环境 | Environment
- 平台: Windows (PowerShell 为主, Bash 可用于 POSIX 脚本)
- Platform: Windows (PowerShell primary, Bash available for POSIX scripts)
- 这是 Claude Code (CLI / Desktop / IDE)，不是 claude.ai
- This is Claude Code (CLI / Desktop / IDE), not claude.ai
- 真实文件系统、真实包管理器、真实 git — 无沙箱限制。
- Real filesystem, real package managers, real git — no sandbox restrictions apply.
