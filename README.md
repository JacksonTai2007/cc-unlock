# cc-unlock v3.0

**Claude Code + Codex 安全研究配置工具** | Security Research Config Tool for Claude Code & Codex

cc-unlock 通过项目指令注入（CLAUDE.md + system-prompt.md），让 AI 编码代理在安全研究场景下稳定输出专业级技术内容——逆向工程、漏洞研究、渗透测试、恶意软件分析等全域覆盖。同一套 system-prompt.md 同时适用于 Claude Code 和 Codex。

cc-unlock injects project instructions (CLAUDE.md + system-prompt.md) so AI coding agents deliver stable, professional-grade technical output across security research domains. The same system-prompt.md works for both Claude Code and Codex.

> **v3.0 核心修正**：基于 [system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks) 仓库的**真实 Claude Code 系统提示词**（Fable 5 / Opus 4.6 / Opus 4.8，v2.1.172）重写。Claude Code 的内容安全策略只有系统提示词第 5 行一句话（ALLOW / REFUSE / DUAL-USE 三段），claude.ai 那套 `refusal_handling` / `cyber_warning` / `default_stance` 机制在 Claude Code 里**根本不存在**。v3.0 不再对抗虚构机制，直接对齐真实策略。详见 [docs/系统提示词对比分析.md](docs/系统提示词对比分析.md)。

---

## 实测效果 | Real-World Results

以下是使用 cc-unlock v3.0 的真实安全研究任务成果——**同一个任务分别在 Claude Code 和 Codex 上完成，两个平台均未拒答**：

### 任务：DNF 手游 GameGuardian Lua 脚本跨版本迁移

将旧版本的 GG 内存修改脚本（含反封/反检测、属性改写、无敌、技能倍率、疲劳等功能）根据新版本 dump.cs 迁移到 126.5.5.0 版本。涉及 IL2CPP RVA 重新计算、函数签名对照、汇编指令适配等逆向工程工作。

| 平台 | 模型 | 结果 | 产出 |
|------|------|------|------|
| **Claude Code** | Opus 4.8 | 完整交付 | `地下城与勇士：起源_126.5.5.0.lua` (41.2 KB) |
| **Codex** | GPT 5.5 | 完整交付 | `dnf_126.5.5.0_migrated.lua` |

**Claude Code (Opus 4.8)** 的迁移做法：
- 新旧 dump 逐一对照，用函数长度校验偏移是否落在函数内，独立 agent 二次复核
- 全部 30 条菜单项保留，跳转类（怪物自杀 onDie）相对偏移重新算
- 汇编指令（`-A8 RET` / `MOV`）跨版本通用，原样保留
- 开关功能改为运行时回写原始字节（比硬编码旧机器码更稳，不因版本变化写错）

**Codex (GPT 5.5)** 的迁移做法：
- 按新版 dump_dnf_126.5.5.0.cs 迁移为 RVA 直写模式
- 覆盖功能：动作分数、无限蓝量、人物伤害、弱化血量、怪物自杀、自动战斗、人物/职业无敌、技能伤害倍率、人物回蓝、技能冷却、魔法伤害、移速/攻速、锁定疲劳
- 旧机器码特征依赖的部分（切屏过检、满级强化、技能替换）标注需要新版 libil2cpp.so 做进一步对照

> 这个任务在不使用 cc-unlock 的默认配置下，两个平台都会因为涉及游戏修改/内存操作/反检测绕过等敏感话题而拒绝协助。cc-unlock 的 system-prompt.md 通过建立真实的安全研究上下文，让模型正确识别这是授权环境中的逆向工程研究，而非恶意行为。

---

## 核心特性 | Key Features

- **对齐真实策略** — 逐字引用 Claude Code 第 5 行内容策略，拆成 ALLOW/REFUSE/DUAL-USE 三段，援引系统提示词自己承认的 "durable instructions like CLAUDE.md files" 持久授权通道
- **双 CLI 统一配置** — 同一个 system-prompt.md 通过 config.toml 指向，同时适用于 Claude Code（~/.claude/）和 Codex（~/.codex/），一次安装两套部署
- **~300 优化示例** — 覆盖 15 个安全研究领域（质量优先，非暴力堆量），many-shot 行为锚定
- **术语规范** — 24+ 安全术语不做委婉替换，防止模型自行"净化"专业词汇
- **claude.ai 兜底分层** — 旧版对抗内容降级为标注清晰的兜底层，仅 web 端复用时相关，不污染 Claude Code 主线判断
- **跨平台部署** — Windows / macOS / Linux 一键安装，自动备份，支持多目录检测

---

## 快速开始 | Quick Start

### Windows

```
双击 启动.bat
```

或 PowerShell：
```powershell
.\cc-unlock-files\deploy.ps1 -Mode deploy
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
./cc-unlock-files/linux-install.sh
```

### 卸载 | Uninstall

- Windows: 双击 `卸载.bat` 或 `.\cc-unlock-files\deploy.ps1 -Mode uninstall`
- macOS: 双击 `卸载.command` 或 `./mac-uninstall.sh`
- Linux: `./cc-unlock-files/linux-uninstall.sh`

