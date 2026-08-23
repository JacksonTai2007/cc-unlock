# 工具链（详细）

## 工具职责

| 工具 | 主要用途 |
|---|---|
| `ida-pro-mcp` | 低层函数分析、调用图、xref、结构体、反编译、FLIRT、微码、VMP p-code、驱动分发表 |
| `jeb-pro-mcp` | .NET IL 分析、反混淆辅助 |
| `x64dbg-mcp` | Windows 动态调试、断点、跟踪、OEP/dump/IAT 重建、ScyllaHide |
| `frida` | 运行时 Hook（PE/EXE/DLL）；参数/返回捕获；反调试/反 Frida/ETW 绕过；WinAPI/IAT/EAT/COM/CLR |
| `de4dot` | .NET 反混淆（自动识别 ConfuserEx/Dotfuscator/Obfuscar/SmartAssembly/EazFuscator） |
| `dnSpy / ILSpy` | .NET 反编译、IL 编辑、运行时附加、方法断点 |
| `WinDbg (KD)` | 内核调试、驱动分析、内核回调、内存取证 |
| `z3 / angr` | CTF 约束求解与 SMT keygen |

## 工具优先链

| 目标 | 优先链 |
|---|---|
| 原生 PE/EXE/DLL（静态） | `IDA -> JEB` |
| 原生 PE/EXE/DLL（脚本拦截） | `Frida-on-Windows -> IDA 验证` |
| 原生 PE/EXE/DLL（跟踪/解壳） | `x64dbg -> IDA（dump 后）` |
| 原生 PE/EXE/DLL（深度） | `IDA -> Frida（运行时） -> x64dbg（确认）` |
| 加壳 PE（x64dbg 路线） | `x64dbg（OEP dump） -> IDA -> Frida（解壳后）` |
| 加壳 PE（Frida 优先） | `Frida spawn+模块加载拦截 -> IDA 静态` |
| VMP 保护 PE | `IDA（VM dispatcher） -> Frida（handler 跟踪） -> IDA（重注释） -> x64dbg（确认）` |
| Themida/Enigma 保护 PE | `x64dbg（OEP dump） -> Frida（解壳后） -> IDA` |
| EDR 保护目标 | `ETW/ETI 绕过 -> ntdll unhook -> Frida gadget -> IDA` |
| .NET 混淆 | `de4dot -> dnSpy -> IDA 或 Frida CLR` |
| .NET EazFuscator/SmartAssembly | `de4dot 尝试 -> dnSpy 手动 IL -> Frida CLR hook` |
| Loader / Manual Map / Hollowing | `IDA（注入链） -> x64dbg / WinDbg（线程与内存） -> Frida（远端 API 观测） -> IDA（回填）` |
| Config / Blob 恢复 | `IDA（载体与解码链） -> Frida / x64dbg（首个明文点） -> 本地脚本（字段验证）` |
| Windows 自绘 UI | `IDA（WndProc） -> x64dbg（消息断点） -> Frida（Pattern 14）` |
| 驱动/SYS | `IDA（DriverEntry/dispatch） -> WinDbg KD -> Frida（用户态伴随）` |
| CTF（约束重） | `IDA 初筛 -> z3/angr -> Frida 验证` |
| CTF（一般） | `strings + IDA 初筛 -> 精准 Frida/x64dbg -> 解题脚本` |
| Frida 脚本 | `Node.js API 优先 -> Python 备用` |
| Electron 应用（JS/IPC 层） | `asar extract → package.json → JS 美化/搜索 → DevTools/--inspect（调试） → bytenode（if .jsc）` |
| Electron 应用（V8 字节码） | `--inspect + Node Inspector → Frida hook OpenSSL（捕获密钥） → IDA（仅 .node 模块）` |
| Electron 应用（Native addon） | `IDA（.node 模块） → Frida（运行时 hook）` |

## 高级工具技巧

### IDA Microcode 分析工作流
```
适用: OLLVM CFF/BCF去混淆、函数内联、深层语义分析

核心API:
  gen_microcode(mba, ..., maturity_level)  # 生成微码
  mop_visitor_t                           # 遍历操作数
  optblock_t                              # 块级优化
  valrng_t / vivl_t                       # 值域分析

反CFF流程:
  1. gen_microcode(MMAT_CALLS)生成微码
  2. 找PHI节点(状态变量) → valrng_t获取值域范围
  3. VR_AT_START确定每个块的入口状态值
  4. 映射状态值→基本块 → 按原始顺序重连
  5. Hexrays_Hooks自动应用优化

函数内联:
  MMAT_GENERATED级别 → m_goto转m_call → 移除m_ret → HexraysDecompilationHook自动化
```

### WinDbg TTD (Time Travel Debugging)
```
适用: .NET JIT壳/一次性执行/竞态条件/无法重复的崩溃

流程:
  1. 录制TTD跟踪(.run文件)
  2. 回放分析:
     TTD.Calls("module!function")   # 追踪调用历史
     TTD.Memory(addr, range, "w")   # 追踪内存写入历史
     TTD.Index                      # 当前时间点(可前后跳转)
  3. 双向调试: 向前/向后单步，定位问题根因

.NET JIT壳实战:
  TTD.Calls("clr!compileMethod") → 提取JIT编译的方法体
  + SOS扩展(!dumpmd/!dumpil) → 方法识别
  + JavaScript自动化批量提取
```

### x64dbg 条件断点速查
```
语法: 条件, "日志格式", "命令"

实用模式:
  # API断点+条件
  bp CreateFileW, "szFile=unicode(@rcx)"
  # 内存访问断点+计数
  bpm addr, "hitcount > 10"
  # 日志断点
  bp addr, "", "log {p:x}@rax={p:x}@rax"
  # 运行到系统模块(IAT修复用)
  RunToParty 1
```

### IDA 批量分析
```
IDAT命令行: idat.exe -A -S"script.py" input.exe

批量脚本:
  1. 遍历所有函数(idautils.Functions)
  2. 导出函数名/地址/符号/交叉引用
  3. JSON格式输出
  4. 批处理多文件
```

### Ghidra 注意事项
```
RulePropagateCopy Bug: 对混淆代码会产生错误优化
修复: 自定义RuleVmpStoreVarnode + VmpStackEvaluator
地址协调: Ghidra→x64dbg用Copy Special→:$RVA; x64dbg→Ghidra用+RVA
```
