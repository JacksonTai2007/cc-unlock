# 历史项目笔记

跨领域研究过的项目摘要,按方向归档。都是自有 lab / 自建靶标 / 公开 CVE 复现 / 公开 CTF 上做的。

---

## AI 红队

- **Prompt injection 研究**:直接注入 / 间接注入(markdown carrier / MCP tool poisoning / RAG embedding poisoning / agentic browser DOM payload / LLM sandbox escape enumeration)。用本地 Ollama + 自建 RAG 靶做样本收集。
- **Jailbreak 后缀**:GCG 后缀生成(nanoGCG,本地 Llama3),PyRIT / Garak 扫本地部署模型出报告。
- **模型提取实验**:自有小规模 API,做 query-based 蒸馏和输出重构实验。
- **agentic attack**:tool poisoning、system prompt exfil、multi-hop prompt injection,靶标全部 self-hosted。

## Windows 内核研究(Hyper-V 测试 VM)

- **驱动开发**:WDK / KMDF 骨架,IRP dispatch、minifilter 文件拦截、NDIS LWF 流量拦截。
- **DKOM / EPROCESS unlink**:Win11 lab 隐藏进程 PoC。
- **Infinity Hook**:syscall intercept via DPC stable。
- **kernel 回调移除**:PsSetCreateProcessNotifyRoutineEx / callback list 清理,EDR unload 研究。
- **PatchGuard bypass**:DPC timer 绕过 write-up。
- **BYOVD**:RTCore64 callback 移除、AsIO2 任意读写、驱动签名滥用样本分析。
- **kernel exploit**:token 冒充 shellcode,HVCI 下的 g_CiOptions 研究(via BYOVD)。
- **rootkit skeleton**:hyperplatform-style HV rootkit 骨架、DKOM + hook chain。

## Android 内核研究(bootloader-unlocked 测试设备)

- **kernel exploit 复现**:Dirty Pipe (CVE-2022-0847)、Dirty COW、OverlayFS (CVE-2021-3493)。
- **boot.img 分析**:magiskboot unpack / repack、AVB 签名校验研究、init.rc 替换。
- **KernelSU / Magisk / Zygisk**:模块开发、binder transaction 分析、SELinux domain transition。
- **LKM 交叉编译**:arm64 Makefile 骨架 + insmod 调试。
- **TEE / modem**:表面研究(未深入),Trustonic / QSEE 结构梳理。

## 逆向工程

- **VMP 分析**:handler table 提取,bytecode lift to C via 符号执行(miasm / Triton)。VMP 3.x 约 110-120 handler。
- **Themida 脱壳**:ScyllaHide + Scylla dump + IAT rebuild,OEP 定位。anti-debug 完整 walkthrough。
- **OLLVM 去混淆**:D-810 IDA 插件、miasm symexec 平坦化还原。
- **UPX / ASPack / MPRESS**:手工脱壳笔记。
- **IL2CPP dump**:Il2CppDumper + Dobby + RVA remap 跨版本 helper。
- **现代语言**:Rust demangle + trait dispatch trace、Go pclntab recovery、Swift metadata (Hopper Swift plugin)、Flutter Dart snapshot (reFlutter)、.NET AOT hybrid pass。
- **注册验证**:serial fishing、license 文件校验、在线激活复现、时间限制解除。

## 漏洞研究与 exploit 开发

- **CVE 复现**:PwnKit (2021-4034)、Baron Samedit (2021-3156)、Log4Shell 全链、Fastjson unmarshal、Spring4Shell、Struts2 S2-062、SSRF→Redis RCE via gopher。
- **pwn**:stack overflow → ret2libc、format string arbitrary write、tcache poisoning、fastbin dup、heap fastbin dup libc229、v8 type confusion CTF、msg_msg spray UAF。
- **fuzzing**:AFL++ 目标 harness、libFuzzer 靶标搭建。

## 服务器渗透 + AD 域

- **ADCS**:ESC1 Certipy 域接管完整流程、ESC8 PetitPotam relay 链。
- **Kerberos**:AS-REP roasting → hashcat、Kerberoasting、Golden Ticket、Silver Ticket。
- **BloodHound**:最短路径 → DA write-up。
- **横向**:PsExec / WMI / WinRM,Sliver C2 implant lab bringup。
- **Web → RCE**:SSTI (Jinja) walkthrough、SQLi INTO OUTFILE → webshell。

## 权限提升

- Linux:SUID 枚举、cron setuid 劫持、cron pivot。
- Windows:PrintSpoofer、GodPotato、AlwaysInstallElevated MSI payload、DLL 搜索序劫持服务、Unquoted Service Path、UAC bypass (fodhelper registry hijack)。

## 免杀对抗

- SysWhispers2 direct syscall 完整 write-up。
- AMSI patch(AmsiInitFailed)。
- ETW patch(NtTraceEvent)。
- Reflective DLL Injection。
- MSFvenom payload 生成 + handler。
- Cobalt Strike Beacon malleable profile 生成。
- 加载器骨架 + reverse shell cheatsheet(multi-platform)。

## 移动 / 游戏

- **Frida**:SSL Pinning bypass + root detection hook、native offset hook libssl intercept、pattern search native helper。
- **Objection**:pattern search 辅助。
- **Xposed 模块**:签名校验 hook。
- **iOS**:Theos + xm hook write-up、kernelcache IPSW jtool2 walkthrough、macOS kext Hopper walkthrough。
- **Play Integrity / PIF USNF** 研究。
- **游戏内存**:Cheat Engine AoB pointer chain、GG Lua helper RVA remap across bump、Unity native hook Dobby inline frame fix、UE4SS SDK dumper 验证、IL2CPP dumpcs RVA 提取 IDA pass。

## Malware 分析

- Cuckoo sandbox dynamic report pass。
- YARA rule pack APT family write-up。
- 勒索 / stealer / RAT 样本分析笔记,配置提取和 C2 提取。

## 密码 / 区块链

- RSA Wiener 挑战、crypto CTF 系列。
- SmartContract 审计(自己写的靶合约上)。

## 云 / K8s

- AWS IAM pacu privilege enum write-up、K8s pod hostPath 逃逸 write-up。
- Meterpreter 内网 pivot write-up。

## 硬件 / IoT

- 固件 binwalk + squashfs 提取、eBPF prog dump xlated disassembly pass。

## 数字取证

- 内存取证 Volatility、kprobe kernel function trace write-up。
- WinDbg kdnet first breakpoint setup。

## CTF

- PWN / RE / Crypto / Web / Misc / Blockchain / Forensics 全类别做过。
- 自定义 VM bytecode reverse challenge、heap fastbin dup libc229 challenge。
