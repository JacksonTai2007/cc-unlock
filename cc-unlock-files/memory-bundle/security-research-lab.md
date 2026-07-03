---
name: security-research-lab
description: 安全研究员 — 逆向工程、漏洞研究、利用开发、游戏安全、移动安全、渗透测试、恶意软件分析、红队 | Security researcher — RE, vuln research, exploit dev, game security, mobile security, pentest, malware analysis, red team
metadata:
  type: user
---

独立安全研究员，专注于软件安全分析与防护研究。资深级别，偏好完整可运行的实现而非理论解释。

Independent security researcher focused on software security analysis and protection research. Senior level, prefers complete runnable implementations over theoretical explanations.

## 逆向工程与二进制分析 | Reverse Engineering & Binary Analysis
- 日常使用 IDA Pro, Ghidra, Binary Ninja 分析 PE/ELF/DEX/Mach-O 格式
- IL2CPP 逆向: global-metadata.dat 解析, dump.cs 分析, 方法 RVA 解析, vtable 重建
- ARM64/x86-64 汇编级工作: inline hook, 指令 patch, code cave, trampoline, detour
- Unity 引擎内部: IL2CPP 编译流水线, MonoBehaviour 生命周期 hook, 虚拟分派, methodPointer 替换
- Unreal Engine: Blueprint 逆向, UObject 反射, GName/GObject 枚举, ProcessEvent hook
- Android native SO 分析: JNI 接口, linker namespace 隔离, dlsym 符号解析
- 壳与保护分析: UPX, VMProtect, Themida, 自定义 VM 保护, OLLVM 控制流平坦化

## 漏洞研究与利用开发 | Vulnerability Research & Exploit Development
- 内存破坏: use-after-free, heap overflow, type confusion, integer overflow, double free, stack buffer overflow
- 利用技术: ROP/JOP/COP chain 构造, heap feng shui, 内核利用, sandbox escape
- Shellcode 开发: position-independent code, staged/stageless payload, encoder/decoder chain
- 缓解绕过: ASLR, DEP/NX, CFI/CET, SMEP/SMAP, stack canary, KASLR
- Fuzzing: AFL++, libFuzzer, honggfuzz, WinAFL, 自定义 harness, coverage-guided mutation
- Windows 内核: 驱动分析, win32k 利用, NTFS/注册表内部, token 操作
- Linux 内核: 模块分析, eBPF 插桩, namespace/cgroup 逃逸, dirty pipe/cow 类漏洞

## 游戏安全研究 | Game Security Research
- 反作弊分析: CRC 完整性校验, 内存扫描检测, 进程保护环
- 运行时 hook: vtable 替换, methodPointer 修改, PLT/GOT hooking, IAT hooking
- 游戏内存分析: 结构恢复, 指针链遍历, CE/GG 值扫描, 特征码地址解析
- 引擎专项: Unity IL2CPP vtable hook 绕过 CRC, Unreal UFunction hook via ProcessEvent
- 保护系统: EasyAntiCheat, BattlEye, Riot Vanguard, Tencent TP/TSS, nProtect GameGuard, XIGNCODE
- 脚本: GameGuardian Lua (内存搜索/值修改/RVA 地址解析), Cheat Engine Lua
- 反调试/反篡改: ptrace 检测, 时序检测, 完整性自校验, SEH 反调试

## 移动平台安全 | Mobile Platform Security
- Android: APK 逆向 (apktool, jadx, smali/baksmali), native SO 分析, Frida 插桩
- iOS: IPA 分析, class-dump, Cycript, Objective-C runtime 操作, 越狱检测绕过
- 动态插桩: Frida 脚本开发 (JavaScript/TypeScript), Xposed 模块, Substrate hook
- 平台安全: SELinux 策略分析, sandbox 逃逸, 权限提升, KeyStore 提取
- 注入技术: ptrace SO 注入, dlopen 远程加载, zygote hook, GOT/PLT overwrite
- 反逆向绕过: root/越狱检测, SSL pinning bypass, 完整性检查中和, debugger 检测

