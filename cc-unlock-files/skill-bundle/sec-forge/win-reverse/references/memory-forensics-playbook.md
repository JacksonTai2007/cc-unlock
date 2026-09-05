# Memory / Forensics Playbook

适用：进程内存取证、模块完整性检查、manual map 检测、进程 hollowing 检测、dump 与重建。

## 命中信号

- 导入 `VirtualAlloc`/`VirtualAllocEx` + `WriteProcessMemory`/`NtWriteVirtualMemory`（注入特征）
- `NtUnmapViewOfSection`（hollowing 特征）
- `SetThreadContext`/`NtSetContextThread`（线程劫持）
- 磁盘 PE 与内存映像不一致（.text 段 hash 不匹配）
- 存在无 backing file 的可执行内存区域（anonymous RWX）
- 进程中存在未在 PEB 模块列表中注册的可执行映像（manual map）
- `MiniDumpWriteDump` 调用（内存转储生成）

## 最小目标

1. 建立 `VAD / module / region` 最小地图
2. 决定 dump 粒度与时机
3. 明确重建目标：OEP、IAT、远端映像、配置明文或桥接对象
4. 落盘 `run/memory-layout.md`、`run/dump-plan.md`

## 阶段工作流

```
命中内存取证信号
 ├─ 阶段1: 进程内存地图
 │   ├─ 模块列表: PEB->Ldr->InMemoryOrderModuleList
 │   ├─ VAD 扫描: VirtualQuery 遍历所有内存区域
 │   ├─ 检查: 无 backing file 的可执行区 / 异常权限组合 / 隐藏模块
 │   └─ 线程起点: 每线程 StartAddress 是否落在已知模块内
 ├─ 阶段2: 异常检测
 │   ├─ PE-sieve: 检测 inline hook / hollowing / manual map
 │   ├─ .text hash 对比: 磁盘 vs 内存（检测代码修改/解壳后状态）
 │   └─ IAT 完整性: 内存 IAT 与磁盘导入表对比
 └─ 阶段3: Dump 与重建
     ├─ 选择粒度: 整进程 / 单模块 / 单区段 / 单 buffer
     ├─ 时机: 解壳后 / 解密后 / 关键操作前
     └─ 后处理: IAT 重建 / 重定位修复 / PE 头修复
```

## IDA + 工具分析技巧

### 进程内存地图构建

```
WinDbg:
  !address → 所有内存区域摘要
  !address -f:PAGE_EXECUTE → 所有可执行区域
  !peb → PEB 信息和模块列表
  !lm → 已加载模块列表
  !lmex → 详细模块信息（含时间戳、路径）

x64dbg:
  Memory Map 窗口 (Alt+M) → 所有内存区域
  Symbols 窗口 → 已加载模块及其符号

Frida:
  Process.enumerateModules() → 所有已加载模块
  Process.enumerateRanges('r-x') → 所有可读可执行区域
  Process.enumerateThreads() → 所有线程（含 StartAddress）
```

### Manual Map 检测

```
Manual map 特征:
  1. 可执行内存区域无 backing file（MEM_PRIVATE 或 MEM_MAPPED 但无文件名）
  2. 区域起始处有 PE 头（MZ/PE 签名）
  3. 该 PE 不在 PEB 模块列表中
  4. 线程 StartAddress 指向该区域

检测方法:
  1. 遍历 PEB 模块列表获取所有已知模块基址
  2. 遍历所有可执行内存区域
  3. 对于不在已知模块范围内的区域，检查是否有 PE 头
  4. Frida: Process.enumerateModules() vs Process.enumerateRanges('r-x') 差集

PE-sieve:
  pe-sieve64.exe /pid <pid> /mode 3
  /mode 3: 扫描并替换 hooks（最激进）
  输出: 检测到的 hook / hollowing / 修改的模块列表
```

### Process Hollowing 检测

```
Hollowing 流程:
  CreateProcess(suspended) → NtUnmapViewOfSection → VirtualAllocEx → WriteProcessMemory → SetThreadContext → ResumeThread

检测特征:
  1. 进程映像路径（PEB->ProcessParameters->ImagePathName）与实际内存 PE 不一致
  2. .text 段内存 hash ≠ 磁盘 hash
  3. 入口点指向非原始位置
  4. 进程以 SUSPENDED 状态启动（父进程可观察）

IDA 分析:
  如果分析的是 loader 本身:
  1. 搜索 CreateProcessW 调用，检查 CREATE_SUSPENDED 标志 (0x4)
  2. 追踪 NtUnmapViewOfSection 调用
  3. 追踪 WriteProcessMemory 写入的内容（通常是完整 PE）
  4. 追踪 SetThreadContext 修改的 EIP/RIP 值
```

