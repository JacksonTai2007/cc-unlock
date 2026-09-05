# Exception / Runtime Playbook

适用：TLS callback 反调试、SEH/VEH 异常链、CRT 启动链、CFG/CET 保护、WOW64 边界等运行时异常机制分析。

## 命中信号

- IDA 中 TLS Directory 非空（Data Directory[9]）
- 导入 `SetUnhandledExceptionFilter`、`AddVectoredExceptionHandler`、`RtlInstallFunctionTableCallback`
- 反编译中频繁出现 `__try/__except`、`RaiseException`、`longjmp`
- 调试器频繁断在 ntdll 异常分发而不在用户代码
- CFG 检查失败（`__guard_dispatch_icall_fptr` 间接调用）
- 进程架构与系统不匹配（WOW64）

## 最小目标

1. 枚举 `TLS callback -> entrypoint -> CRT -> SEH/VEH` 完整启动链
2. 判断异常链属于反分析、解密门还是正常业务控制流
3. 找到安全断点与 hook 点
4. 落盘 `run/exception-runtime-notes.md`、`run/startup-chain.md`

## 阶段工作流

```
命中异常/运行时信号
 ├─ 阶段1: 启动链枚举
 │   ├─ PE TLS Directory → AddressOfCallBacks → 逐个 TLS callback RVA
 │   ├─ EntryPoint → CRT init → C++ global ctors
 │   ├─ SEH 链: .pdata (x64) / fs:0 chain (x86)
 │   └─ VEH: AddVectoredExceptionHandler 调用点
 ├─ 阶段2: 异常链定性
 │   ├─ 反调试: IsDebuggerPresent/NtGlobalFlag/HeapFlags 检查链
 │   ├─ 解密门: 异常触发的 self-decrypt（SEH handler 写入 .text）
 │   ├─ 反模拟: RDTSC/GetTickCount 时间差检测
 │   └─ 正常控制流: C++ EH / 结构化错误处理
 └─ 阶段3: 绕过 / Patch
     ├─ Frida 反调试绕过脚本（frida.md Pattern 9 + 反调试完整脚本）
     ├─ 静态 patch 分支（frida.md Pattern 5）
     └─ dump 窗口: 异常后、明文前
```

## IDA 分析技巧

### TLS Callback 定位

```
1. View → Open Subviews → TLS Directory（或 Shift+F7 → .tls 节）
2. AddressOfCallBacks 字段 → RVA 列表（以 0 结尾）
3. 每个回调签名: void CALLBACK TlsCallback(PVOID hModule, DWORD dwReason, PVOID reserved)
   - dwReason: DLL_PROCESS_ATTACH=1, DLL_THREAD_ATTACH=2, DLL_THREAD_DETACH=3, DLL_PROCESS_DETACH=0
4. 常见反调试模式:
   - 回调中调用 IsDebuggerPresent/NtQueryInformationProcess
   - 回调中 int 2d（触发异常，被自身 SEH 捕获后修改执行流）
   - 回调中解密 .text 段（解密门）
5. 关键: TLS callback 在 main/WinMain 之前执行，常规断点会错过
```

### SEH 链分析

```
x86:
  fs:[0] → EXCEPTION_REGISTRATION_RECORD 链
  每节点: { PVOID Next; PVOID Handler; }
  IDA: Alt+S 搜索 SEH setup 指令 (push fs:[0]; mov fs:[0], esp)

x64:
  .pdata 节 → RUNTIME_FUNCTION 数组
  每项: { ULONG BeginAddress; ULONG EndAddress; ULONG UnwindData; }
  IDA: View → Open Subviews → Exception Handlers
  UNWIND_INFO 包含异常处理函数地址

识别反调试 SEH:
  1. RaiseException 人为触发
  2. 对应 Handler 中检查调试器存在性（读取 PEB BeingDebugged）
  3. 或 Handler 中执行解密操作（self-decrypt 门）
  4. 特征: __try 块中故意访问无效内存 (mov eax, [0]; or xor eax, eax; mov [eax], 0)
```

### VEH（Vectored Exception Handler）

