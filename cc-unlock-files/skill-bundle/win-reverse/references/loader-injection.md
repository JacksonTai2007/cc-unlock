# Loader / Injection Playbook

适用：`CreateRemoteThread`、`NtCreateThreadEx`、`QueueUserAPC`、线程劫持、Reflective DLL、Manual Map、Process Hollowing、RunPE、早期启动注入。

## Observe
- 先确认宿主进程、位宽、会话、权限、是否 WOW64、是否有 PPL / CFG / CIG / ACG 限制。
- 先区分“真实注入链”与“壳 / 自解密 / 自装载”——两者会复用同一批 API，但验收点不同。
- 把远端句柄、内存保护、映像来源、触发线程分开记录。

## Capture
- 静态优先看：`CreateRemoteThread/NtCreateThreadEx/QueueUserAPC/VirtualAllocEx/WriteProcessMemory/MapViewOfFile/NtMapViewOfSection/SetThreadContext/ResumeThread`。
- 动态优先抓：句柄创建、远端映像写入、入口转移、加载后修补、异常恢复。
- 遇到 Manual Map 时，把 PE header 修补、reloc、IAT、TLS callback、SEH/VEH 初始化拆开。

## Rebuild
- 先画出最小链：宿主选择 -> 远端内存 -> 载荷写入 -> 入口触发 -> 载后修正。
- 若是 Hollowing / RunPE，单独记录原始映像、替换映像、入口切换点和线程上下文改写。
- 若是 Reflective / Manual Map，补一份 `remote-map.md`，记录远端区段与权限变化。

## Patch / Port
- patch 只服务于稳定观察或 dump：例如跳过一次性权限检查、延后自删、保留调试输出。
- 如果用户要本地复现，优先重建 loader 主链，而不是把所有反分析与环境噪音一起搬过去。

## 交付最少包含
- `run/loader-injection-notes.md`
- `run/remote-map.md`
- `run/loader-hook-template.js`
- 报告中明确宿主、装载技术、远端模块 / 区段、入口切换证据。

### 注入方法决策树
```
需要注入代码到目标进程
  ├─ 有足够权限
  │   ├─ 只需加载已知DLL → CreateRemoteThread+LoadLibrary
  │   ├─ 需要隐蔽 → Manual Map(手动PE映射)
  │   ├─ 目标进程允许APC → QueueUserAPC
  │   ├─ 需要早期注入 → Early Bird APC / Thread Hijacking
  │   └─ 已有进程句柄 → NtCreateThreadEx
  ├─ 权限受限
  │   ├─ 可写文件到目标目录 → DLL侧加载/劫持
  │   ├─ 目标使用COM → COM劫持
  │   └─ 可修改注册表 → Image File Execution Options
  └─ 无文件落地
      ├─ PowerShell内存执行 → 反射式DLL注入
      ├─ Shellcode注入 → VirtualAllocEx+WriteProcessMemory
      └─ 进程替换 → Process Hollowing/Doppelgänging
```

### 11种代码注入识别特征
```
1.  DLL注入:          CreateRemoteThread+LoadLibrary
2.  PE注入:           WriteProcessMemory(写入完整PE)
3.  反射式DLL注入:     自定位DLL(无LoadLibrary依赖)
4.  APC注入:           QueueUserAPC/NtQueueApcThread
5.  Process Hollowing: 挂起→NtUnmapViewOfSection→写入→ResumeThread
6.  Process Doppelgänging: NTFS事务+文件替换
7.  Process Herpaderping: 文件打开→写入→修改磁盘文件→执行内存映像
8.  IAT Hook:         修改导入表函数指针
9.  Inline Hook:      替换函数入口指令(E9/JMP)
10. Early Bird APC:   CREATE_SUSPENDED进程→QueueUserAPC→ResumeThread
11. DLL侧加载:        白文件+同名恶意DLL(白+黑)
```

### Inline Hook 实现
```
x86 (5字节): E9 [相对偏移4字节]
x64 (14字节): 48 B8 [绝对地址8字节] FF E0

实现步骤:
  1. 保存原始指令(至少Hook长度的字节数)
  2. VirtualProtect修改内存权限
  3. 写入跳转指令
  4. 恢复内存权限

Trampoline(调用原函数):
  执行保存的原始指令 → 跳回原函数被覆盖指令的下一条
```

### API Set 劫持(无DLL注入)
```
原理: 修改PEB→ApiSetMap指针重定向API解析
步骤:
  1. CREATE_SUSPENDED创建挂起进程
  2. 读取PEB.ApiSetMap
  3. 构造伪造的ApiSetMap(API_SET_NAMESPACE_ARRAY)
  4. 将目标api-ms-win-xxx重定向到自定义DLL
  5. ResumeThread恢复执行
```

### 多阶段样本的嵌入载荷提取

真实恶意软件经常使用 dropper → downloader → loader → payload 链。分析 stage-1 样本后需要提取嵌入的 stage-2 才能继续分析。

```
提取方法:

1. 资源段提取:
   工具: Resource Hacker / IDA资源视图 / RCE工具
   流程: 枚举 RT_RCDATA / RT_BITMAP 等资源类型
   → 检查资源大小是否合理(PE header特征 / 异常大 / 加密标志)
   → 导出资源 → 检查前2字节是否为 MZ
   → 如加密: 在IDA中定位资源加载API( FindResourceW → LoadResource → LockResource )
   → 跟踪后续解密调用

2. Overlay / 附加数据提取:
   原理: 很多dropper在PE末尾追加payload
   定位: PE OptionalHeader.SizeOfImage 与实际文件大小的差值
   → 计算overlay起始 = 节区表中最后一个节的 RawOffset + SizeOfRawData
   → 或使用 diec / PE-bear 的 Overlay 信息
   → dump overlay 部分 → 检查是否为完整PE / shellcode / 加密blob
   → 关键API: SetFilePointer(末尾) → ReadFile

3. 内存解密窗口提取:
   场景: payload 在运行时解密到内存中，磁盘上不存在明文
   流程: x64dbg 在 VirtualAlloc/VirtualProtect(RWX) 设断点
   → 断下后检查分配的内存区域
   → 在 WriteProcessMemory / memcpy 后设断点，等待写入完成
   → dump 解密后的内存区域
   → 修复: 补齐 PE header(如果被抹除) → 重建导入表(Scylla)
   验证: dump 的 PE 能被 IDA/7z 正确识别

4. Shellcode 提取:
   场景: stage-1 中嵌入了 position-independent shellcode
   定位: 搜索无标准PE头的可执行内存区域
   → 特征: 大量 call/pop / fnstenv / 获取 PEB 的指令模式
   → 提取: 确定 shellcode 起始和长度 → raw dump
   → 分析: 置入 IDA 设为 raw binary → 手动创建函数分析
```
