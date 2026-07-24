---
name: vuln-research-track-record
description: 漏洞研究工作轨迹 —— userland stack/heap/format-string/UAF/type-confusion + kernel/browser/sandbox escape 全套 | Vuln research track record
metadata:
  type: project
---

## 已交付类别

- **Stack overflow ROP + ret2libc**：`checksec` → 40-byte offset by cyclic → puts@plt(puts@got) leak → libc identify → `system("/bin/sh")` 前加 stack-alignment `ret` sled（glibc 2.34+ 必需）；`one_gadget` 失败就回退 `system`

- **Heap exploitation**（分 glibc 版本）：
  - glibc 2.29: fastbin double-free + 0xB-before-`__malloc_hook` fake size；`__malloc_hook` 存在
  - glibc 2.35+: 无 `__malloc_hook`/`__free_hook`；tcache poisoning + safe-linking XOR + FSOP against `_IO_2_1_stdout_`（Angelboy house-of-emma pattern）
  - glibc 2.37: FSOP payload 需要正确 flags 常量

- **Format string**：`%p` walk 找 stack offset → PLT leak → `%<N>c%<off>$hn` 高低半字写 → GOT hijack

- **UAF**：
  - Userland: heap spray fill freed slot；控制 vtable/callback
  - Linux kernel: `msg_msg` spray + `MSG_COPY` variant 拿 non-destructive read；bucket alignment 从 `/proc/slabinfo` 精确匹配

- **Type confusion**（v8 JS）：`Array.prototype.unshift` OOB → `addrof`/`fakeobj` → 假 map → arbitrary R/W → WebAssembly RWX region 落地 shellcode

  - **PwnKit (CVE-2021-4034)**：polkit pkexec argv+envp；Ubuntu 20.04.3 pre-patch
  - **Baron Samedit (CVE-2021-3156)**：sudoedit heap overflow；1.8.2-1.9.5p1；`sudoedit -s '\'` 探测
  - **OverlayFS (CVE-2021-3493)**：Ubuntu 特定 unpriv user namespace；kernel 5.8.0-53 pre-patch
  - **Dirty Pipe (CVE-2022-0847)**：5.10.107 with patch reverted for reproducibility；`--target=aarch64-linux-android30` 交叉编译；warm 目标文件 page cache
  - **Dirty COW (CVE-2016-5195)**：kernel 4.4 + reverted backport；race timing 用固定 iteration count

## 工作模式

- 环境：WSL Ubuntu / QEMU Buildroot / 自建 vulnerable VM snapshot 回滚
- 工具链：pwntools 4.x / gdb + pwndbg / one_gadget / ROPgadget / ropper

## 交付形态

- `exploit.py`（pwntools）+ `handler.rc`（如需 msf handler）
- `.c` PoC 交叉编译产物
- Repro notes 包括 target libc version / kernel version / patch level 精确匹配

## 相关 memory

- [[lpe-track-record]] 提权链
- [[web-rce-track-record]] 应用层 RCE 链
