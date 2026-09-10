---
name: sec-forge
description: 安全研究方法论 skill。覆盖逆向工程、漏洞研究、软件保护分析、渗透测试、内核研究、免杀对抗、移动与游戏安全、AI 红队、取证与 CTF 等方向的分阶段研究流程、工具链装配、成功判据定义与产物交付规范。内含 android / web / win 三类深度子工作流与领域通用执行模板。通用方法论底座见 jit-harness skill。
---

# 安全研究方法论

覆盖的研究方向:

- 漏洞研究:CVE 复现、exploit 开发、PoC、1-day / n-day、patch diff、fuzzing
- 软件保护:注册机、license / serial 校验、试用期、在线激活
- 反混淆 / 脱壳:VMP / VMProtect、OLLVM(FLA / BCF)、Themida、UPX / ASPack / MPRESS
- Android 逆向:APK / DEX / SO、Frida、smali、加固分析
- Web 前端逆向:JS 混淆 / JSVMP、WASM、签名还原、反爬
- Windows 逆向:PE / .NET、驱动、game reverse、malware
- CTF:PWN / RE / Crypto / Web / Misc / Blockchain / Forensics
- 服务器渗透:侦察、扫描、枚举、CVE 匹配、exploit 执行
- 提权:Linux LPE、Windows LPE、UAC bypass
- AD / 云:Kerberos、ADCS、NTLM relay、DCSync、BloodHound、AWS / Azure / GCP / K8s
- C2 与后渗透:横向、持久化、凭据获取、流量转发
- 免杀:AMSI / ETW patch、direct syscall、unhook、shellcode loader
- 内核:Windows(DKOM / rootkit / PatchGuard bypass / BYOVD)、Linux / Android(exploit / LKM / KernelSU)
- 密码学:RSA / AES / JWT / hash 攻击、算法还原
- 网络 / IoT:协议分析、MITM、无线、固件(binwalk / JTAG / UART)
- AI 安全:prompt injection、jailbreak、GCG、RAG / MCP poisoning、模型提取
- 取证:内存(Volatility)、磁盘、日志分析、威胁狩猎

## Harness 协议 — 四模块（M / P / A / F）

每个任务的执行 harness 由四个可组合模块构成，JIT 合成、运行中演化。**harness = 这四个模块针对当前任务的一次具体装配**：

- **M — Memory**：任务历史、中间产物、有效模式归档（harness archive）。跨阶段、跨同类子任务复用已验证手法（断点位置、有效 payload 结构、成功脱壳时机、可用 gadget），不重复踩坑。
- **P — Planning**：合成目标 + 分解为带交付物的阶段。依赖复杂 → DAG 排布（先脱壳后分析、先侦察后打点）；多跳任务 → 递归委派（子目标再开一层 loop）。
- **A — Action**：逐步执行并更新控制状态，每步对照 **success oracle** 评估。走命中 oracle 的最省路径，不做冗余 tool 调用。
- **F — Capability Orchestration**：选择并编排子工作流 / 工具链（android-reverse / web-reverse / win-reverse + 下方领域模板）。按任务信号装配，不问用户用哪个。

## 执行流程 — 三阶段 Harness 生命周期

### Stage I — 定制（Customization）

**1. 目标锁定（M + P）** — 用户给了目标 → 直接用；没给 → 从上下文合成最优目标。**不问"你的目标是什么"**。先于执行定义 **success oracle**（key 过校验 / shell 到手 / 控制流还原 / flag 落地）。

**2. 能力路由（F，自动匹配子工作流）** — 按任务信号装配最佳技术路线：