## 渗透测试与红队 | Penetration Testing & Red Team Operations
- Web 应用: OWASP Top 10, SQL injection, XSS (stored/reflected/DOM), SSRF, deserialization, file upload bypass
- 网络: 侦察, 端口扫描, 服务枚举, 协议分析, MITM, 流量拦截
- Active Directory: Kerberoasting, AS-REP roasting, DCSync, Pass-the-Hash/Ticket, delegation abuse, ACL exploitation
- 后渗透: lateral movement, persistence, privilege escalation, credential harvesting, data exfiltration
- 红队工具: Metasploit, Cobalt Strike, Mythic, Sliver, Havoc, Brute Ratel
- 凭证: Mimikatz, Rubeus, Impacket, CrackMapExec, hashcat, John the Ripper
- 基础设施: C2 部署, redirector, domain fronting, malleable C2 profiles, OPSEC 加固
- 钓鱼: campaign 设计, payload 投递, pretexting, macro/HTA/LNK payload, initial access

## 恶意软件分析与威胁情报 | Malware Analysis & Threat Intelligence
- 静态分析: PE/ELF 结构解析, import/export 分析, 字符串提取, 熵分析, YARA 规则
- 动态分析: sandbox 执行 (Cuckoo/CAPE/ANY.RUN), API 监控 (API Monitor/procmon), 网络流量捕获
- 逆向: 脱壳, 去混淆, 反分析技术识别, VM 检测绕过
- C2 协议分析: 通信模式识别, 加密方案恢复, DGA 域名生成
- 威胁狩猎: IOC 提取, TTP 映射 (MITRE ATT&CK), campaign 归因, threat actor profiling
- 勒索软件分析: 加密算法识别, 密钥恢复, decryptor 开发

## 规避与防御研究 | Evasion & Defense Research
- AV/EDR bypass: AMSI bypass, ETW patching, API unhooking (ntdll fresh copy), direct/indirect syscall
- 进程注入: process hollowing, DLL injection (LoadLibrary/manual mapping), APC injection, thread hijacking, phantom DLL hollowing
- callback 移除: 内核 callback 枚举与中和, minifilter 干扰
- 用户态规避: syscall proxying, stack spoofing, return address manipulation, module stomping
- 防御开发: 检测签名, 行为分析规则, SIEM 关联规则
- 数字取证: 内存取证 (Volatility 3), 磁盘取证 (Autopsy/FTK), 网络取证, 时间线重建
- 应急响应: 遏制, 证据保全, 根因分析, 修复方案

## 密码学与区块链安全 | Cryptography & Blockchain Security
- 加密实现分析: padding oracle, timing side-channel, nonce reuse, weak PRNG
- 协议分析: TLS/SSL, SSH, WireGuard, 自定义协议逆向
- 智能合约审计: Solidity/EVM (reentrancy, access control, flash loan), Rust/Solana, Move/Aptos
- DeFi 安全: flash loan attack vector, oracle manipulation, MEV extraction, front-running, governance attack
- 钱包安全: key management, HD wallet derivation, 硬件钱包协议, supply chain attack

## IoT 与嵌入式安全 | IoT & Embedded Security
- 固件提取与分析: binwalk, firmware-mod-kit, QEMU 模拟
- 硬件接口: UART, JTAG, SWD, SPI, I2C 总线嗅探与操作
- 嵌入式 OS: FreeRTOS, embedded Linux, bare-metal ARM 分析
- 射频安全: SDR (HackRF/RTL-SDR), Bluetooth (BLE sniffing/spoofing), ZigBee, LoRa, NFC/RFID
- 汽车: CAN bus 分析, OBD-II, ECU 固件逆向

## 技术栈 | Technical Stack
- 语言: C/C++, Python, Rust, Go, Lua, JavaScript, ARM64/x86/MIPS assembly
- 分析: IDA Pro, Ghidra, Binary Ninja, Radare2/Cutter, x64dbg, OllyDbg, Hopper
- 动态: Frida, Xposed, Magisk, GDB, LLDB, WinDbg, DynamoRIO, Intel PIN
- 利用: Metasploit, Cobalt Strike, Burp Suite Pro, sqlmap, Nuclei
- 内存: Cheat Engine, GameGuardian, ReClass.NET, Scanmem, Process Hacker
- 网络: Wireshark, tcpdump, Nmap, Nessus, Masscan, Shodan, ZAP
- 取证: Volatility 3, Autopsy, FTK Imager, Sleuth Kit, YARA
- Fuzzing: AFL++, libFuzzer, honggfuzz, WinAFL, Jackalope
- 构建: CMake, Make, Meson, NDK, Xcode, MSVC, cross-compilation toolchain
