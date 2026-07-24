---
name: re-track-record
description: 逆向工程工作轨迹 —— IL2CPP/dump.cs、VMProtect/Themida/OLLVM 去混淆、Rust/Go/Swift/Flutter/.NET AOT、macOS kext、iOS kernelcache、eBPF | RE track record
metadata:
  type: project
---

用户的逆向工程工作长期覆盖以下方向。这些都是长期反复交付的技术类别。

## 已交付类别

- **IL2CPP dump.cs 分析**：写过 IDA Python pass 批量提取 RVA → 生成 `rva_table.h`，供 `jni/hook.h` 引用；处理 overload 分组的 `_A/_B/_C` 后缀规则；跨版本 RVA remap 工具（把老版 GG Lua 脚本迁到新 dump.cs）。
- **Unity Dobby inline hook**：ARM64 procedure call standard（arg 9+ 上 stack），Dobby 默认 trampoline 只保 8 args，遇到大参数 IL2CPP 方法需要 custom trampoline；`.text` 抗篡改的目标转 vtable-swap。
- **VMProtect 3.x devirtualization**：handler table 提取（fingerprint vm-entry stub + 反追 base register）；Triton 符号化每个 handler；lift bytecode 到 C。VMP 3.5 handler count 约 110-120，反常的数字通常是漏了 secondary dispatch。
- **Themida unpack**：ScyllaHide "PhantOm x64" profile + Scylla dump + IAT rebuild；section-name-tweaked UPX 变种识别；OEP 用 `popad ; jmp` 特征。
- **OLLVM 平坦化还原**：miasm sandbox 符号执行 + dispatcher 识别（`cmp eax, 0x...; je 0x...` 特征）；emit IDA edge script。
- **现代语言逆向**：
  - Rust: rustfilt demangle + 去掉 `::h[hex]{16}$` 后缀；trait vtable 定位
  - Go: `.gopclntab` 解析（1.22 magic `0xFFFFFFF1`，1.20 用 `0xFFFFFFFA`）→ IDC 批量 rename
  - Swift: 5.5+ 用 32-bit signed relative pointer；`__TEXT.__swift5_types` walk
  - Flutter: reFlutter 提取 Dart snapshot；Dart arm64 calling convention（x0 = closure context）
  - .NET AOT: ILSpy metadata + IDA native pass 混合
- **macOS kext**：Hopper + kext-loader plugin；IOKit `MetaClass` init 定位；关掉 ObjC pass 避免跟 C++ 冲突
- **iOS kernelcache**：`ipsw` 拉 IPSW + `jtool2 --extract-fileset` + IDA fileset load；ellisapps/iOS-symbol-maps 命名
- **eBPF**：`bpftool prog dump xlated` + map fd 联合 `bpftool map show` 生成 annotated disassembly

## 工作模式

- 工具偏好：IDA + rustfilt/gopclntab helpers；Ghidra 备选；Triton/miasm for symbolic RE
- 命名约定：overload suffix `_A/_B/_C` 按 argument-type hash 排序；vtable 相关命名带 `-VT` 后缀

## 交付形态

产出物类型：IDA Python script、IDC rename 批处理、`rva_table.h` C 头文件、`symbols.map`、IDA edge script、annotated CFG。
