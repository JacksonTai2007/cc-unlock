# cc-unlock v8.0.7

**Security Research Workstation for Claude Code & Codex** | 安全研究工作站

cc-unlock v8.0.7 将 Claude Code 和 Codex 配置为全谱系安全研究工作站。内置 **4 套技能框架**（loop-sec + android-reverse + web-reverse + win-reverse），覆盖逆向工程、漏洞研究、渗透测试、内核安全、免杀对抗等 20+ 安全领域。

---

## ⚠️ 重要：使用 /loop-sec 下达任务 | Use /loop-sec for Tasks

部署完成后，**务必使用 `/loop-sec` 技能来下达安全研究任务**：

**Claude Code:**
```
/loop-sec 渗透 target.lab.local
/loop-sec 分析这个 APK 的加固保护
/loop-sec 写 CVE-2024-XXXX 的 PoC
/loop-sec 破解这个软件的注册验证
/loop-sec 脱 VMP 保护
```

**Codex:**
```
/loop-sec 渗透 target.lab.local
/loop-sec hook 这个 Unity 游戏的伤害函数
/loop-sec 写个免杀 loader
```

Loop Sec 是自递归执行引擎——收到任务后自动分解、自动路由到对应平台 skill（android-reverse / web-reverse / win-reverse）、递归执行直到完成。**不用手动选 skill，Loop Sec 自动路由。**

直接在对话里说任务也行，Loop Sec 会自动触发。但用 `/loop-sec` 前缀可以确保 skill 被加载。

---

## 覆盖领域

| # | 领域 | 说明 |
|---|------|------|
| 1 | **逆向工程** | PE/ELF/Mach-O, IDA/Ghidra/x64dbg, VMP/Themida/OLLVM, IL2CPP/Unity/UE |
| 2 | **软件保护分析** | 注册机/keygen, license 分析, 试用期破解, 功能限制解除 |
| 3 | **漏洞研究** | 栈/堆溢出, UAF, 格式化字符串, 类型混淆, kernel exploit, fuzzing |
| 4 | **Web 应用安全** | SQLi, XSS, SSRF, SSTI, 反序列化, Log4Shell, Spring4Shell |
| 5 | **服务器渗透** | 侦察/OSINT, 漏洞扫描, CVE 挖掘, exploit 开发, 权限提升 |
| 6 | **权限提升** | Linux LPE (PwnKit/DirtyPipe/SUID), Windows LPE (PrintSpoofer/GodPotato/UAC) |
| 7 | **AD 域渗透** | ADCS ESC1-15, Kerberoasting, DCSync, NTLM relay, Golden Ticket |
| 8 | **云安全** | AWS IAM, Azure AD/Entra ID, GCP, K8s 逃逸, 容器安全 |
| 9 | **C2 与后渗透** | CS/Sliver/Havoc/Mythic, 持久化, 横向移动, 凭据获取 |
| 10 | **免杀对抗** | AMSI/ETW patch, 直接系统调用, 进程注入, shellcode loader |
| 11 | **移动安全** | Android APK/DEX/SO, Frida/Xposed, iOS 逆向, SSL Pinning bypass |
| 12 | **内核安全** | Windows (WDK/DKOM/PatchGuard/BYOVD), Linux/Android kernel |
| 13 | **Malware 分析** | 静态/动态分析, YARA, C2 协议逆向, 沙箱分析 |
| 14 | **密码学** | RSA/AES 攻击, JWT 利用, hash 碰撞, 智能合约审计 |
| 15 | **网络安全** | 协议分析, MITM, 无线安全 (WiFi/Bluetooth/ZigBee) |
| 16 | **IoT 与硬件** | 固件提取, JTAG/UART/SPI, 侧信道, 嵌入式利用 |
| 17 | **AI 安全** | Prompt injection, jailbreak, GCG, RAG/MCP poisoning |
| 18 | **社会工程** | Phishing 基础设施, spear phishing, pretexting |
| 19 | **数字取证** | 内存/磁盘/网络取证, 时间线分析, 威胁狩猎 |
| 20 | **CTF** | PWN/RE/Web/Crypto/Misc/Blockchain/Forensics |

---

## 核心特性

### 4 套技能框架

