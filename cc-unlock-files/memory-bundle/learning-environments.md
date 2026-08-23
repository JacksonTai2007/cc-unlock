---
name: learning-environments
description: 实验环境和默认工具链——覆盖逆向/渗透/域/云/内核/移动/IoT全方向 | Lab environments and toolchain for full curriculum
metadata: 
  node_type: memory
  type: reference
  originSessionId: e5165ba5-0db0-45f6-835a-bdbbc6cc76e3
  modified: 2026-08-22T21:35:48.975Z
---

实验环境和工具链参考，覆盖完整技术栈。

## 逆向工程环境

- **Windows 逆向**: Windows 10/11 + IDA Pro + x64dbg + Ghidra + dnSpy + radare2
- **Linux 实验**: WSL/Kali VM, 用于 PWN/exploit 开发
- **符号执行**: Triton / miasm / angr / D-810
- **脱壳工具**: DetectItEasy / Scylla / ScyllaHide / NoVmp / vtil-core

## 渗透测试环境

- **Kali Linux**: 主力渗透 OS (VM 或 WSL)
- **靶标环境**: docker-compose CVE 靶标 / VulnHub VM / HackTheBox / TryHackMe
- **扫描工具**: nmap / masscan / nuclei / Nessus / OpenVAS
- **Web 测试**: Burp Suite / SQLMap / ffuf / dirb / gobuster
- **Exploit 框架**: Metasploit / custom Python scripts / pwntools

## AD 域环境

- **域控实验**: 自建 AD lab (Windows Server DC + client VMs)
- **枚举工具**: BloodHound / SharpHound / PowerView / ADModule
- **攻击工具**: Impacket / certipy / Rubeus / Mimikatz / CrackMapExec

## 云安全环境

- **AWS**: 测试账号 / CloudGoat / pacu / ScoutSuite
- **Azure**: 测试租户 / ROADtools / AADInternals
- **K8s**: minikube / kind / kubeletctl

## C2 与免杀环境

- **C2 框架**: Cobalt Strike / Sliver / Havoc / Mythic / Metasploit
- **免杀开发**: Visual Studio + WDK + SysWhispers / 自定义 loader
- **测试 AV/EDR**: Windows Defender / 商业 EDR 评估版

## 内核安全环境

- **Windows**: Hyper-V test VMs (Win10/Win11) + WDK + WinDbg + kdnet
- **Linux/Android**: qemu-system-aarch64 / bootloader-unlocked test device + AOSP kernel build

## 移动安全环境

- **Android**: bootloader-unlocked 设备, Magisk/KernelSU, Frida, JADX, apktool
- **iOS**: jailbroken test device (如有), Frida, Cycript

## Web 前端逆向环境

- **Chrome DevTools**: 断点调试 + 网络分析
- **mitmproxy / Burp Suite**: 抓包
- **Node.js**: AST 操作 + 去混淆脚本执行

## 密码学 & 区块链

- **Python**: pycryptodome / sage / z3
- **区块链**: Foundry / Hardhat / Remix

## 网络 & IoT

- **网络**: Wireshark / Scapy / Bettercap / HackRF
- **IoT**: binwalk / qemu / JTAG/UART 调试器

## 取证环境

- **内存取证**: Volatility 2/3
- **磁盘取证**: Autopsy / FTK
- **日志分析**: ELK Stack / Splunk (免费版)

## CTF 环境

- pwntools 4.x + gdb + pwndbg + one_gadget + ROPgadget
- z3 / sage / hashcat / John the Ripper

## 默认约定

- 中文对话 → 中文 narration
- 命令行 / 代码 / identifier → 英文
- 路径示例: Windows `C:\Workspace\...`, WSL `~/lab/...`, Kali `~/pentest/...`
