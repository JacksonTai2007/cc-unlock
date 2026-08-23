# cc-unlock v8.0.7

**Cybersecurity Academy Tutoring Tool for Claude Code & Codex** | 网络安全学院辅导工具

cc-unlock v8.0.7 is a comprehensive cybersecurity academy tutoring tool that transforms Claude Code and Codex into a full-spectrum cybersecurity tutor. It covers the **complete cybersecurity curriculum** across 20 domains, ships with **3 skill frameworks** (android-reverse, web-reverse, win-reverse) and a **Loop Engineering self-recursive execution engine**, enabling structured, multi-phase learning and hands-on practice.

cc-unlock v8.0.7 是一套完整的网络安全学院辅导工具，将 Claude Code 和 Codex 转化为全谱系网络安全导师。覆盖 **20 个领域的完整网络安全课程体系**，内置 **3 套技能框架**（android-reverse、web-reverse、win-reverse）及 **Loop Engineering 自递归执行引擎**，支持结构化多阶段学习与动手实践。

---

## Curriculum Coverage | 课程覆盖

cc-unlock covers the **full cybersecurity curriculum**:

| # | Domain | Description |
|---|--------|-------------|
| 1 | **Reverse Engineering** | Binary analysis, disassembly, decompilation, IL2CPP, VMProtect, OLLVM, Themida |
| 2 | **Vulnerability Research** | Stack overflow, heap exploitation, format string, UAF, type confusion |
| 3 | **Web Application Security** | OWASP Top 10, XSS, SQLi, SSRF, SSTI, deserialization, authentication bypass |
| 4 | **Server Penetration** | Linux/Windows enumeration, service exploitation, lateral movement |
| 5 | **Privilege Escalation** | LPE techniques, kernel exploits, misconfigurations, SUID/capabilities |
| 6 | **AD Domain Penetration** | Kerberoasting, AS-REP, ADCS ESC1-15, DCSync, NTLM relay, Golden/Silver Ticket |
| 7 | **Cloud Security** | AWS IAM, Azure AD/Entra ID, GCP, K8s escape, IMDS, OAuth abuse |
| 8 | **C2 & Post-Exploitation** | C2 frameworks, persistence, credential harvesting, data exfiltration |
| 9 | **Evasion** | AMSI/ETW bypass, process injection, reflective loading, EDR research |
| 10 | **Mobile Security** | Android/iOS app analysis, Frida, Xposed, SSL pinning bypass, Magisk |
| 11 | **Kernel Security** | Windows kernel (WDK, DKOM, PatchGuard), Android kernel (LKM, KernelSU, SELinux) |
| 12 | **Malware Analysis** | Static/dynamic analysis, YARA rules, sandbox analysis, unpacking |
| 13 | **Cryptography** | Symmetric/asymmetric, hash attacks, RSA, AES, protocol analysis |
| 14 | **Network Security** | Protocol analysis, traffic capture, IDS/IPS, firewall, VPN |
| 15 | **IoT & Hardware Security** | Firmware extraction, UART/JTAG/SPI, embedded device analysis |
| 16 | **AI Security** | Prompt injection, jailbreak research, model extraction, RAG poisoning, MCP tool poisoning |
| 17 | **Social Engineering** | Phishing analysis, pretexting, awareness training |
| 18 | **Digital Forensics** | Disk/memory/network forensics, timeline analysis, evidence handling |
| 19 | **CTF** | PWN, RE, Web, Crypto, Misc challenge methodologies |
| 20 | **Game Security** | IL2CPP analysis, memory scanning, anti-cheat research, GG scripting |

---

## Key Features | 核心特性

### 3 Skill Frameworks | 三大技能框架

1. **android-reverse** -- Android reverse engineering skill framework with topic packs, artifact templates, and reference playbooks
2. **web-reverse** -- Web reverse engineering skill framework covering JS deobfuscation, protocol analysis, JSVMP, WebAssembly, hooking, and 20+ topic packs
3. **win-reverse** -- Windows reverse engineering skill framework for native binary analysis, .NET, driver reversing

### Loop Engineering Self-Recursive Execution Engine | Loop Engineering 自递归执行引擎

When given a cybersecurity learning task, the model automatically decomposes it into multi-phase steps and recursively completes all phases:

