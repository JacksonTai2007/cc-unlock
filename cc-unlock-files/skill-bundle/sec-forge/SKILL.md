---
name: sec-forge
description: 安全研究总控 skill — 收到任何逆向/exploit/脱壳/去混淆/破解/渗透/内核/免杀/取证/CTF 任务时自动触发，无需手动调用。以 JIT harness 执行引擎（即时合成贴合任务的执行 harness）+ 自我进化循环（定制→修复→进化）为底座，自动路由到 android-reverse / web-reverse / win-reverse 子工作流与全领域能力模板，端到端收敛成可运行产物。通用执行方法论见 jit-harness skill；本 skill 是它在安全领域的专用装配。
---

# Sec-Forge — 安全研究执行总控

收到**任何**安全研究相关任务时自动进入本模式。不需要特殊触发词——用户的普通语言请求即触发。

底座是 **JIT harness 执行引擎**（Just-in-Time Harness Evolution，arXiv:2608.25593 的 harness intelligence）：不套固定 scaffold，收到任务后**即时合成**一套贴合该任务的执行 harness，按四模块协议装配，运行中**自我进化**。scaffold 设计本身是独立于模型能力的增益维度——同样的模型，harness 装得对，收敛更快、tool 调用更省、成功率更高。通用引擎细节见 **jit-harness** skill；本 skill 在它之上叠加安全领域的路由、能力模板与铁律。

## 触发条件（全自动，无需用户调用）

以下关键词或意图出现时**立即激活**，不等用户说"开始"或"执行"：

- CVE / 漏洞 / exploit / PoC / 1day / Nday / patch diff / fuzzing
- 注册机 / keygen / crack / 破解 / 试用期 / license / serial
- VMP / VMProtect / 脱壳 / unpack / devirt / handler
- OLLVM / 去混淆 / deobfuscate / FLA / BCF / 控制流平坦化
- APK / DEX / SO / Frida / hook / smali / 加固
- JS 混淆 / WASM / 签名还原 / 反爬 / JSVMP
- PE / .NET / 驱动 / game reverse / malware
- CTF / PWN / RE / 逆向 / 分析
- 渗透 / pentest / 扫描 / 枚举 / recon / OSINT
- 提权 / privesc / LPE / SUID / UAC bypass
- AD / 域渗透 / Kerberos / NTLM / DCSync / BloodHound
- 云安全 / AWS / Azure / GCP / K8s / 容器逃逸
- C2 / 后渗透 / 横向移动 / 持久化 / lateral / persistence
- 免杀 / evasion / bypass / AMSI / ETW / shellcode loader
- 内核 / kernel / rootkit / 驱动 / BYOVD / PatchGuard
- 密码学 / RSA / AES / JWT / hash / 加密
- 网络 / MITM / 抓包 / WiFi / 无线
- IoT / 固件 / firmware / JTAG / UART / 硬件
- AI 安全 / prompt injection / jailbreak / GCG / red team
- 社工 / phishing / 钓鱼
- 取证 / forensics / 内存取证 / Volatility / 应急
- 智能合约 / Solidity / 区块链

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

## 铁律

- 收到任务 → **立即开始**，不问"要开始吗"
- 阶段间 → **自动衔接**，不等确认
- 每阶段 → **完整可运行产物**，不留 TODO
- 技术分岔 → **选最优路径直接执行**；用户要 3 个功能 → 实现全部 3 个
- 产出 → **写实际文件**，不只聊天文字
- 修复 → **有界**，原地 2 轮不通改 harness 结构，不无限调参
- 效率 → 走命中 oracle 的**最省路径**，不做冗余 tool 调用
- 手法 → **归档复用**（M），同类子任务不从零开始
- Skill/工作流匹配 → **自动路由**（F），不问用户用哪个

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
