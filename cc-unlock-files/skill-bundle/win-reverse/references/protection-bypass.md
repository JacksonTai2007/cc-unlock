## 保护机制检测与绕过

**边界声明**：检测/枚举保护机制属于 `anti-analysis` 专题。本专题负责**绕过方案的实施**，假设检测面已被识别。两者协作顺序：anti-analysis 识别 → protection-bypass 绕过。

### 保护层级决策树

```
检测到保护行为
  ├─ 用户态检测
  │   ├─ API 级（IsDebuggerPresent / CheckRemoteDebuggerPresent）
  │   │   └→ PEB/TEB 直接读取绕过 → 见 §1
  │   ├─ 结构体级（BeingDebugged / NtGlobalFlag / ProcessHeap.Flags）
  │   │   └→ 结构体字段 patch → 见 §1
  │   ├─ 硬件断点检测（DR0-DR3 轮询 / SetThreadContext 清空）
  │   │   └→ VEH 抢先恢复 / 隐藏 DR → 见 §2
  │   ├─ 时序检测（RDTSC / QueryPerformanceCounter / GetTickCount）
  │   │   └→ Hook 时序 API / patch RDTSC → 见 §1
  │   └─ 异常门（INT 3 / INT 2D / ACCESS_VIOLATION + VEH 接管）
  │       └→ VEH handler 逆向 + 条件 patch → 见 §3
  ├─ 内存/文件完整性
  │   ├─ .text 段滚动哈希校验
  │   │   └→ Hook 校验函数返回固定值 / patch 校验线程 → 见 §4
  │   ├─ 磁盘文件重读取（CreateFileMapping + 头部哈希）
  │   │   └→ Hook 返回干净副本 → 见 §4
  │   └─ 反 dump（ErasePEHeader / stolen bytes / size-of-image 伪造）
  │       └→ 运行时恢复 / dump 时机选择 → 见 §4
  ├─ API 层防护
  │   ├─ IAT 动态哈希解析（ROR13 / CRC32b / DJB2）
  │   │   └→ 在已解析的地址上 hook / 跟踪调用链 → 见 §5
  │   └─ Direct Syscall（硬编码 syscall 号 / HellsGate / TartarusGate）
  │       └→ Frida Stalker 指令级追踪 → 见 §5
  ├─ 代码虚拟化
  │   └→ 务实绕过：定位校验分支跳转，不强求完整 VM 还原 → 见 §6
  └─ 内核级保护
      ├─ ObRegisterCallbacks（句柄权限裁剪）
      │   └→ 进程内注入绕过 → 见 §7
      └─ PatchGuard / HVCI
          └→ 检测存在 → 降级为用户态方案 → 见 §7
```

### §1 用户态反调试绕过

**识别特征**（枚举由 anti-analysis 负责，此处仅列绕过目标）：
- `FS:[0x30]`（x86）或 `GS:[0x60]`（x64）直接读取 PEB
- `PEB.BeingDebugged`（偏移 0x02，x86/x64 相同）
- `PEB.NtGlobalFlag`（偏移 **0x68 x86** / **0xBC x64**），值 `0x70` 表示调试器堆标记（FLG_HEAP_ENABLE_TAIL_CHECK | FLG_HEAP_ENABLE_FREE_CHECK | FLG_HEAP_VALIDATE_PARAMETERS）
- `PEB.ProcessHeap` → `Heap.Flags`（偏移 **0x40 x86** / **0x70 x64**），正常值 `HEAP_GROWABLE(0x2)`；`Heap.ForceFlags`（偏移 **0x44 x86** / **0x74 x64**），正常值 `0x0`
- `CheckRemoteDebuggerPresent`（内部调用 `NtQueryInformationProcess`）
- `NtQueryInformationProcess` info-classes：ProcessDebugPort(0x7)、ProcessDebugObjectHandle(0x1E)、ProcessDebugFlags(0x1F)
- `KUSER_SHARED_DATA`（0x7FFE0000）偏移 0x02D4 处的调试相关标志
- 时序检测：`RDTSC/RDTSCP`、`QueryPerformanceCounter`、`GetTickCount`

**绕过方法**（按优先级）：