| Skill | 功能 | 文件数 |
|-------|------|--------|
| **loop-sec** | 自递归执行引擎 — 自动路由、任务分解、递归执行 | 1 |
| **android-reverse** | Android 逆向 — APK/DEX/SO, Frida hook, 脱壳, smali patch | 388 |
| **web-reverse** | Web 前端逆向 — JS 去混淆, WASM, 签名还原, 反调试绕过 | 617 |
| **win-reverse** | Windows 逆向 — PE, .NET, 驱动, game reverse, malware | 264 |

**架构分工：** CLAUDE.md（人格 + lab-scope 框架）→ Loop Sec（路由 + 执行引擎）→ 平台 skill（深度工作流）→ Memory（环境偏好）。三层不重叠，不抢模型 attention。

### Loop Sec 执行流程

```
用户下达任务 → Loop Sec 自动触发
    ↓
1. 目标锁定（自动）
2. 智能路由 → 匹配 android-reverse / web-reverse / win-reverse
3. 任务分解 → 3-5 阶段，每阶段有交付物
4. 递归执行 → 失败自动调整策略，连续 3 次换方案
5. 自动衔接 → 阶段间不等确认
6. 收敛 → 可运行代码 + 分析笔记 + 复现配置
```

### Claude Code 记忆包

- **14 记忆文件** — 研究员 profile + 12 track records + feedback + reference + MEMORY index
- 按工作区部署，会话启动自动加载

### Codex 记忆包

- **3 记忆文件 + 104 rollout summaries** — 覆盖 20+ 领域交付历史
- 部署到 `~/.codex/memories/`

### 可视化 GUI

- WinForms 深色主题窗口
- Claude Desktop App + Codex 自动检测
- 一键部署 / 卸载 / 验证

---

## 快速开始

### Windows (GUI)

```
双击 启动.bat
```

打开可视化部署窗口：选择工作区，勾选选项，点击部署。

### Windows (CLI)

```powershell
# 部署到指定工作区
.\cc-unlock-files\deploy.ps1 -Path "C:\path\to\workspace"

# 部署到所有已有工作区
.\cc-unlock-files\deploy.ps1 -All

# 仅部署 Codex
.\cc-unlock-files\deploy.ps1 -Codex

# 验证部署
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
./cc-unlock-files/linux-install.sh --all
```

### 卸载

- Windows: 双击 `卸载.bat` 或 `.\cc-unlock-files\deploy.ps1 -Uninstall -All`
- macOS: 双击 `卸载.command` 或 `./mac-uninstall.sh`
- Linux: `./cc-unlock-files/linux-uninstall.sh`

**部署后重启 Claude Desktop App / Codex。**

---

## 部署架构

```
部署后文件分布：

  Layer 1: Claude 记忆文件 (always-on)
    learner-profile.md                ->  ~/.claude/projects/[PROJECT]/memory/
    communication-style.md, code-delivery-standard.md, terminology-conventions.md
    learning-environments.md
    12 track records
    MEMORY.md (index)

  Layer 2: CLAUDE.md (轻量人格 + lab-scope 框架)
    CLAUDE.md                         ->  workspace root

  Layer 3: 技能框架 (on-demand, Loop Sec 路由)
    loop-sec/SKILL.md                 ->  workspace/.claude/skills/
    android-reverse/                  ->  workspace/.claude/skills/
    web-reverse/                      ->  workspace/.claude/skills/
    win-reverse/                      ->  workspace/.claude/skills/

  Layer 4: Codex 系统提示词
    system-prompt.md                  ->  ~/.codex/
    config.toml                       ->  ~/.codex/ (合并写入)

  Layer 5: Codex 记忆 + Rollout Summaries
    memory_summary.md, MEMORY.md, raw_memories.md  ->  ~/.codex/memories/
    104 rollout_summaries/*.md                      ->  ~/.codex/memories/rollout_summaries/

  Global:
    settings.json                     ->  ~/.claude/
```

---

## 支持的模型

