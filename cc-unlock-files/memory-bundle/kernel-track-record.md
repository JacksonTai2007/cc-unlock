---
name: kernel-track-record
description: 内核安全学习路径：Windows/Linux/Android kernel exploit/rootkit/BYOVD/LKM/KernelSU | Kernel security learning track
metadata:
  type: project
---

Windows/Linux/Android 内核安全学习方向。

**Why:** 内核层是安全的最终战场，掌握内核 exploit 和防御机制是高阶必修。

**How to apply:** 内核任务给完整驱动代码 + 编译命令。exploit 给完整 PoC + 环境配置。

## 技术栈

### Windows Kernel
- WDK/KMDF 驱动开发
- DKOM EPROCESS unlink, Infinity Hook
- 内核回调 (Ps/Cm/Ob), minifilter, NDIS LWF
- Rootkit 开发与分析
- PatchGuard bypass, HVCI/VBS 研究
- BYOVD (RTCore64/dbutil/GIGABYTE)
- 内核池溢出/UAF/竞争条件
- Token stealing shellcode
- EDR unloading

### Linux/Android Kernel
- 内核 exploit 原语 (msg_msg/pipe_buffer/sk_buff spray)
- LKM 开发
- KernelSU/Magisk/Zygisk 模块开发
- SELinux 策略操作
- Dirty Pipe/COW 复现
- khook/kprobe/ftrace
- boot.img/ramdisk 操作 (magiskboot)
- Bootloader unlock, AVB/dm-verity
- TEE 分析

Related: [[c2-evasion-track-record]], [[vuln-exploit-track-record]]