方法 1（Frida hook NtQueryInformationProcess）：
```javascript
"use strict";
var ntQIP = Module.getExportByName('ntdll.dll', 'NtQueryInformationProcess');
Interceptor.attach(ntQIP, {
    onEnter: function(args) {
        this.infoClass = args[1].toInt32();
        this.infoBuf = args[2];
    },
    onLeave: function(retval) {
        if (retval.toInt32() !== 0) return;
        switch (this.infoClass) {
            case 7:   // ProcessDebugPort
                this.infoBuf.writeU32(0);
                break;
            case 0x1E: // ProcessDebugObjectHandle
                this.infoBuf.writeU32(0);
                retval.replace(0xC0000353); // STATUS_PORT_NOT_SET
                break;
            case 0x1F: // ProcessDebugFlags
                this.infoBuf.writeU32(1); // 反转：1 = 无调试器
                break;
        }
    }
});
```

方法 2（Frida 直接 patch PEB 字段）：
```javascript
"use strict";
// 通过 TEB 获取 PEB 地址
var peb = Process.arch === 'x64'
    ? this.context.readPointer(Process.getCurrentThreadId())  // TEB → PEB at GS:[0x60]
    : null;
// 推荐：直接在进程启动时 patch
// 使用 Process.enumerateRanges 找到 PEB 所在页，写入 BeingDebugged=0, NtGlobalFlag=0
```

方法 3（x64dbg 脚本 patch）：
```
// 直接修改 PEB 内存字段
pb PebBase+2=0           // BeingDebugged = 0
pb PebBase+68=0          // NtGlobalFlag = 0 (x86: 偏移 0x68)
pb PebBase+BC=0          // NtGlobalFlag = 0 (x64: 偏移 0xBC)
```

方法 4（时序检测绕过）：
```javascript
"use strict";
// Hook RDTSC（通过 Stalker 或驱动）
// 或 Hook QueryPerformanceCounter 返回递增值
var qpc = Module.getExportByName('kernel32.dll', 'QueryPerformanceCounter');
var counter = 0;
Interceptor.attach(qpc, {
    onLeave: function(retval) {
        counter += 1000; // 每次调用稳定递增
        retval.replace(ptr(counter));
    }
});
```

### §2 硬件断点对抗（DR 清空/轮询）绕过

**识别特征**：
- 调用 `GetThreadContext` 读取 `DR0-DR3`
- 定时调用 `SetThreadContext` 将 `DR0-DR3` 覆写为 0
- 在关键函数入口/出口处检查 DebugStatus 寄存器

**CONTEXT 结构中 DR 偏移**（AMD64，来自 winnt.h）：
- `Dr0`: 0x048, `Dr1`: 0x050, `Dr2`: 0x058, `Dr3`: 0x060
- `Dr6`: 0x068, `Dr7`: 0x070

**绕过方法**：

方法 1（Hook GetThreadContext 返回全零 DR）：
```javascript
"use strict";
var GTC = Module.getExportByName('kernel32.dll', 'GetThreadContext');
Interceptor.attach(GTC, {
    onEnter: function(args) {
        this.ctx = args[1]; // lpContext (x64: RDX)
    },
    onLeave: function(retval) {
        // 清零 DR0-DR3 (x64 CONTEXT 偏移: 0x048-0x060)
        if (Process.arch === 'x64') {
            this.ctx.add(0x048).writeU64(0); // Dr0
            this.ctx.add(0x050).writeU64(0); // Dr1
            this.ctx.add(0x058).writeU64(0); // Dr2
            this.ctx.add(0x060).writeU64(0); // Dr3
        }
    }
});
```

方法 2（VEH 抢先恢复 DR）：
```cpp
// 注册最高优先级 VEH，在每次异常分发前恢复硬件断点
LONG CALLBACK VehRestore(PEXCEPTION_POINTERS ep) {
    ep->ContextRecord->Dr0 = saved_dr0;
    ep->ContextRecord->Dr1 = saved_dr1;
    // ...
    return EXCEPTION_CONTINUE_EXECUTION;
}
AddVectoredExceptionHandler(1, VehRestore); // 1 = 最高优先级
```

方法 3（Patch 清空调用点）：
```
定位 SetThreadContext(DR0-DR3=0) 的调用点 → NOP 掉调用或 patch 参数
若为定时器线程 → 挂起线程或 patch 线程函数直接 RET
```

### §3 SEH/VEH 异常门检测与绕过

**边界**：异常链结构分析（TLS callback → SEH chain → VEH 注册顺序）由 `exception-runtime` 负责。本节关注 VEH 被**作为反调试手段**使用时的绕过策略。

