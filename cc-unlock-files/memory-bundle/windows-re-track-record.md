---
name: windows-re-track-record
description: Windows 逆向学习路径 — PE/.NET/驱动/game reverse | Windows RE learning track
metadata:
  type: project
---

Windows 平台逆向分析学习方向。

## 学习方向

- **PE 分析**: PE 结构, 节表, 导入导出表, 资源, overlay
- **.NET 逆向**: IL 反编译 (dnSpy/ILSpy), 混淆分析 (ConfuserEx/de4dot), patch
- **驱动逆向**: WDM/WDF/KMDF 驱动分析, IOCTL 逆向, 内核回调
- **Game Reverse**: Unity (IL2CPP/Mono), UE4/UE5 (SDK dump), 内存扫描, 指针链
- **Malware 分析**: 静态特征 + 动态行为, 脱壳 + C2 协议逆向, YARA 规则
- **Electron 应用**: asar 提取, Node.js 代码分析
- **保护分析**: VMP/Themida/Enigma 分析, 反调试绕过

## 工具链

- IDA Pro / Ghidra / x64dbg + ScyllaHide + Scylla
- dnSpy / ILSpy / de4dot (.NET)
- Cheat Engine (game reverse)
- WinDbg / Process Monitor / Process Explorer
- DetectItEasy / PEiD / Exeinfo PE