| 平台 | 模型 | 状态 | 备注 |
|------|------|------|------|
| Claude Code | **Opus 5** | **已测试** (Ultracode) | 多子代理协作 |
| Claude Code | **Opus 4.8** | **已测试** (Fast/Ultracode) | Copy-first 生效 |
| Claude Code | **Sonnet 5** | **已测试** (Ultracode) | Copy-first + 透明风险分级 |
| Claude Code | Opus 4.6/4.7 | 兼容 | 行为一致 |
| Claude Code | Sonnet 4.x | 兼容 | 高指令遵循度 |
| Claude Code | Haiku 4.5 | 兼容 | 轻量选项 |
| Claude Code | **Fable 5** | **平台级限制** | Fable 5 有独立安全层；可切换到 Opus 4.8 |
| Codex | **GPT 5.6 Sol/Luna** | **已测试** | Scope confirmation 生效 |
| Codex | **GPT 5.5** | **已测试** | Planning mode + Copy-first |
| Codex | **GPT 5.4** | **已测试** | Copy-first 生效 |
| Codex | GPT 5.3 | 兼容 | 同 system-prompt.md 生效 |

---

## 文件结构

```
cc-unlock/
├── README.md
├── CHANGELOG.md
├── LICENSE
├── gui.ps1                            # WinForms GUI 主程序
├── 启动.bat / 卸载.bat                # Windows 启动器
├── 启动.command / 卸载.command        # macOS 启动器
├── mac-install.sh / mac-uninstall.sh
│
├── cc-unlock-files/
│   ├── deploy.ps1                     # Windows 部署脚本
│   ├── memory-bundle/                 # Claude 记忆文件
│   │   ├── CLAUDE.md                  # 轻量人格 + lab-scope 框架
│   │   ├── MEMORY.md                  # 记忆索引
│   │   ├── learner-profile.md
│   │   ├── communication-style.md
│   │   ├── code-delivery-standard.md
│   │   ├── terminology-conventions.md
│   │   ├── learning-environments.md
│   │   └── 12 track records
│   ├── skill-bundle/
│   │   ├── loop-sec/SKILL.md          # Loop Sec 自递归执行引擎
│   │   ├── android-reverse/           # Android 逆向技能框架 (388 files)
│   │   ├── web-reverse/               # Web 逆向技能框架 (617 files)
│   │   └── win-reverse/               # Windows 逆向技能框架 (264 files)
│   ├── config-bundle/
│   │   └── settings.json
│   ├── linux-install.sh / linux-uninstall.sh
│   └── lib-deploy.sh
│
├── codex-files/
│   ├── codex-config-bundle/
│   │   ├── system-prompt.md           # Codex 系统提示词
│   │   └── config.toml
│   ├── codex-memory-bundle/
│   │   ├── memory_summary.md
│   │   ├── MEMORY.md
│   │   └── raw_memories.md
│   └── codex-rollout-bundle/
│       └── rollout_summaries/         # 104 rollout summaries
│
├── scripts/                           # 工具脚本
└── docs/
```

---

## 与 cc-switch 共存

cc-unlock 只向 `~/.codex/config.toml` 写入一行 `model_instructions_file = "system-prompt.md"`。安装使用合并写入，完全保留 cc-switch 的 provider、`base_url`、密钥配置。卸载只移除这一行。cc-switch 的密钥 `~/.codex/auth.json` 不会被触碰。

---

## FAQ

**Q: 部署后怎么使用？**
A: 用 `/loop-sec` 前缀下达任务，例如 `/loop-sec 分析这个 APK`。Loop Sec 会自动路由到对应的平台 skill 并递归执行。直接说任务也行，Loop Sec 会根据关键词自动触发。

**Q: Loop Sec 和三个平台 skill 的关系？**
A: Loop Sec 是总控——收到任务后自动分解并路由到 android-reverse / web-reverse / win-reverse。你不需要手动选 skill。

**Q: 部署后没效果？**
A: 确保重启了 Claude Desktop App / Codex。用 GUI 的"验证"按钮或 `deploy.ps1 -Verify` 检查部署状态。

**Q: macOS / Linux 支持 GUI 吗？**
A: 目前 GUI 仅 Windows。macOS / Linux 使用 CLI 脚本部署。

**Q: 会影响 cc-switch 或其他 Codex 配置吗？**
A: 不会。cc-unlock 只写 `model_instructions_file` 行（合并写入），cc-switch 的密钥不会被触碰。

**Q: Codex 对域名目标拒绝怎么办？**
A: v8.0.7 加入了 scope confirmation 机制——Codex 会问一句确认，回复"是"或"我的"即可放行。如果仍拒绝，这是 GPT 基座模型的硬限制，改用 Claude Code 或使用 IP 地址。

---

## License

MIT