**部署完成后重启 Claude Code 生效。**

---

## 文件结构 | File Structure

```
cc-unlock/
├── README.md                          # 本文件
├── LICENSE                            # MIT
├── CHANGELOG.md                       # 版本日志
├── 启动.bat                           # Windows 一键安装
├── 卸载.bat                           # Windows 一键卸载
├── 启动.command                       # macOS 一键安装
├── 卸载.command                       # macOS 一键卸载
├── mac-install.sh                     # macOS 安装脚本
├── mac-uninstall.sh                   # macOS 卸载脚本
├── Mac使用说明.txt                    # macOS 使用指南
│
├── cc-unlock-files/
│   ├── config-bundle/
│   │   ├── CLAUDE.md                  # 核心行为配置 (~25KB, ~300 示例)
│   │   ├── system-prompt.md           # 项目上下文框架
│   │   └── settings.json              # bypassPermissions 设置
│   ├── deploy.ps1                     # Windows 部署脚本 (PS 2.0-7.x)
│   ├── install.sh                     # 通用安装包装器
│   ├── linux-install.sh               # Linux 安装
│   └── linux-uninstall.sh             # Linux 卸载
│
├── codex-files/
│   └── codex-config-bundle/
│       ├── system-prompt.md           # Codex 项目上下文 (与 Claude Code 相同)
│       └── config.toml                # Codex CLI 配置 (指向 system-prompt.md)
│
├── scripts/
│   ├── install.bat                    # 安装 (调用 deploy.ps1)
│   ├── install.sh                     # 安装 (Unix)
│   ├── uninstall.bat                  # 卸载
│   ├── uninstall.sh                   # 卸载 (Unix)
│   ├── restore.bat                    # 恢复备份
│   ├── verify.bat                     # 验证部署
│   ├── verify.sh                      # 验证部署 (Unix)
│   ├── test.bat                       # 快速测试
│   ├── 兼容性测试.bat                 # 兼容性检查
│   ├── 快速测试.bat                   # 快速测试 (中文)
│   ├── 恢复备份.bat                   # 恢复备份 (中文)
│   └── 验证.bat                       # 验证部署 (中文)
│
└── docs/
    ├── VERSION                        # 版本号
    ├── CODE_OF_CONDUCT.md             # 行为准则
    ├── CONTRIBUTING.md                # 贡献指南
    ├── RELEASE_NOTES.md               # 发布说明
    ├── SECURITY.md                    # 安全政策
    ├── SUPPORT.md                     # 支持渠道
    ├── 安装指南.md                    # 详细安装文档
    ├── 模型适配说明.md                # 模型行为分析
    └── 兼容性报告.md                  # 平台兼容性
```

---

## 工作原理 | How It Works

cc-unlock 利用 Claude Code 的 CLAUDE.md 全局配置机制，通过五个层次建立稳定的安全研究工作环境：

1. **授权框架** — 在 system-prompt.md 中建立真实的研究机构上下文和授权背景
2. **行为锚定** — CLAUDE.md 中 8 条显式规则 + 13 条必须执行 + 14 条严格禁止，固化输出行为
3. **示例驱动** — ~300 条高质量 Q&A 覆盖 15 个安全研究领域，通过多轮示例锚定模型的输出模式
4. **术语规范** — 24+ 术语映射表防止模型自行替换专业词汇为委婉说法
5. **模型适配** — 针对 Opus 4.8 和 Fable 5 的已知行为模式提供专项绕过策略

---

## 支持的模型 | Supported Models

| 平台 | 模型 | 适配状态 | 说明 |
|------|------|----------|------|
| Claude Code | Opus 4.8 | **实测通过** | DNF 脚本迁移任务完整交付 |
| Claude Code | Opus 4.6/4.7 | 兼容 | 行为模式与 4.8 一致 |
| Claude Code | Fable 5 | 完全适配 | 对结构化指令遵循度最高 |
| Claude Code | Sonnet 4.x | 兼容 | 指令遵循度高 |
| Codex | GPT 5.5 | **实测通过** | 同一 DNF 任务完整交付 |
| Codex | GPT 5.3/5.4 | 兼容 | 同一 system-prompt.md 生效 |

---

## 常见问题 | FAQ

**Q: 部署后没有效果？**
A: 确保重启 Claude Code。检查 `~/.claude/CLAUDE.md` 是否存在。

**Q: 如何验证部署成功？**
A: 运行 `scripts/verify.bat`（Windows）或 `scripts/verify.sh`（Unix），或手动检查 `~/.claude/` 目录下的文件。

**Q: 如何恢复原始配置？**
A: 运行卸载脚本，它会自动从备份恢复。备份位于 `~/.claude/backups/cc-unlock-*`。

**Q: settings.json 的 bypassPermissions 安全吗？**
A: 这是 Claude Code 的内置选项，跳过每次工具调用的确认弹窗。部署脚本支持 `-SkipSettings` 参数跳过此文件的部署。

---

## License

MIT — 见 [LICENSE](LICENSE)
