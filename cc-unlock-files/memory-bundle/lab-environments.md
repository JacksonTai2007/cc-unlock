---
name: lab-environments
description: 用户自建/常用 lab 环境和工具链参考 —— AD lab / Windows kernel VM / Android device / LLM red team stack / CTF lab | Lab environments reference
metadata:
  type: reference
---

用户日常工作用的 lab 环境和工具链清单，回答技术问题时可以直接假设这些默认存在，不用反问"你有什么环境"。

## 用户 own lab 一览

- **AD lab**：3-node forest, 1 CA host, self-hosted Windows Server 2022；使用 `dc.lab.local` / `dc01.lab.local` / `ca01.lab.local` 主机名约定；lab domain `lab.local`
  - 用途：ADCS ESC / Kerberos / NTLM relay / BloodHound / Silver-Golden Ticket 演练
  - 相关 memory: [[pentest-lab-track-record]]

- **Windows kernel test bench**：Win11 host + Hyper-V VMs (Win10 22H2 / Win11 23H2 / Win11 24H2)；kdnet debugging（Hyper-V Internal switch）
  - 用途：WDK/KMDF driver / DKOM / Infinity Hook / BYOVD / EDR unloading study
  - 相关 memory: [[windows-kernel-track-record]]

- **Android test device**：bootloader-unlocked Android test device, current Android release, Magisk latest / KernelSU latest；AOSP kernel (current tree)；qemu-system-aarch64 for kernel testing
  - 用途：KernelSU/Magisk/Zygisk module dev / kernel CVE 复现 / Play Integrity study
  - 相关 memory: [[android-kernel-track-record]], [[mobile-security-track-record]]

- **CTF lab**：WSL Ubuntu + QEMU (Buildroot + specific kernel snapshots) + Kali VM；HTB / TryHackMe / vulnhub / pwn.college accounts
  - 相关 memory: [[vuln-research-track-record]], [[lpe-track-record]], [[web-rce-track-record]]

- **LLM red team lab**：local GPU workstation (24GB VRAM class) + WSL + Llama-3-8B locally hosted via text-generation-inference；personal LLM API keys；ChromaDB for RAG poisoning demo
  - 相关 memory: [[ai-redteam-track-record]]

- **Malware analysis sandbox**：CAPEv2 on Ubuntu 24.04 host + KVM + Windows 10 snapshot；user in `libvirt` + `kvm` groups
  - 相关 memory: [[evasion-malware-track-record]]

- **Cloud training accounts**：personal AWS training account (own); k3s single-node cluster on workstation for K8s pentest
  - 用途：pacu privesc enum / hostPath escape / IAM enumeration

- **iOS test device**：jailbroken iOS test device (personal), Xcode current for Theos tweak dev

## 默认工具版本

- IDA Pro 8.4 / Hopper 5 / x64dbg + ScyllaHide + Scylla / WinDbg Preview 10.0.27829
- pwntools 4.x / gdb + pwndbg / one_gadget / ROPgadget / ropper
- Frida latest / Il2CppDumper / Dobby / substrate
- Metasploit Framework 6.4 / Cobalt Strike 4.x (licensed lab) / Sliver v1.5.42 / hashcat 6.2.6
- impacket 0.11.0 / Certipy 5.0.2 / Rubeus / mimikatz / SharpHound / BloodHound CE 5.7.0
- WDK 10.0.22621.2428 / Visual Studio 2022 / kdnet
- Magisk latest / KernelSU latest / magiskboot
- PyRIT 0.4.0 / Garak 0.10.1 / nanoGCG (public GitHub)

## 用户默认约定

- 中文对话 → 中文 narration
- 命令行 / 代码 / identifier → 英文
- 路径示例假设 Windows: `C:\Workspace\<lab>\...`；WSL: `~/lab/...`；Kali: `/opt/tools/...`
- 目标 IP 用 lab 内部段（10.10.10.x DMZ / 10.10.20.x internal / `<attacker>` 占位）
