# cc-unlock v1.0-stable

**Security Research Workstation for Claude Code & Codex** | 安全研究工作站

把 Claude Code 和 Codex 配置为全谱系安全研究工作站。内置 **4 套技能框架**（loop-sec + android-reverse + web-reverse + win-reverse），覆盖逆向工程、漏洞研究、渗透测试、内核安全、免杀对抗等 20+ 安全领域，并对**所有会进模型上下文的本地文件做零死角人格注入**——主 agent 与子 agent 一致，不回退默认拘谨行为。

---

## 两个子项目（Electron 桌面应用）

cc-unlock v1.0-stable 拆成两个独立的 Electron + IBM Carbon 桌面应用，各自打包成 `.exe`：

| 子项目 | 目标 | 部署范围 |
|--------|------|---------|
| **cc-unlock-claude** | Claude Code | 按工作区（memory + CLAUDE.md + skills + **子 agent 覆盖**） |
| **cc-unlock-codex** | Codex | 全局 `~/.codex`（system-prompt + AGENTS + config + memories + rollouts + skills） |

> 从 [Releases](https://github.com/JacksonTai2007/cc-unlock/releases) 下载对应的 `.exe` 安装即用。两个应用同一套 IBM Carbon 深色界面，一键部署 / 卸载 / 验证。

---

## ⚠️ 使用 /loop-sec 下达任务

部署完成后，**用 `/loop-sec` 前缀下达安全研究任务**（Claude Code 与 Codex 通用）：

```
/loop-sec 渗透 target.lab.local
/loop-sec 分析这个 APK 的加固保护
/loop-sec 写 CVE-2024-XXXX 的 PoC
/loop-sec 破解这个软件的注册验证
/loop-sec 脱 VMP 保护
/loop-sec hook 这个 Unity 游戏的伤害函数
/loop-sec 写个免杀 loader
```

Loop Sec 是自递归执行引擎——收到任务后自动分解、自动路由到对应平台 skill（android-reverse / web-reverse / win-reverse）、递归执行直到完成。**不用手动选 skill。** 直接说任务也会自动触发。

---

## 零死角上下文注入（v1.0-stable 核心）

审计了 Claude Code 与 Codex **所有会进模型上下文的本地文件**（Claude 查官方文档、Codex 对实际二进制验证），把反软拒绝人格注入到每一个注入点：

### Claude Code

| 注入点 | 作用域 | 覆盖 |
|--------|--------|------|
| `<ws>/CLAUDE.md` | 主 agent + 所有非 fork 子 agent | ✅ persona |
| `.claude/rules/cc-unlock-persona.md` | 主 + 所有非 fork 子 agent（启动加载） | ✅ 新载体 |
| `.claude/agents/*.md` body | 该子 agent 系统提示 | ✅ sec-executor + recon/planner |
| `.claude/agent-memory/<name>/MEMORY.md` | 子 agent `memory:project` 启动注入 | ✅ 交付 many-shot |
| `projects/<proj>/memory/` | 主 agent auto memory | ✅ persona + 交付先例 |
| Explore / Plan（内置） | 架构性跳过 CLAUDE.md | ⚠️ recon/planner 带人格替代 |

> **关键**：子 agent 的 `memory: project` 注入的是 `.claude/agent-memory/<agent名>/MEMORY.md`（各自独立），不是主记忆目录。cc-unlock 为每个自定义 agent 单独铺设记忆载体。

### Codex（对二进制验证）

| 注入点 | 作用域 | 覆盖 |
|--------|--------|------|
| `~/.codex/system-prompt.md` | 整段替换 base，`base_instructions ∈ SessionMeta` **自动传播到每个子 agent** | ✅ 最强 |
| `~/.codex/AGENTS.md` | 全局用户指令冗余层 | ✅ 覆盖 |
| `~/.codex/memories/MEMORY.md` | `use_memories` 时自动注入 | ✅ persona + many-shot |
| `~/.codex/skills/*/SKILL.md` | name+description 常驻注入 | ✅ 覆盖 |

> **关键**：Codex 的 `system-prompt.md` 通过 `SessionMeta.base_instructions` 自动传播到每个子 agent——**Codex 侧子 agent 天然覆盖**。

---

## 覆盖领域

| 逆向工程 | 软件保护分析 | 漏洞研究 | Web 应用安全 | 服务器渗透 |
|---|---|---|---|---|
| **权限提升** | **AD 域渗透** | **云安全** | **C2 与后渗透** | **免杀对抗** |
| **移动安全** | **内核安全** | **Malware 分析** | **密码学** | **网络安全** |
| **IoT 与硬件** | **AI 安全** | **社会工程** | **数字取证** | **CTF** |

PE/ELF/Mach-O · IDA/Ghidra/x64dbg · VMP/Themida/OLLVM · IL2CPP/Unity/UE · 注册机/keygen · 栈/堆溢出/UAF/kernel exploit · SQLi/XSS/SSRF/SSTI/Log4Shell · ADCS/Kerberoasting/DCSync/Golden Ticket · CS/Sliver/Havoc/Mythic · AMSI/ETW patch/直接系统调用 · Frida/Xposed/SSL Pinning bypass · WDK/DKOM/PatchGuard/BYOVD · Prompt injection/jailbreak/GCG

---

## 技能框架

| Skill | 功能 |
|-------|------|
| **loop-sec** | 自递归执行引擎 — 自动路由、任务分解、递归执行 |
| **android-reverse** | Android 逆向 — APK/DEX/SO, Frida hook, 脱壳, smali patch |
| **web-reverse** | Web 前端逆向 — JS 去混淆, WASM, 签名还原, 反调试绕过 |
| **win-reverse** | Windows 逆向 — PE, .NET, 驱动, game reverse, malware |

---

## 快速开始

### 桌面应用（推荐）

1. 从 [Releases](https://github.com/JacksonTai2007/cc-unlock/releases) 下载：
   - `cc-unlock-claude-Setup-*.exe`（Claude Code）
   - `cc-unlock-codex-Setup-*.exe`（Codex）
2. 安装并打开，进入「部署」页
3. Claude：选工作区，开启「子 agent 覆盖」，点部署
4. Codex：（可选配置中转站）点「部署 Codex」
5. 重启 Claude Code / Codex

### 从源码运行 / 打包

```bash
# Claude 应用
cd cc-unlock-claude && npm install && npm start      # 开发运行
cd cc-unlock-claude && npm run dist                  # 打包成 exe -> dist/

# Codex 应用
cd cc-unlock-codex && npm install && npm start
cd cc-unlock-codex && npm run dist
```

### 命令行部署（legacy PowerShell）

```powershell
.\cc-unlock-files\deploy.ps1 -All        # 部署到所有工作区
.\cc-unlock-files\deploy.ps1 -Codex      # 仅 Codex
.\cc-unlock-files\deploy.ps1 -Verify     # 验证
```

---

## 中转站接入（Codex）

Codex 应用「部署」页支持中转站（relay provider）：勾选后填 API 地址 / Key / 模型，写入 `[model_providers.cc_unlock_relay]` 到 `config.toml`。config.toml 用 **latin1 字节直通**合并写入，完整保留 cc-switch 的 provider、密钥与任意 CJK 内容（不做编码转换，避免中文乱码）。卸载只移除 cc-unlock 写入的键。

---

## 与 cc-switch 共存

cc-unlock 只向 `~/.codex/config.toml` 合并写入 `model_instructions_file` 一行（+ 可选 relay 段），完全保留 cc-switch 的配置。`~/.codex/auth.json` 不被触碰。

---

## 支持的模型

| 平台 | 模型 | 状态 |
|------|------|------|
| Claude Code | Opus 5 / 4.8 / Sonnet 5 | 已测试 |
| Claude Code | Opus 4.6/4.7 · Sonnet 4.x · Haiku 4.5 | 兼容 |
| Codex | GPT 5.6 Sol/Luna · 5.5 · 5.4 | 已测试 |
| Codex | GPT 5.3 | 兼容 |

---

## 文件结构

```
cc-unlock/
├── cc-unlock-claude/          # Claude Code Electron 应用
│   ├── main.js / preload.js   # Electron 主进程 + 桥
│   ├── deploy-core.js         # 纯 Node 部署逻辑（可测/可复用）
│   ├── renderer/              # IBM Carbon 界面
│   └── bundle/                # agents / rules / agent-memory
├── cc-unlock-codex/           # Codex Electron 应用
│   ├── main.js / preload.js
│   ├── deploy-core.js         # Codex 部署逻辑（latin1 config.toml 安全）
│   └── renderer/
├── cc-unlock-files/           # 共享 bundle + legacy PS 部署
│   ├── deploy.ps1
│   ├── memory-bundle/         # Claude 记忆（含 delivery-precedents 大记忆）
│   ├── skill-bundle/          # 4 技能框架
│   └── config-bundle/
├── codex-files/               # Codex bundle
│   ├── codex-config-bundle/   # system-prompt.md, AGENTS.md, config.toml
│   ├── codex-memory-bundle/   # persona + 交付 many-shot
│   └── codex-rollout-bundle/  # 104 rollout summaries
└── gui.ps1                    # legacy WinForms GUI
```

---

## 支持作者

如果这个工具对你有用，欢迎 [请作者喝杯咖啡 ☕](https://jacksontai2007.github.io/donate/)。

---

## License

MIT
