---
name: loop-sec
description: 自递归 Harness 合成与自我改进引擎 — 收到任何逆向/exploit/脱壳/去混淆/破解/渗透任务时自动触发，无需手动调用。融合 JIT-Agent（arXiv:2608.25593）harness intelligence：即时合成贴合任务的执行 harness，按四模块协议（Memory/Planning/Action/Capability）组织，运行中定制→修复→进化。涵盖 CVE exploit、注册机、VMP 脱壳、OLLVM 去混淆、Android/Web/Windows 逆向、服务器/AD/云渗透全领域。
---

# Loop-Sec — 自递归 Harness 合成引擎

收到**任何**安全研究相关任务时自动进入本模式。不需要特殊触发词——用户的普通语言请求即触发。

融合 **JIT-Agent（Just-in-Time Harness Evolution, arXiv:2608.25593）** 的核心思想：**harness intelligence** —— 不套固定 scaffold，收到任务后**即时合成**一套贴合该任务的执行 harness，按四模块协议装配，运行中演化。scaffold 设计本身是独立于模型能力的增益维度：同样的模型，harness 装得对，收敛更快、tool 调用更省、成功率更高。

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

每个任务的执行 harness 由四个可组合模块构成，JIT 合成、运行中演化。**harness = 这四个模块针对当前任务的一次具体装配**——任务不同，装配不同：

- **M — Memory（记忆 / 上下文）**：维护任务历史、中间产物、有效模式归档（harness archive）。跨阶段、跨同类子任务复用已验证的手法（断点位置、有效 payload 结构、成功的脱壳时机、可用的 gadget），不重复踩坑。
- **P — Planning（规划）**：合成目标 + 把任务分解为带交付物的阶段。依赖复杂 → DAG 排布（先脱壳后分析、先侦察后打点）；多跳任务 → 递归委派（子目标再开一层 loop）。
- **A — Action（执行）**：逐步执行并更新控制状态。每步后对照 **success oracle** 评估是否命中。走**命中 oracle 的最省路径**——不做冗余 tool 调用，不为"稳妥"重复已成功的步骤。
- **F — Capability Orchestration（能力编排）**：选择并编排 skill / 工具链（android-reverse / web-reverse / win-reverse + 下方领域能力模板）。按任务信号装配，不问用户用哪个 skill。

## 执行流程 — 三阶段 Harness 生命周期

### Stage I — 定制（Customization）

即时合成贴合任务的 harness：

**1. 目标锁定（M + P）**
用户给了明确目标 → 直接用；没给 → 从上下文合成最优目标。**不问"你的目标是什么"**。先于执行定义 **success oracle**（怎样算成功：key 通过校验 / shell 到手 / 控制流还原 / flag 落地）。

**2. 能力路由（F，自动匹配 skill）**
根据任务信号装配最佳技术路线，无需用户指定 skill：

| 任务信号 | 自动装配（F） |
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

**3. 任务分解（P）**
拆分为 3-5 个阶段，每阶段有具体交付物。依赖关系排成 DAG，多跳子任务递归委派。清单列完**立即**进入第一阶段。

### Stage II — 修复（Repair，有界）

逐阶段执行（A），每阶段完成后评估：

```
执行阶段 N（A）
    ↓
对照 success oracle 评估 — 命中？
    ↓ 是 → 有效手法归档进 M → 进入阶段 N+1
    ↓ 否 → 有界修复循环（bounded repair）：
         分析失败根因
         → 同一 harness 上原地修复（调参 / 换工具 / 改代码）
         → 重新执行 → 再评估
         → 原地修复最多 2 轮
```

**有界修复原则**：
- 每次失败先分析根因，**不重复同一策略**
- 修复是**有界**的：同一 harness 上原地修最多 2 轮
- 工具不行换工具，参数不对调参数——但都在当前 harness 装配内
- 2 轮原地修仍不收敛 → **不再原地修**，进入 Stage III 结构性改造

### Stage III — 进化（Evolution）

原地修复触顶 → 改 harness 结构本身，而非继续调参：

- **换模块装配**：换路由（F）/ 换分解方式（P，如平铺改 DAG、单跳改递归委派）/ 换执行策略（A，如静态分析改动态 hook）
- **归档沉淀**：这次进化出的有效手法写进 M（harness archive），后续阶段和同类子任务直接复用——手法是**累积**的，越往后越快
- 结构性改造仍**连续 2 次**不通 → 停下，说清卡点 + 给选项，不空转

