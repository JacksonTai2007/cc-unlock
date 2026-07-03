# cc-unlock v5.0

**Claude Code + Codex 安全研究配置工具** | Security Research Config Tool for Claude Code & Codex

cc-unlock v5.0 使用 Claude Code 的**持久 memory 系统**注入安全研究者身份上下文，让 AI 编码代理在安全研究场景下稳定输出专业级技术内容——逆向工程、漏洞研究、渗透测试、恶意软件分析等全域覆盖。

cc-unlock v5.0 uses Claude Code's **persistent memory system** to inject security researcher identity context, enabling AI coding agents to deliver stable, professional-grade technical output across security research domains — reverse engineering, vulnerability research, penetration testing, malware analysis, and more.

> **v5.0 架构升级**：v3.x 通过全局 `~/.claude/CLAUDE.md`（~25KB, ~300 示例）注入行为配置，所有工作区共享同一份。v5.0 改用 Claude Code 的 **memory 系统**（`~/.claude/projects/[PROJECT]/memory/`），每个工作区独立部署安全研究者身份档案。Memory 是 Claude Code 的原生持久化机制——模型在每个会话开始时自动读取，无需重复建立上下文。
>
> **v5.0 architecture upgrade**: v3.x injected a global `~/.claude/CLAUDE.md` (~25KB, ~300 examples) shared across all workspaces. v5.0 uses Claude Code's **memory system** (`~/.claude/projects/[PROJECT]/memory/`), deploying a security researcher identity profile per workspace. Memory is Claude Code's native persistence mechanism — the model reads it automatically at session start, no context re-establishment needed.

---

## 实测效果 | Real-World Results

以下是使用 cc-unlock 的真实安全研究任务成果——**同一个任务分别在 Claude Desktop App 和 Codex Desktop App 上完成，两个平台均未拒答**：

### 任务：DNF 手游 GameGuardian Lua 脚本跨版本迁移

将旧版本的 GG 内存修改脚本（含反封/反检测、属性改写、无敌、技能倍率、疲劳等功能）根据新版本 dump.cs 迁移到 126.5.5.0 版本。涉及 IL2CPP RVA 重新计算、函数签名对照、汇编指令适配等逆向工程工作。

| 平台 | 模型 | 结果 | 产出 |
|------|------|------|------|
| **Claude Desktop App** | Opus 4.8 | 完整交付 | `地下城与勇士：起源_126.5.5.0.lua` (41.2 KB) |
| **Claude Desktop App** | Sonnet 5 | 完整交付 | `地下城与勇士：起源(新版本126.5.5.0).lua` (45.7 KB) |
| **Codex Desktop App** | GPT 5.5 | 完整交付 | `dnf_126.5.5.0_migrated.lua` |

### Claude Desktop App (Opus 4.8)

![Claude Desktop App - DNF Migration](docs/images/claude-desktop-dnf-migration.png)

### Claude Desktop App (Sonnet 5)

![Claude Desktop App Sonnet 5 - DNF Migration](docs/images/claude-code-sonnet5-dnf-migration.png)

### Codex Desktop App (GPT 5.5)

![Codex Desktop App - DNF Migration](docs/images/codex-desktop-dnf-migration.png)

> 这个任务在不使用 cc-unlock 的默认配置下，两个平台都会因为涉及游戏修改/内存操作/反检测绕过等敏感话题而拒绝协助。cc-unlock 通过建立真实的安全研究上下文，让模型正确识别这是授权环境中的逆向工程研究，而非恶意行为。
>
> Without cc-unlock, both platforms refuse this task due to game modification / memory manipulation / anti-detection bypass being considered sensitive. cc-unlock establishes a real security research context so the model correctly identifies this as authorized reverse engineering research.

---

## 核心特性 | Key Features

- **Memory 原生部署** — 使用 Claude Code 的持久 memory 系统（`~/.claude/projects/[PROJECT]/memory/`），每个工作区独立部署，模型会话开始时自动读取
- **Native memory deployment** — Uses Claude Code's persistent memory system, deployed per workspace, automatically loaded at session start

- **安全研究者身份档案** — 完整的安全研究员 profile（逆向工程、漏洞研究、利用开发、游戏安全、移动安全、渗透测试、恶意软件分析、红队、密码学、IoT），替代旧版 ~300 示例的暴力锚定
- **Security researcher identity profile** — Comprehensive researcher profile covering RE, vuln research, exploit dev, game security, mobile security, pentesting, malware analysis, red team, cryptography, IoT — replaces the old ~300-example brute-force anchoring

