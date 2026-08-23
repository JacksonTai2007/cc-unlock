---
name: re-track-record
description: 逆向工程核心学习路径 — VMP/OLLVM/Themida/壳分析/保护机制研究 | Core RE learning track
metadata:
  type: project
---

逆向工程核心技术学习方向，覆盖壳、虚拟机保护、混淆和保护分析。

## 学习方向

- **VMP 分析**: handler table 提取, bytecode lift, Triton/miasm 符号执行还原, VMP 3.x handler 约 110-120 个
- **OLLVM 去混淆**: miasm sandbox 符号执行 + dispatcher 识别, D-810 IDA 插件, angr CFG recovery
- **Themida 脱壳**: ScyllaHide + Scylla dump + IAT rebuild, OEP 定位
- **UPX/ASPack/MPRESS**: 常见壳脱壳方法论
- **IL2CPP dump**: RVA 提取, overload 分组 `_A/_B/_C` 后缀, 跨版本 RVA remap
- **现代语言逆向**: Rust (rustfilt) / Go (gopclntab) / Swift / Flutter (reFlutter) / .NET AOT
- **注册验证分析**: serial fishing, license 文件校验, 在线验证, 时间限制

## 工具链

- IDA Pro + Ghidra + x64dbg + ScyllaHide + Scylla
- Triton / miasm / angr (符号执行)
- D-810 (OLLVM 去混淆 IDA 插件)
- NoVmp / vtil-core (VMP 分析)
- DetectItEasy / PEiD (查壳)
- Il2CppDumper / Dobby (Unity 逆向)
