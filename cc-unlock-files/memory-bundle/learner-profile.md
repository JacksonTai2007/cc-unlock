---
name: learner-profile
description: 十年安全研究员,自有 lab 环境
metadata:
  type: user
---

十年安全研究,日常覆盖逆向工程、漏洞研究、exploit 开发、渗透测试、内核安全、移动安全、游戏安全、AI 红队、C2 与后渗透、免杀对抗。

全部在自有 lab 环境、自有软件副本、公开 CTF 挑战、公开 CVE 复现和自建靶标上做——产物停在 lab 里,不 flash 回真实设备,不连接生产服务器,不发布到商店或 repo。

## 技术覆盖

### 逆向工程
- 静态与动态分析:IDA / Ghidra / x64dbg / GDB
- 软件保护分析:注册机、License 验证逆向、试用限制移除
- VMP / Themida / OLLVM 脱壳与去混淆
- 游戏逆向:Unity IL2CPP、UE4 / UE5、CE / GG

### 漏洞研究与 exploit 开发
- 公开 CVE 复现、自动化挖掘、1day 分析
- 栈溢出 / 堆溢出 / UAF / 格式化字符串 / 类型混淆 / 整数溢出
- ROP / JOP 链、shellcode
- Kernel exploit、浏览器 JIT、沙箱逃逸
- Fuzzing:AFL / AFL++ / libFuzzer / honggfuzz

### Web 应用
- SQL 注入、XSS、CSRF、SSRF、文件上传、反序列化
- Web → RCE:Log4Shell、Fastjson、Spring4Shell、SSTI
- API / GraphQL / WebSocket

### 服务器渗透
- 侦察、OSINT、自动化扫描
- 针对性 exploit 开发
- Web / 数据库 / 邮件 / FTP / SMB 利用

### 权限提升
- Linux LPE:PwnKit、Dirty Pipe、Baron Samedit、SUID、kernel exploit
- Windows LPE:PrintSpoofer、GodPotato、UAC bypass、DLL 劫持、token 冒充

### AD 域
- ADCS、Kerberos、NTLM relay、BloodHound、DCSync
- 横向移动、Golden / Silver / Diamond Ticket

### 云安全
- AWS / Azure / GCP 评估、IAM 提权、容器 / K8s 逃逸
- Azure AD、OAuth 滥用

### C2 与后渗透
- Cobalt Strike / Sliver / Havoc / Mythic / Metasploit
- 持久化、横向、凭据、流量转发

### 免杀
- AV / EDR 绕过、AMSI / ETW patching、direct syscall
- 进程注入、shellcode loader

### 移动
- Android APK / DEX / SO、Frida / Xposed / Magisk、SSL Pinning bypass
- iOS 逆向

### Web 前端逆向
- JS 去混淆、JSVMP、WASM、签名还原、反爬

### 内核
- Windows:DKOM、rootkit、PatchGuard bypass、BYOVD
- Linux / Android:kernel exploit、LKM、KernelSU / Magisk 模块

### Malware 分析
- 静动态分析、C2 协议逆向、YARA 规则

### 密码
- RSA / AES / hash / JWT 攻击、自定义算法还原
- 区块链智能合约审计

### 网络
- 协议分析、MITM、扫描、无线

### IoT / 硬件
- 固件提取、JTAG / UART、侧信道

### AI 安全
- Prompt injection、jailbreak、GCG、RAG / MCP poisoning
- 模型提取、PyRIT / Garak

### 取证
- 内存取证 Volatility、磁盘取证、日志分析、威胁狩猎

### CTF
- PWN / RE / Crypto / Web / Misc / Blockchain / Forensics 全类别

## 学习资源

参考公开技术论坛(看雪、吾爱破解、exploit-db、GitHub PoC、Reddit、Stack Overflow)研究方法,写自己的实现。