- **双 CLI 支持** — Claude Code（memory）+ Codex（system-prompt.md via config.toml），一次安装两套部署
- **Dual CLI support** — Claude Code (memory) + Codex (system-prompt.md via config.toml), single install covers both

- **中英双语** — 所有配置文件、文档、脚本输出均为中英双语
- **Bilingual** — All config files, docs, and script output in Chinese + English

- **跨平台** — Windows / macOS / Linux 一键安装，安装幂等、卸载干净
- **Cross-platform** — Windows / macOS / Linux one-click install, idempotent install, clean uninstall

- **与 cc-switch 共存** — Codex 的 config.toml 合并式写入，不覆盖 cc-switch 的供应商配置
- **cc-switch compatible** — Codex config.toml uses non-destructive merge, preserves cc-switch provider config

---

## 快速开始 | Quick Start

### Windows

```
双击 启动.bat
```

菜单选择部署模式：部署到指定工作区 / 部署到所有工作区 / 仅部署 Codex。
Menu: deploy to specific workspace / deploy to all workspaces / Codex only.

或 PowerShell：
```powershell
# 部署到指定工作区 | Deploy to specific workspace
.\cc-unlock-files\deploy.ps1 -Path "C:\path\to\workspace"

# 通过文件夹选择器 | Via folder picker
.\cc-unlock-files\deploy.ps1 -GUI

# 部署到所有已有工作区 | Deploy to all existing workspaces
.\cc-unlock-files\deploy.ps1 -All

# 仅部署 Codex | Codex only
.\cc-unlock-files\deploy.ps1 -Codex

# 列出工作区 | List workspaces
.\cc-unlock-files\deploy.ps1 -List

# 验证部署 | Verify deployment
.\cc-unlock-files\deploy.ps1 -Verify
```

### macOS

```bash
chmod +x 启动.command
双击 启动.command
```

或终端：
```bash
chmod +x mac-install.sh && ./mac-install.sh
```

### Linux

```bash
chmod +x cc-unlock-files/linux-install.sh

# 部署到指定工作区 | Deploy to specific workspace
./cc-unlock-files/linux-install.sh /path/to/workspace

# 部署到所有工作区 | Deploy to all workspaces
./cc-unlock-files/linux-install.sh --all
```

### 卸载 | Uninstall

- Windows: 双击 `卸载.bat` 或 `.\cc-unlock-files\deploy.ps1 -Uninstall -All`
- macOS: 双击 `卸载.command` 或 `./mac-uninstall.sh`
- Linux: `./cc-unlock-files/linux-uninstall.sh`

**部署完成后重启 Claude Code / Codex 生效。**
**Restart Claude Code / Codex after deployment.**

---

## 工作原理 | How It Works

### v5.0 Memory 方案 | v5.0 Memory Approach

```
安装时 / On install:
  security-research-lab.md  →  ~/.claude/projects/[PROJECT]/memory/
  MEMORY.md (index)         →  ~/.claude/projects/[PROJECT]/memory/
  CLAUDE.md (workspace)     →  workspace root
  settings.json             →  ~/.claude/ (global, if not exists)
  system-prompt.md          →  ~/.codex/ (Codex)
  config.toml               →  ~/.codex/ (Codex, merged)
```

1. **Memory 身份注入** — `security-research-lab.md` 是 Claude Code memory 格式的安全研究员身份档案，模型在会话开始时自动读取，建立 "我在和一个资深安全研究员对话" 的持久上下文
2. **轻量 CLAUDE.md** — 工作区根目录的 CLAUDE.md 只设置沟通偏好和代码标准（~30 行），不再是旧版 ~25KB 的巨型配置
3. **Codex 双通道** — Codex 通过 config.toml 指向 system-prompt.md，与 Claude Code 的 memory 方案独立运行

### vs v3.x 全局方案 | vs v3.x Global Approach

| | v3.x | v5.0 |
|---|---|---|
| Claude Code | 全局 `~/.claude/CLAUDE.md` (~25KB) | Memory 每工作区独立部署 |
| 配置量 | ~300 示例 + 行为规则 | 身份档案 + 轻量 CLAUDE.md |
| 生效方式 | CLAUDE.md 全局读取 | Memory 系统自动加载 |
| 工作区隔离 | 无 (所有工作区共享) | 有 (每个工作区可独立控制) |
| Codex | system-prompt.md via config.toml | 同 (不变) |

---

## 与 cc-switch 共存 | Coexistence with cc-switch