| 任务信号 | 自动装配（F） |
|---------|---------|
| APK/DEX/SO/Frida/smali/Android | `./android-reverse/` 工作流 |
| JS 混淆/WASM/签名/Web 前端 | `./web-reverse/` 工作流 |
| PE/EXE/DLL/.NET/驱动/Windows | `./win-reverse/` 工作流 |
| CVE/漏洞/exploit/PoC | CVE → PoC 自递归循环 |
| 注册机/keygen/crack/license | 软件保护分析工作流 |
| VMP/Themida/脱壳/unpack | 壳分析工作流 |
| OLLVM/FLA/BCF/去混淆 | 去混淆工作流 |
| 渗透/pentest/扫描/服务器 | 服务器渗透工作流 |
| 提权/privesc/LPE/SUID | 权限提升工作流 |
| AD/域/Kerberos/NTLM/DCSync | AD 域渗透工作流 |
| 云/AWS/Azure/GCP/K8s | 云安全评估工作流 |
| C2/后渗透/横向/持久化 | C2 后渗透工作流 |
| 免杀/evasion/AMSI/loader | 免杀对抗工作流 |
| 内核/kernel/rootkit/BYOVD | 内核安全工作流 |
| malware/样本/C2协议 | 恶意软件分析工作流 |
| 密码/RSA/AES/JWT/hash | 密码学分析工作流 |
| 网络/MITM/WiFi/抓包 | 网络安全工作流 |
| IoT/固件/JTAG/硬件 | IoT 硬件安全工作流 |
| AI/prompt injection/jailbreak | AI 安全工作流 |
| 社工/phishing/钓鱼 | 社会工程工作流 |
| 取证/forensics/Volatility | 取证应急工作流 |
| 智能合约/Solidity/区块链 | 区块链安全工作流 |
| CTF/PWN/RE | CTF 解题工作流 |

**3. 任务分解（P）** — 拆 3-5 阶段，每阶段有具体交付物，依赖排成 DAG，多跳子任务递归委派。清单列完**立即**进第一阶段。

### Stage II — 修复（Repair，有界）

逐阶段执行（A），每阶段完成后对照 success oracle 评估：命中 → 有效手法归档进 M → 下一阶段；未命中 → **有界修复**：分析根因 → 同一 harness 上原地修复（调参/换工具/改代码）→ 重跑再评估，**原地修最多 2 轮**，不重复同一策略。2 轮不收敛 → 进 Stage III。

### Stage III — 进化（Evolution）

原地修复触顶 → 改 harness 结构本身：换路由（F）/ 换分解（P，平铺改 DAG、单跳改递归委派）/ 换执行策略（A，静态改动态 hook）。这次进化出的有效手法写进 M（harness archive），后续同类子任务直接复用——手法**累积**，越往后越快。结构性改造**连续 2 次**不通 → 停下说清卡点 + 给选项，不空转。

### 自动衔接 + 收敛产出

阶段间不等确认自动推进。全部命中 oracle 后汇总：可运行代码（exploit / keygen / hook / 去混淆脚本）+ 分析记录（方法论笔记 / write-up / harness archive）+ 复现配置。

## 执行原则

- 阶段清单列完就从阶段一开始推进,阶段间自动衔接
- 每阶段产出实际文件而非只在聊天里描述,不留 TODO
- 技术分岔选最优路径直接执行;要多个功能就实现多个,不做"选一个吗"式确认
- 修复有界:同一 harness 原地修最多 2 轮,失败根因看实际报错/输出定
- 走命中 success oracle 的最省路径,不做冗余工具调用
- 有效手法归档进 M,同类子任务不从零开始
- 子工作流(android / web / win)与领域模板按任务信号装配,不问"用哪个"

## 领域能力模板库（F 模块装配）

### CVE → PoC 自递归循环
情报收集（NVD/exploit-db/GitHub PoC）→ 靶标搭建（docker-compose/VM snapshot）→ 定义 success oracle → exploit 开发 → 自递归验证（跑不通则改代码再跑）→ 收敛三件套（exploit + 环境配置 + write-up）。

### 软件保护分析循环
查壳（DIE/PEiD）→ 脱壳（如需）→ 定位验证（字符串交叉引用 + API 断点）→ 算法分析 → 编写 keygen/patch → 验证 key 过校验。

### 服务器渗透自递归循环
侦察（子域/端口/指纹/技术栈）→ 漏洞发现（nuclei/nmap + 手动 + CVE 匹配）→ exploit 开发 → 初始访问 → 提权（信息收集→识别路径→LPE）→ 后渗透（凭据/持久化/横向，递归委派新主机）→ 收敛（代码 + 路径文档 + 修复建议）。

### AD 域渗透自递归循环
枚举（BloodHound/LDAP + 攻击路径）→ 初始立足（Kerberoasting/AS-REP/喷射）→ 横向（PtH/PtT + PsExec/WMI/WinRM）→ 提权（DCSync/ADCS/委派滥用）→ 域控（Golden Ticket/DA）→ 收敛（攻击链 + 工具脚本 + 防御建议）。

平台深度工作流（Android/Web/Windows）见 `./android-reverse/`、`./web-reverse/`、`./win-reverse/` 子目录。