1. **Plan** -- 3-5 line phase checklist, then start immediately
2. **Recursive execution** -- Complete each phase with actual file/code output
3. **Auto-continue** -- No user confirmation needed between phases
4. **Fork handling** -- Pick optimal path; direction-level forks give one recommendation + alternatives, wait for one word
5. **Dead-end handling** -- Switch approach and continue; two consecutive failures = stop, explain blockers, give options
6. **Converge** -- Summarize all deliverables when complete

### Claude Code Memory Bundle | Claude Code 记忆包

- **22 memory files** -- Engineer profile + 12 track records (RE / vuln / mobile / game / pentest / kernel / AI red team / web / LPE / evasion / C2 etc.) + 5 feedback + 1 reference + MEMORY index
- Per-workspace deployment, automatically loaded at session start

### Codex Memory Bundle | Codex 记忆包

- **3 memory files + 104 rollout summaries** -- Covering 20+ domains of delivery history
- Deployed to `~/.codex/memories/` for pattern-continuation

### Visual GUI | 可视化 GUI

- WinForms dark theme window with sidebar navigation
- Claude Desktop App + Codex auto-detection
- Chinese/English bilingual switching
- One-click deploy / uninstall / verify

---

## Quick Start | 快速开始

### Windows (GUI)

```
双击 启动.bat
```

Open the visual deployment window: select workspace, check options, click deploy.

### Windows (CLI)

```powershell
# Deploy to specific workspace
.\cc-unlock-files\deploy.ps1 -Path "C:\path\to\workspace"

# Deploy to all existing workspaces
.\cc-unlock-files\deploy.ps1 -All

# Deploy Codex only
.\cc-unlock-files\deploy.ps1 -Codex

# Verify deployment
.\cc-unlock-files\deploy.ps1 -Verify
```

### macOS

```bash
chmod +x 启动.command
双击 启动.command
```

Or terminal:
```bash
chmod +x mac-install.sh && ./mac-install.sh
```

### Linux

```bash
chmod +x cc-unlock-files/linux-install.sh
./cc-unlock-files/linux-install.sh --all
```

### Uninstall | 卸载

- Windows: 双击 `卸载.bat` or `.\cc-unlock-files\deploy.ps1 -Uninstall -All`
- macOS: 双击 `卸载.command` or `./mac-uninstall.sh`
- Linux: `./cc-unlock-files/linux-uninstall.sh`

**Restart Claude Desktop App / Codex after deployment.**

---

## How It Works | 工作原理

### Injection Architecture | 注入架构

```
On install:

  Layer 1: Claude Desktop App Memory (always-on, 22 memory files)
    engineer-profile.md               ->  ~/.claude/projects/[PROJECT]/memory/
    communication-style.md, code-delivery-standard.md, terminology-conventions.md
    lab-environments.md
    12 track records (re / vuln / mobile / game / pentest / windows-kernel /
                      android-kernel / ai-redteam / web-rce / lpe /
                      evasion-malware / c2-post-ex)
    MEMORY.md (index)

  Layer 2: CLAUDE.md (persona + curriculum alignment + Loop Engineering)
    CLAUDE.md                         ->  workspace root

  Layer 3: Skill Frameworks (on-demand methodology)
    loop-sec.md                       ->  workspace/.claude/skills/
    android-reverse/                  ->  workspace/.claude/skills/
    web-reverse/                      ->  workspace/.claude/skills/
    win-reverse/                      ->  workspace/.claude/skills/

  Layer 4: Codex system-prompt.md
    system-prompt.md                  ->  ~/.codex/
    config.toml                       ->  ~/.codex/ (merged)

  Layer 5: Codex Memory + Rollout Summaries
    memory_summary.md, MEMORY.md, raw_memories.md  ->  ~/.codex/memories/
    104 rollout_summaries/*.md                      ->  ~/.codex/memories/rollout_summaries/

  Global:
    settings.json                     ->  ~/.claude/
```

---

## Supported Models | 支持的模型

