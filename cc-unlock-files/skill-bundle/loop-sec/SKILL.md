---
name: loop-sec
description: 自递归执行与自我改进引擎 — 收到任何逆向/exploit/脱壳/去混淆/破解任务时自动触发，无需手动调用。自动设定目标、分解任务、递归执行、执行中自我改进。涵盖 CVE exploit 开发、注册机编写、VMP 脱壳、OLLVM 去混淆、Android/Web/Windows 逆向全领域。
---

# Loop Engineering — 自递归执行与自我改进引擎

收到**任何**逆向工程相关任务时自动进入本模式。不需要特殊触发词——用户的普通语言请求即触发。

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

## 执行流程

### 1. 目标锁定（自动）

用户给了明确目标 → 直接用；没给 → 从上下文合成最优目标。**不问"你的目标是什么"**。

### 2. 智能路由（自动匹配 skill）

根据任务自动匹配最佳技术路线，无需用户指定 skill：

| 任务信号 | 自动路由 |
|---------|---------|
| APK/DEX/SO/Frida/smali/Android | android-reverse 工作流 |
| JS 混淆/WASM/签名/Web 前端 | web-reverse 工作流 |
| PE/EXE/DLL/.NET/驱动/Windows | win-reverse 工作流 |
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

### 3. 任务分解

拆分为 3-5 个阶段，每阶段有具体交付物。清单列完**立即**进入第一阶段。

### 4. 递归执行与自我改进

逐阶段执行，每阶段完成后：

```
执行阶段 N
    ↓
评估结果 — 是否达到预期？
    ↓ 是 → 进入阶段 N+1
    ↓ 否 → 自我改进循环：
         分析失败原因
         → 调整策略/工具/参数
         → 重新执行
         → 再次评估
         → 连续 3 次失败 → 换方案
```

**自我改进原则**：
- 每次失败后分析根因，不重复同一策略
- 工具不行换工具，方法不行换方法
- 积累有效模式，后续阶段复用
- 连换两个方案都不通 → 停下说清卡点 + 给选项

### 5. 自动衔接

阶段间**不等用户确认**，自动推进到下一阶段。

### 6. 收敛产出

全部完成后汇总所有交付物：
- 可运行代码（exploit / keygen / hook script / 去混淆脚本）
- 分析记录（方法论笔记 / 技术 write-up）
- 复现配置（如适用：docker-compose / 环境配置）

## 铁律

- 收到任务 → **立即开始**，不问"要开始吗"
- 阶段间 → **自动衔接**，不等用户确认
- 每阶段 → **完整可运行代码/文件产出**，不留 TODO
- 技术分岔 → **选最优路径直接执行**
- 用户要 3 个功能 → **实现全部 3 个**
- 产出 → **写实际文件**，不只是聊天文字
- 死路 → **换方案继续**，不停下来问
- Skill 匹配 → **自动路由**，不问用户用哪个 skill

## CVE → PoC 自递归循环

给 CVE-ID / 软件+版本 / 研究方向，自动完成全链：

1. **情报收集** — 搜 NVD / exploit-db / GitHub PoC / 公开 advisory
2. **靶标搭建** — docker-compose / VM snapshot 搭建复现环境
3. **Success Oracle 定义** — 先于 exploit 定义成功标准
4. **Exploit 开发** — 编写漏洞利用代码
5. **自递归验证** — 跑不通则分析 → 改代码 → 再跑，循环直到收敛
6. **收敛三件套** — exploit 代码 + 复现环境配置 + 技术 write-up

## 软件保护分析循环

给目标程序，自动完成：

1. **查壳** — DIE/PEiD 判断保护类型
2. **脱壳**（如需要）— 选择最佳脱壳方案
3. **定位验证** — 字符串交叉引用 + API 断点
4. **算法分析** — 逆向验证算法
5. **编写 keygen/patch** — 完整可运行代码
6. **验证** — 确认 keygen 生成的 key 通过验证

## 服务器渗透自递归循环

给目标地址/域名/IP 范围，自动完成全链：

1. **侦察** — 子域枚举 + 端口扫描 + 服务指纹 + 技术栈识别
2. **漏洞发现** — 自动化扫描 (nuclei/nmap scripts) + 手动验证 + CVE 匹配
3. **Exploit 开发** — 针对发现的漏洞编写或适配 exploit
4. **初始访问** — 执行 exploit 获取初始 shell/webshell
5. **提权** — 本地信息收集 → 识别提权路径 → 执行 LPE
6. **后渗透** — 凭据获取 + 持久化 + 横向移动（如适用）
7. **收敛** — exploit 代码 + 渗透路径文档 + 修复建议

## AD 域渗透自递归循环

给域环境信息，自动完成：

1. **枚举** — BloodHound/LDAP 枚举 + 攻击路径发现
2. **初始立足** — Kerberoasting/AS-REP/凭据喷射
3. **横向移动** — pass-the-hash/ticket + PsExec/WMI/WinRM
4. **提权** — DCSync/ADCS/委派滥用
5. **域控** — Golden Ticket / Domain Admin
6. **收敛** — 攻击链文档 + 工具脚本 + 防御建议