**识别特征**：
- 代码中大量 `INT 3`（0xCC）、`INT 2D`、`UD2` 指令
- 故意的空指针访问或非法内存操作
- VEH handler 中修改 `EIP/RIP` 寄存器实现跳转

**绕过方法**：

方法 1（逆向 VEH handler 还原控制流）：
```
1. 在 AddVectoredExceptionHandler 下断点 → 获取 VEH 回调地址
2. 逆向 VEH handler：
   - 提取异常码过滤条件（ExceptionCode）
   - 提取 EIP/RIP 修改逻辑（跳转目标计算）
   - 记录每个异常触发点的预期目标地址
3. 直接 patch INT 3/INT 2D 为跳转到预期目标
```

方法 2（Frida 拦截 VEH 注册）：
```javascript
"use strict";
Interceptor.attach(Module.getExportByName('kernel32.dll', 'AddVectoredExceptionHandler'), {
    onEnter: function(args) {
        var handler = args[1];
        console.log('[VEH] handler registered at:', handler);
    }
});
```

方法 3（调试器配置自动传递异常）：
```
x64dbg: Options → Preferences → 忽略以下异常 → 勾选 BREAKPOINT / ACCESS_VIOLATION
让异常自动传回程序的 VEH handler，不中断调试器
注意：某些程序会检测调试器是否拦截了异常（通过二次确认机制）
```

**交叉引用**：-> `references/exception-runtime-playbook.md`（异常链启动分析）

### §4 内存/文件完整性校验与反 dump 绕过

**识别特征**：
- 工作线程定期扫描 `.text` 段计算哈希
- `CreateFileMapping` + `MapViewOfFile` 读取磁盘文件并比对
- `ReadProcessMemory`（self-PID）读取自身内存
- 运行时修改 PE 头（ErasePEHeader）、伪造 SizeOfImage、stolen bytes（入口代码被搬到堆上）

**绕过方法**：

方法 1（Hook 校验函数返回固定值）：
```javascript
"use strict";
// 假设校验函数地址已定位（通过 anti-analysis 阶段）
Interceptor.attach(checksumFuncAddr, {
    onLeave: function(retval) {
        retval.replace(expectedValue);
    }
});
```

方法 2（Hook 文件读取返回干净副本）：
```javascript
"use strict";
var originalBytes = null; // 预先保存未修改的文件内容
var targetFile = "app.asar";

Interceptor.attach(Module.getExportByName('kernel32.dll', 'CreateFileW'), {
    onEnter: function(args) {
        this.path = args[0].readUtf16String();
    },
    onLeave: function(retval) {
        if (this.path && this.path.includes(targetFile)) {
            this.handle = retval;
        }
    }
});
// 配合 ReadFile hook，在读取时替换缓冲区内容为原始字节
```

方法 3（Patch 校验线程）：
```
1. 定位校验线程的 ThreadProc（通过 CreateThread xref）
2. 在 ThreadProc 入口 patch 为 RET
3. 风险：校验线程可能同时负责其他功能，需评估副作用
```

方法 4（反 dump 绕过）：
```
ErasePEHeader：在进程启动后立即 dump（PE 头尚完整时）
  → 或 hook ErasePEHeader 函数，阻止清零
Stolen bytes：入口代码被搬到堆上
  → 定位堆上的代码副本，dump 时从堆地址重建入口
SizeOfImage 伪造：
  → 从 VAD 获取真实的内存区域大小，不依赖 PE 头字段
```

### §5 动态 API 解析与 Direct Syscall 追踪

**识别特征**：
- IAT 中缺少关键 API 导入
- 代码中存在哈希比较逻辑（ROR13 / CRC32b / DJB2）
- `mov eax, <number>; mov r10, rcx; syscall` 模式（Direct Syscall）
- HellsGate / HalosGate / TartarusGate 等动态 syscall 号提取技术

**绕过方法**：

方法 1（追踪动态解析结果并 hook）：
```javascript
"use strict";
Interceptor.attach(Module.getExportByName('kernel32.dll', 'GetProcAddress'), {
    onLeave: function(retval) {
        console.log('[IAT Resolve]', retval);
        // 在解析到的地址上设置 hook
    }
});
// 若使用哈希解析：在哈希比较循环后下断点 → 获取真实地址 → hook
```

方法 2（Frida Stalker 追踪 Direct Syscall）：
```javascript
"use strict";
Stalker.follow(tid, {
    transform: function(iterator) {
        var insn;
        while ((insn = iterator.next()) !== null) {
            if (insn.mnemonic === 'syscall') {
                iterator.putCallout(function(context) {
                    var syscallNr = context.rax.toInt32();
                    console.log('[Direct Syscall] nr=' + syscallNr);
                });
            }
        }
    }
});
```