```
注册 API: AddVectoredExceptionHandler(First, Handler)
  - First=1 插入链头（优先于 SEH）
  - 常用于反调试: Handler 中检测硬件断点（Dr0-Dr3）
  - 或用于解密: Handler 中根据异常地址解密对应代码页

IDA 定位:
  1. 搜索 AddVectoredExceptionHandler 导入
  2. 回调参数为 PEXCEPTION_POINTERS
  3. 在回调中检查 ExceptionRecord->ExceptionCode 和 ExceptionAddress
  4. 注意: VEH 可动态注册，静态分析可能遗漏运行时注册的 Handler
```

### CRT 启动链

```
标准链: EntryPoint → __security_init_cookie → __CRT_INIT → _initterm → main/WinMain

关键节点:
  __security_init_cookie: 栈保护 cookie 初始化（GS）
  _initterm: 调用全局 C++ 构造函数（.CRT$XCU 段中的函数指针数组）
  atexit 注册: 全局析构函数注册

IDA 识别:
  - 入口函数中连续 call __security_init_cookie; call __CRT_INIT
  - __CRT_INIT 内部调用 HeapCreate/GetCommandLineA/GetEnvironmentStrings
  - 全局 ctor 可能在 main 前执行初始化/反调试检查
  - 搜索 .CRT$XCU 段（IDA Shift+F7 → 节区列表）
```

## x64dbg 实操

```
# TLS callback 断点（必须在加载时设置）
1. Options → Settings → Events → 勾选 "TLS callbacks"
   或: 在 TLS callback 地址手动设断 bp <TLS_CB_VA>
2. 启动调试，x64dbg 会在每个 TLS callback 处暂停

# SEH 断点
1. Debug → Set Exception Breakpoints（或 Shift+F8）
2. 勾选 "Break on Exception" 捕获所有异常
3. 查看 SEH 链: View → SEH Chain

# VEH 跟踪
1. 在 AddVectoredExceptionHandler 设断
2. 记录 Handler 地址
3. 在 Handler 地址设断，观察异常处理逻辑

# 反调试绕过
1. IsDebuggerPresent: 将返回值 patch 为 0
   bp kernelbase!IsDebuggerPresent; 断下后 r eax=0; 继续运行
2. NtGlobalFlag: PEB+0x68 (x86) / PEB+0xBC (x64) 写 0
3. Heap Flags: PEB->ProcessHeap+0x40 (x86) / +0x70 (x64) 写 0
   Heap ForceFlags: +0x44 (x86) / +0x74 (x64) 写 0
```

## Frida 模式交叉引用

```
场景                          frida.md 模式
─────────────────────────────────────────
TLS callback 拦截             Pattern 9
反调试绕过（完整脚本）         "PE 反调试完整绕过脚本"
RDTSC 时间检测                Pattern 12b
VMP dispatcher 跟踪           Pattern 13
分支强制 patch                Pattern 5
GetProcAddress 动态解析       Pattern 8
```

## Observe

- 先看 TLS 目录、异常处理注册、`SetUnhandledExceptionFilter`、`AddVectoredExceptionHandler`
- 判断断点为什么失效：架构不匹配、异常吞掉、TLS 先跑、CFG/CET 保护、WOW64 边界
- CFG 检查: IDA 中搜索 `__guard_dispatch_icall_fptr`，查看 Guard CF Function Table
- CET (Shadow Stack): 检查 DLL Characteristics 中 IMAGE_DLLCHARACTERISTICS_EX_CET_COMPAT

## Capture

- 用最小断点记录异常前后寄存器、模块、线程与返回目标
- 把异常当成"控制流边界"，不要只把它当噪音
- 记录哪些操作会破坏启动链，比如过早 patch、错误断点或错误附加时机
- Frida spawn 模式 + Pattern 9 是捕获 TLS callback 最可靠的方式

## Rebuild / Patch

- 先复现最小异常路径，再 patch 首个分叉原因
- 需要 dump 时，优先选择异常后、明文前的窗口
- 多层异常链: 先绘制完整链（IDA），再从最外层逐个 patch
- self-decrypt 门: 在 Handler 执行后 dump（此时 .text 已解密），而非 Handler 执行前

## 常见失误

- 只盯 `main/WinMain`，忽略 TLS callback
- 把异常吞掉逻辑误判成崩溃
- 在 WOW64 边界上用错调试器或错层 hook
- 忽略 VEH（它优先于 SEH，且可动态注册）
- 过早 patch 导致后续解密链断裂
- 忘记检查 CRT 全局构造函数中的反调试