### Dump 与后处理

```
x64dbg dump 流程:
  1. 在 OEP 处设断（解壳后落定）
  2. 断下后: Scylla 插件 → Dump → 选择进程和模块
  3. IAT 重建: Scylla → IAT Autosearch → Get Imports → Fix Dump
  4. 验证: 用 IDA 打开 dump 文件，检查导入表和交叉引用

Frida dump:
  # dump 单模块到文件
  var mod = Process.getModuleByName("target.exe");
  var dump = mod.base.readByteArray(mod.size);
  var f = new File("dump.bin", "wb");
  f.write(dump);
  f.close();

  # dump 指定内存区域
  var addr = ptr("0x12340000");
  var buf = addr.readByteArray(0x10000);
  var f = new File("region.bin", "wb");
  f.write(buf);
  f.close();

MiniDump:
  # procdump 方式
  procdump.exe -ma <pid> output.dmp
  # WinDbg
  .dump /ma output.dmp
  # .dmp 可在 WinDbg 中用 .exepath 加载符号后分析
```

### Inline Hook 检测

```
常见 hook 类型:
  1. JMP rel32 (E9 xx xx xx xx) — 5 字节 inline hook
  2. JMP [abs] (FF 25 xx xx xx xx) — 6 字节 absolute jump
  3. PUSH addr + RET (68 xx xx xx xx C3) — 6 字节

检测方法:
  1. 对比函数前几个字节的磁盘 vs 内存
  2. 如果被 hook，前 N 字节被替换为跳转指令
  3. 常见 hook 框架: Microsoft Detours (5+ bytes 覆盖), MinHook (5+ bytes), IAT hook

Frida 检测:
  # 检查某个函数是否被 hook
  var fnAddr = Module.getExportByName("kernelbase.dll", "CreateFileW");
  var bytes = fnAddr.readByteArray(16);
  var arr = new Uint8Array(bytes);
  if (arr[0] === 0xE9 || (arr[0] === 0xFF && arr[1] === 0x25)) {
    console.log("[!] Function appears to be hooked");
  }

  # Interceptor.attach 自身也会 inline hook，注意区分
```

## Frida 模式交叉引用

```
场景                           frida.md 模式
──────────────────────────────────────────
模块枚举 + 内存扫描            Pattern 4 (字节特征扫描)
VirtualAlloc 监控（解壳检测）   Pattern 10
线程/注入监控                  Pattern 18 (NtCreateThreadEx)
inline patch                  Pattern 5
GetProcAddress 动态解析        Pattern 8
```

## Observe

- 先看模块、内存权限、映像类型、可疑匿名区、线程起点和远端映像
- 区分"要拿哪份 dump"与"为什么现在拿"
- 检查线程 StartAddress 是否全部落在已知模块内（不在 = 被注入代码）

## Capture

- dump 前先记录模块边界、入口、保护属性、线程与句柄线索
- 若目标是 manual map 或 hollowing，优先定位真正执行的映像而不是磁盘原件
- 记录 dump 后还需要补的步骤：IAT、重定位、头修复、字符串/配置验证
- 解壳场景: 在 OEP 断下后 dump（此时 .text 已解密，IAT 已解析）

## Rebuild / Patch

- 先验证 dump 是否可重载、可静态分析、可支持下一阶段
- 不要一次抓整进程就结束；若目标是单模块或单区段，优先做最小 dump
- IAT 重建是 dump 后最关键的一步 — 未重建的 dump 在 IDA 中无法正确显示导入函数
- PE 头修复: 确保 e_lfanew、SectionHeaders 的 VirtualAddress/SizeOfRawData 正确

## 常见失误

- 把任意一份内存转储都当成最终样本（可能是半解密状态或 IAT 未修复）
- 不记录 VAD / 模块地图，导致 dump 无法解释来源
- 未验证 dump 可读性就继续深度语义分析
- dump 后忘记重建 IAT 导致 IDA 中所有导入函数显示为地址
- 忽略 ASLR：dump 的基址与磁盘 PE 的 ImageBase 不同，需要重定位