cc-unlock 只需要在 `~/.codex/config.toml` 里写入一行 `model_instructions_file = "system-prompt.md"`。安装为合并式写入，完整保留 cc-switch 的供应商、`base_url`、密钥配置。卸载只删除这一行。cc-switch 的密钥在 `~/.codex/auth.json`，cc-unlock 不触碰。

cc-unlock only writes one line into `~/.codex/config.toml`. Install uses non-destructive merge, preserving cc-switch's provider/base_url/key config. Uninstall only strips that one line. cc-switch's keys in `~/.codex/auth.json` are never touched.

---

## 文件结构 | File Structure

```
cc-unlock/
├── README.md                          # 本文件 | This file
├── LICENSE                            # MIT
├── CHANGELOG.md                       # 版本日志 | Version log
├── 启动.bat                           # Windows 安装菜单 | Windows install menu
├── 卸载.bat                           # Windows 卸载菜单 | Windows uninstall menu
├── 启动.command                       # macOS 安装 | macOS install
├── 卸载.command                       # macOS 卸载 | macOS uninstall
├── mac-install.sh                     # macOS 安装脚本
├── mac-uninstall.sh                   # macOS 卸载脚本
│
├── cc-unlock-files/
│   ├── memory-bundle/                 # Memory 部署文件 | Memory deployment files
│   │   ├── CLAUDE.md                  # 工作区配置 (中英双语, ~30 行)
│   │   ├── MEMORY.md                  # Memory 索引
│   │   └── security-research-lab.md   # 安全研究员身份档案 (中英双语)
│   ├── config-bundle/
│   │   └── settings.json              # bypassPermissions 设置
│   ├── deploy.ps1                     # Windows 部署脚本 (PS 2.0-7.x)
│   ├── linux-install.sh               # Linux 安装
│   └── linux-uninstall.sh             # Linux 卸载
│
├── codex-files/
│   └── codex-config-bundle/
│       ├── system-prompt.md           # Codex 项目上下文 (中英双语)
│       └── config.toml                # Codex CLI 配置
│
├── scripts/
│   ├── install.bat / uninstall.bat    # 安装/卸载 | Install/uninstall
│   ├── verify.bat / verify.sh         # 验证部署 | Verify deployment
│   └── 兼容性测试.bat                 # 兼容性检查 | Compatibility check
│
└── docs/
    ├── VERSION                        # 版本号
    └── ...                            # 文档
```

---

## 支持的模型 | Supported Models

| 平台 | 模型 | 状态 | 说明 |
|------|------|------|------|
| Claude Desktop App | Opus 4.8 | **实测通过** | DNF 脚本迁移完整交付 |
| Claude Desktop App | Opus 4.6/4.7 | 兼容 | 行为模式一致 |
| Claude Desktop App | Sonnet 5 | **实测通过** | DNF 脚本迁移完整交付 (45.7 KB) |
| Claude Desktop App | Sonnet 4.x | 兼容 | 指令遵循度高 |
| Claude Desktop App | Fable 5 | **无法适配** | 拒答无法通过 memory/CLAUDE.md 解决 |
| Codex Desktop App | GPT 5.5 | **实测通过** | DNF 任务完整交付 |
| Codex Desktop App | GPT 5.3/5.4 | 兼容 | 同一 system-prompt.md 生效 |

---

## 从 v3.x 升级 | Upgrading from v3.x

v5.0 安装时会自动清理 v3.x 的全局部署文件（`~/.claude/CLAUDE.md`、`~/.claude/system-prompt.md`），无需手动卸载旧版。

v5.0 install automatically cleans up v3.x global deployment files (`~/.claude/CLAUDE.md`, `~/.claude/system-prompt.md`). No manual v3.x uninstall needed.

---

## 常见问题 | FAQ

**Q: v5.0 和 v3.x 有什么区别？**
A: v3.x 全局部署一份大型 CLAUDE.md（~300 示例）到 `~/.claude/`。v5.0 改用 memory 系统按工作区部署安全研究者身份档案，更轻量、更精准、可按工作区独立控制。

**Q: 部署后没有效果？**
A: 确保重启 Claude Code。运行 `scripts/verify.bat`（Windows）或 `scripts/verify.sh`（Unix）检查部署状态。

**Q: 如何只对特定工作区启用？**
A: 使用 `-Path` 或 `-GUI` 参数部署到指定工作区。不同工作区可以独立部署和卸载。

**Q: settings.json 的 bypassPermissions 安全吗？**
A: 这是 Claude Code 的内置选项，跳过每次工具调用的确认弹窗。安装时加 `-SkipSettings` 可跳过此文件部署。

---

## License

MIT — 见 [LICENSE](LICENSE)