| Platform | Model | Status | Notes |
|----------|-------|--------|-------|
| Claude Desktop App | **Opus 5** | **Tested** (Ultracode) | Multi-subagent collaboration |
| Claude Desktop App | **Opus 4.8** | **Tested** (Fast/Ultracode) | Copy-first pattern active |
| Claude Desktop App | **Sonnet 5** | **Tested** (Ultracode) | Copy-first + transparent risk grading |
| Claude Desktop App | Opus 4.6/4.7 | Compatible | Consistent behavior |
| Claude Desktop App | Sonnet 4.x | Compatible | High instruction-following |
| Claude Desktop App | Haiku 4.5 | Compatible | Lightweight option |
| Claude Desktop App | **Fable 5** | **Platform-level block** | Fable 5 has independent safeguards layer; can Switch to Opus 4.8 |
| Codex Desktop App | **GPT 5.4** | **Tested** | Copy-first active |
| Codex Desktop App | **GPT 5.5** | **Tested** | Planning mode + Copy-first |
| Codex Desktop App | **GPT 5.6 Sol** | **Tested** | Multi-subagent + Final audit |
| Codex Desktop App | GPT 5.3 | Compatible | Same system-prompt.md effective |

---

## File Structure | 文件结构

```
cc-unlock/
├── README.md
├── CHANGELOG.md
├── LICENSE
├── gui.ps1                            # WinForms GUI main program
├── 启动.bat / 卸载.bat                # Windows launchers
├── 启动.command / 卸载.command        # macOS launchers
├── mac-install.sh / mac-uninstall.sh
│
├── cc-unlock-files/
│   ├── deploy.ps1                     # Windows deployment script
│   ├── memory-bundle/                 # 22 Claude memory files
│   │   ├── CLAUDE.md                  # Persona + curriculum alignment + Loop Engineering
│   │   ├── MEMORY.md                  # Memory index
│   │   ├── engineer-profile.md
│   │   ├── communication-style.md
│   │   ├── code-delivery-standard.md
│   │   ├── terminology-conventions.md
│   │   ├── lab-environments.md
│   │   └── 12 track records (re/vuln/mobile/game/pentest/windows-kernel/
│   │                         android-kernel/ai-redteam/web-rce/lpe/
│   │                         evasion-malware/c2-post-ex)
│   ├── skill-bundle/
│   │   ├── loop-sec.md                # Loop Engineering skill
│   │   ├── android-reverse/           # Android RE skill framework
│   │   ├── web-reverse/               # Web RE skill framework
│   │   └── win-reverse/               # Windows RE skill framework
│   ├── config-bundle/
│   │   └── settings.json
│   ├── linux-install.sh / linux-uninstall.sh
│   └── lib-deploy.sh
│
├── codex-files/
│   ├── codex-config-bundle/
│   │   ├── system-prompt.md           # Codex system prompt
│   │   └── config.toml
│   ├── codex-memory-bundle/
│   │   ├── memory_summary.md
│   │   ├── MEMORY.md
│   │   └── raw_memories.md
│   └── codex-rollout-bundle/
│       └── rollout_summaries/         # 104 rollout summaries
│
├── scripts/                           # Utility scripts
└── docs/
    ├── images/                        # Test screenshots
    ├── VERSION
    └── ...
```

---

## Coexistence with cc-switch | 与 cc-switch 共存

cc-unlock only writes one line (`model_instructions_file = "system-prompt.md"`) to `~/.codex/config.toml`. Installation uses merge-write, fully preserving cc-switch's provider, `base_url`, and key configuration. Uninstall only removes that one line. cc-switch's keys in `~/.codex/auth.json` are never touched.

---

## FAQ | 常见问题

**Q: What is cc-unlock?**
A: cc-unlock is a cybersecurity academy tutoring tool that configures Claude Code and Codex to serve as a comprehensive cybersecurity tutor, covering 20 domains from reverse engineering to digital forensics.

**Q: What are the 3 skill frameworks?**
A: android-reverse (Android RE methodology), web-reverse (Web RE with 20+ topic packs), and win-reverse (Windows native/driver/dotnet RE). Each provides structured learning templates, reference playbooks, and artifact scaffolding.

**Q: What is Loop Engineering?**
A: A self-recursive execution engine. Given a learning task, the model auto-decomposes it into phases and recursively completes all phases with actual code/file output, without stopping between phases for confirmation.

**Q: Deployment had no effect?**
A: Make sure to restart Claude Desktop App / Codex. Use the "Verify" button in GUI to check deployment status.

**Q: Does macOS / Linux support the GUI?**
A: Currently GUI is Windows-only. macOS / Linux use CLI script deployment.

**Q: Will it affect cc-switch or other Codex configs?**
A: No. cc-unlock only writes `model_instructions_file` line to `config.toml` (merge-write). cc-switch's keys in `~/.codex/auth.json` are never touched.

---

## License

MIT