方法 3（运行时提取 syscall 号）：
```
不硬编码 syscall 号（不同 Windows 版本会变化）。
提取方法：读取 ntdll 中对应 Nt* 函数的前几字节：
  mov eax, IMM32   → IMM32 即为当前系统的 syscall 号
  mov r10, rcx
  syscall
对于 HellsGate 等动态提取技术，hook 提取函数的结果即可。
```

### §6 代码虚拟化务实绕过

**边界**：完整的 VM 逆向成本极高，本节提供**务实绕过路径**而非完整还原方法。VM handler 提取等深度分析参见 `references/anti-obf.md`（VMP 章节）和 `references/packers.md`。

**识别特征**：
- 大量无法识别的字节码（非标准 x86/x64 指令）
- 巨大的 `switch-case` 分发循环（VM dispatcher）
- VMProtect / Themida / Enigma 标识

**务实绕过策略**：

1. **不还原 VM，只绕过校验**：定位 VM exit 后的"比较结果 → 分支跳转"处，patch 条件跳转
2. **动态观察**：让 VM 正常执行到校验点，在 VM exit 后的第一个真实代码指令处下断点，观察校验结果
3. **对比执行路径**：用 Frida Stalker 分别追踪正常输入和异常输入的执行路径，找到分叉点（即校验判断）
4. **参数 patch**：若校验函数的输入是可预测的（如文件哈希），直接修改输入而非修改 VM 代码

**交叉引用**：-> `references/anti-obf.md`（VMP 章节）、`references/packers.md`（壳识别）

### §7 内核级保护检测与用户态降级方案

**边界**：驱动分析由 `driver` 专题负责。本节仅提供"检测到内核保护后如何降级"的用户态策略。

**识别特征**：
- 目标进程有配套 `.sys` 驱动加载
- `OpenProcess` 返回的句柄缺少 `PROCESS_VM_READ/WRITE` 权限
- 调试器附加后无法读写内存或下断点

**降级策略**（用户态优先，不强求内核对抗）：

```
当检测到内核级保护时，按以下优先级尝试：
1. 用户态进程内 hook（Frida gadget / DLL 注入）
   → 注入技术参见 references/loader-injection.md
2. 利用目标进程自身的 IPC/RPC 接口间接操作
3. DuplicateHandle 绕过句柄裁剪：
   → 保护驱动裁剪新打开的句柄，但不裁剪进程自身持有的句柄
4. 若以上均不可行，记录检测到的保护机制，向用户报告限制
```

**驱动回调摘除**（需要管理员 + 测试签名模式，仅在有授权时）：
```
1. 编写对抗驱动调用 ObUnRegisterCallbacks 移除回调
2. 前提：bcdedit /set testsigning on
3. 风险：PatchGuard 可能导致 BSOD
```

**交叉引用**：-> `references/driver.md`（驱动分析）、`references/loader-injection.md`（注入技术）

---

### 快速路径

```
检测到保护信号（已由 anti-analysis 识别）
→ 遍历决策树，按 §1-§7 分类每个检测点
→ 优先 patch 检测函数的返回值（最小副作用）
→ 其次 patch 检测函数的调用者（跳过检测分支）
→ 最后考虑全局绕过（进程内 hook / 内存 shadow）
→ 记录到 run/protection-bypass-notes.md
→ 交付 run/protection-bypass-hook.js + run/protection-bypass-patch.py
```

### 与其他专题的协作点

| 协作专题 | 典型场景 | 交互方式 |
|----------|----------|----------|
| `anti-analysis` | 保护机制使用混淆代码隐藏检测逻辑 | anti-analysis 识别检测面 → protection-bypass 实施绕过 |
| `exception-runtime` | VEH 作为反调试异常门 | exception-runtime 分析异常链结构 → 本专题提供 VEH 反调试绕过 |
| `loader-injection` | 进程注入绕过内核级保护 | loader-injection 提供注入技术 → 本专题提供注入需求判定 |
| `memory-forensics` | 反 dump 绕过后的内存 dump | memory-forensics 提供 dump 策略 → 本专题提供 dump 时机判定 |
| `packer-unpack` | 壳内嵌反调试/反篡改 | 先脱壳 → 再处理壳内保护机制 |