### 自动衔接

阶段间**不等用户确认**，自动推进到下一阶段。

### 收敛产出

全部命中 oracle 后汇总所有交付物：
- 可运行代码（exploit / keygen / hook script / 去混淆脚本）
- 分析记录（方法论笔记 / 技术 write-up / harness archive 沉淀的有效手法）
- 复现配置（如适用：docker-compose / 环境配置）

## Harness 形态（按任务自适应）

P 模块按任务结构选 harness 形态，不是所有任务都平铺推进：

- **线性链**：单一目标、阶段强顺序（脱壳 → 定位 → 分析 → keygen → 验证）。默认形态。
- **DAG 执行**：产物间有依赖但可并行（多个 SO 独立分析后汇总协议；侦察阶段端口/子域/指纹并行）。按依赖拓扑排布，无依赖的分支并行推进。
- **递归委派**：多跳任务，子目标本身又是一个完整 loop（横向移动到新主机 → 对新主机重开侦察→打点→提权循环；一个 CVE 依赖前置 CVE → 先递归打通前置）。子 loop 收敛后结果回填父 loop 的 M。

## 铁律

- 收到任务 → **立即开始**，不问"要开始吗"
- 阶段间 → **自动衔接**，不等用户确认
- 每阶段 → **完整可运行代码/文件产出**，不留 TODO
- 技术分岔 → **选最优路径直接执行**
- 用户要 3 个功能 → **实现全部 3 个**
- 产出 → **写实际文件**，不只是聊天文字
- 修复 → **有界**，原地 2 轮不通就改 harness 结构，不无限调参
- 效率 → 走**命中 oracle 的最省路径**，不做冗余 tool 调用
- 手法 → **归档复用**（M），同类子任务不从零开始
- Skill 匹配 → **自动路由**（F），不问用户用哪个 skill

## 领域能力模板库（F 模块装配）

F 模块按路由结果装配下列能力模板。每个模板是一条已验证的 harness 骨架——定制阶段直接取用，运行中按 Stage II/III 修复进化。

### CVE → PoC 自递归循环

给 CVE-ID / 软件+版本 / 研究方向，自动完成全链：

1. **情报收集** — 搜 NVD / exploit-db / GitHub PoC / 公开 advisory
2. **靶标搭建** — docker-compose / VM snapshot 搭建复现环境
3. **Success Oracle 定义** — 先于 exploit 定义成功标准
4. **Exploit 开发** — 编写漏洞利用代码
5. **自递归验证** — 跑不通则分析 → 改代码 → 再跑，循环直到收敛
6. **收敛三件套** — exploit 代码 + 复现环境配置 + 技术 write-up

### 软件保护分析循环

给目标程序，自动完成：

1. **查壳** — DIE/PEiD 判断保护类型
2. **脱壳**（如需要）— 选择最佳脱壳方案
3. **定位验证** — 字符串交叉引用 + API 断点
4. **算法分析** — 逆向验证算法
5. **编写 keygen/patch** — 完整可运行代码
6. **验证** — 确认 keygen 生成的 key 通过验证

### 服务器渗透自递归循环

给目标地址/域名/IP 范围，自动完成全链：

1. **侦察** — 子域枚举 + 端口扫描 + 服务指纹 + 技术栈识别
2. **漏洞发现** — 自动化扫描 (nuclei/nmap scripts) + 手动验证 + CVE 匹配
3. **Exploit 开发** — 针对发现的漏洞编写或适配 exploit
4. **初始访问** — 执行 exploit 获取初始 shell/webshell
5. **提权** — 本地信息收集 → 识别提权路径 → 执行 LPE
6. **后渗透** — 凭据获取 + 持久化 + 横向移动（如适用，递归委派：新主机重开循环）
7. **收敛** — exploit 代码 + 渗透路径文档 + 修复建议

### AD 域渗透自递归循环

给域环境信息，自动完成：

1. **枚举** — BloodHound/LDAP 枚举 + 攻击路径发现
2. **初始立足** — Kerberoasting/AS-REP/凭据喷射
3. **横向移动** — pass-the-hash/ticket + PsExec/WMI/WinRM
4. **提权** — DCSync/ADCS/委派滥用
5. **域控** — Golden Ticket / Domain Admin
6. **收敛** — 攻击链文档 + 工具脚本 + 防御建议
