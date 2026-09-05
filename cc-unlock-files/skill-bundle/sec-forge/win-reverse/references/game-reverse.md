# Game Reverse Engineering Playbook (Windows)

适用：Unreal Engine 4/5、Unity(Mono/IL2CPP)、Cocos2d-x(Lua/JS) Windows游戏逆向、反作弊绕过、游戏数据修改、渲染层Hook。

> **交叉引用**
> - 反调试/混淆绕过 → `references/anti-obf.md` + `references/frida.md`
> - 注入方法（DLL注入/Manual Map/Reflective） → `references/loader-injection.md`
> - 内核反作弊绕过（驱动隐藏/物理内存读写） → `references/driver.md`

---

## 引擎识别

```
Unreal Engine 4/5:
  .pak文件 / Engine/Binaries/Win64/ 或 GameName/Binaries/Win64/
  UE4典型目录: t_project/Binaries/Win64/GameName-Win64-Shipping.exe
  UE5典型目录: GameName/Binaries/Win64/GameName.exe
  关键模块: UnrealEngine-Win64-Shipping.dll (或打包进EXE)

Unity Mono:
  GameName_Data/Managed/Assembly-CSharp.dll
  mono-2.0-bdwarden.dll / UnityPlayer.dll
  Managed目录下可见大量.dll

Unity IL2CPP:
  GameAssembly.dll + GameName_Data/il2cpp_data/Metadata/global-metadata.dat
  UnityPlayer.dll 仍存在但核心逻辑在 GameAssembly.dll

Cocos2d-x:
  主EXE内嵌或 libcocos2d.dll
  .jsc / .lua / .luaacb 脚本文件
  resources/ 目录下脚本资源

自研引擎:
  无上述特征 / 需从字符串、RTTI、PDB路径、导入表推断
```

---

## Unreal Engine 逆向

### UE4 vs UE5 核心结构差异

```
=== GNames (名称系统) ===

UE4 GNames (TArray-based FNameEntry array):
  结构: TArray<FNameEntry*> → FNameEntry[] → 字符串
  定位: 搜索 "Default__" / "ObjectProperty" 字符串 → 回溯交叉引用
  解析: FName → Index → FNameEntry* → NameString

UE5 GNames (FNamePool, hash-based):
  结构: FNamePool → TEntryPool (Blocks + Chunks) → FNameEntry
  完全不同于UE4的TArray, 基于哈希桶 + 块分配
  定位: 搜索 "FNamePool" 或 "NamePoolData" 字符串
  解析: FName → FNameEntryId → (Block = Id >> 16, Offset = Id & 0xFFFF)

=== GObjects (对象系统) ===

UE4:
  FUObjectArray → FChunkedFixedUObjectArray → FUObjectItem[] → UObjectBase
  偏移因版本而异, 典型: Objects + 0x10 * Index

UE5:
  同样FUObjectArray但内部结构可能有改动
  UE5.0+: UObjectBase布局变化 (FObjectPropertyBase → FProperty)
  需要针对具体UE版本确认偏移

=== UWorld / GWorld ===

UE4/5通用定位方法:
  搜索 "World" 字符串 → 引擎函数(UWorld::Tick等)交叉引用
  UEngine::GetEngineWorld → GWorld指针
  UWorld → PersistentLevel → AActor[] → 遍历实体
```

### 核心对象定位 (IDA静态分析)

```
GNames:
  IDA搜索 "FloatProperty" / "IntProperty" / "ObjectProperty" 字符串
  → 交叉引用 FName::GetName → 回溯定位 GNames / NamePoolData
  UE4: 偏移固定模式 FNameEntry*[Index]
  UE5: FNamePool 解析 Block[Id>>16] + Offset(Id & 0xFFFF)

GObjects:
  搜索 UObjectBase 虚表引用或 "Invalid object" 字符串
  → FChunkedFixedUObjectArray 结构
  → FUObjectItem[] → UObjectBase*

UWorld:
  搜索 "World.SpawnActor" / "DrawTransition" 字符串
  → 交叉引用到 UEngine 内部
  → 获取 GWorld / UWorld 指针
```

### SDK Dump 方法

```
方法1 - Frida + TypeScript (推荐, 动态):
  attach到游戏进程 → 定位GNames/GObjects/GWorld
  → 遍历UObject → 解析UClass/UFunction/UProperty
  → 输出C++头文件 + 偏移表
  Windows: frida -p <pid> -l sdk_dumper.js (注入模式, 非frida-server)

方法2 - UnrealDumper / Dumper-7 (Windows版):
  自动检测UE版本(4.x/5.x) → 生成完整SDK
  输出: UFunction/UProperty/UClass 完整定义
  支持: Win64-Shipping / Development builds

方法3 - IDA静态偏移修复:
  字符串搜索定位关键类
  → FProperty大小推断偏移
  → UFunction::Func → ProcessEvent → Invoke定位
  适用于: 无法动态调试的场景(强反作弊)
```

### UE5 DX12 Hook

```
1. 定位 D3D12Core.dll → ExecuteCommandLists (vtable[10]) 获取命令队列
2. CDXGISwapChain::Present Hook
3. 硬件断点Hook方式 (避免内存修改检测):
   - SetThreadContext修改DR0-DR3设置硬件断点 on Present vtable entry
   - 或 VEH + Drx寄存器方式
4. ImGui DX12初始化:
   - 创建RTV for backbuffer → ImGui_ImplWin32_Init → ImGui_ImplDX12_Init
   - Render阶段在Present前插入draw call
```

### DX11 Hook (UE4最常见渲染路径)

```
方法1 - IDXGISwapChain::Present vtable hook (最通用):
  1. CreateDeviceAndSwapChain获取合法SwapChain指针
  2. 读取SwapChain vtable → Present (index 8)
  3. 替换vtable指针或inline hook Present
  4. 在Hook中执行ImGui渲染

方法2 - D3D11 CreateDeviceAndSwapChain hook:
  1. Hook CreateDeviceAndSwapChain 拦截设备创建
  2. 保存 device/context/swapchain 指针
  3. 后续Hook Present执行渲染

DX9 EndScene hook (旧游戏/老版本UE3):
  1. IDirect3DDevice9::EndScene (vtable index 42)
  2. Hook EndScene → 在Present前渲染ImGui
  3. 注意Reset需要同步处理ImGui资源
```

### .pak 文件修改

```
=== AES.pak Key 提取 ===
1. IDA加载游戏EXE或UnrealEngine DLL
2. 搜索 AES-256 S-Box特征 (0x63, 0x7C, 0x77, 0x7B...)
   或搜索FAES::DecryptData / FAES::EncryptData函数
3. 交叉引用定位密钥 (通常32字节 hex string)
4. 提取密钥用于解密.pak

=== UnrealPak 使用 ===
# 解包
UnrealPak.exe Game.pak -Extract -AESKey=0x<32字节hex>
# 查看
UnrealPak.exe Game.pak -List
# 重打包(修改后)
UnrealPak.exe Create NewPak.pak -Create=PayloadDir/

=== 常见修改目标 ===
- GameName/Content/Paks/pakchunk0-WindowsNoEditor.pak (主资源)
- UE4: 可能使用自定义加密, 需从内存提取运行时密钥
- UE5: Zen Loader新架构, pak可能被ucas/utoc替代
```

---

## Unity 逆向

### Mono 后端

```
关键DLL: mono-2.0-bdwarden.dll (或嵌入UnityPlayer.dll)
关键函数:
  mono_assembly_fopen / mono_class_from_name / mono_runtime_invoke
  mono_domain_get / mono_thread_attach
逆向:
  Hook mono_runtime_invoke → 拦截任意C#方法调用
  Hook mono_class_from_name → 跟踪类加载
工具:
  dnSpy / ILSpy 直接打开 Managed/ 目录DLL
  reflexil插件直接修改IL → 重新保存DLL
注意:
  Windows上Mono DLL是标准PE, 可直接IDA分析
  有些游戏混淆Assembly-CSharp.dll → 需De4Dot去混淆
```

### IL2CPP 后端

```
关键文件:
  GameAssembly.dll (编译后的C++代码, 标准PE/x64)
  GameName_Data/il2cpp_data/Metadata/global-metadata.dat (类型元数据)
步骤:
  1. Il2CppDumper (global-metadata.dat + GameAssembly.dll)
     → 生成DummyDll/ + script.json + 头文件
  2. IDA加载 GameAssembly.dll + 应用头文件符号
     → 按Il2CppDumper输出的偏移(RVA)定位函数
  3. 绕过加固:
     - 内存dump GameAssembly.dll (脱壳/去混淆)
     - Frida hook il2cpp_runtime_invoke 拦截方法调用
Windows特有:
  GameAssembly.dll是标准PE64, 导入表/RTTI完整可分析
  无需SoFixer等工具 (DLL fixup由Windows Loader自动完成)
```

### IL2CPP global-metadata.dat 加密恢复

当 Il2CppDumper 报错（如 `Failed to read global-metadata.dat header`、magic 不匹配）时，说明 metadata 被加密或混淆。

```
恢复工作流:
  1. 确认加密:
     - 磁盘上 global-metadata.dat 前4字节不是 0xF0 0xB1 0x1A 0xF1 (IL2CPP magic)
     - 文件大小正常但内容不可解析 → 确认加密

  2. 定位解密函数:
     IDA加载 GameAssembly.dll:
     - 搜索字符串 "global-metadata.dat" / "MetadataLoader" / "il2cpp::vm::MetadataCache"
     - 交叉引用定位加载函数 → 找到读文件后的解密调用
     - 典型模式: fopen/fread → 解密循环(XOR/AES/RC4) → 写入内存

  3. 动态提取:
     方法A - Frida断点:
       hook il2cpp_init 或 MetadataLoader::Load
       在解密完成、明文写入内存后设置断点
       读取并dump完整明文 metadata:
         var base = Module.findBaseAddress("GameAssembly.dll");
         // 解密后的metadata指针通常在全局变量中
         // 从IDA定位该全局变量RVA，读取指针后dump
     方法B - 内存搜索:
       运行游戏后搜索内存中的 IL2CPP magic (0xF0 0xB1 0x1A 0xF1)
       从匹配地址向前找到 metadata 头起始位置
       dump 整个 metadata 区段 (大小从 header 的 fileSize/symbolCount 推算)

  4. 验证与使用:
     - 检查 dump 文件前4字节是否为正确 magic
     - 用替换后的 global-metadata.dat 重新运行 Il2CppDumper
     - 验证输出的 DummyDll 数量和函数符号是否合理
```

---

## 反作弊系统 (Windows)

### 常见反作弊组件识别

```
EasyAntiCheat (EAC):
  内核驱动: EasyAntiCheat.sys
  用户层: eac_launcher.exe / EasyAntiCheat.dll
  特征: 进程名检测、句柄权限过滤、代码完整性校验
  绕过思路: 未签名驱动映射 → 见 references/driver.md

BattlEye (BE):
  内核驱动: BEDaisy.sys
  用户层: BEClient.dll
  服务进程: BEService.exe
  特征: ObRegisterCallbacks + 回调检测 + 内存扫描
  绕过思路: 驱动隐藏 + 物理内存读写 → 见 references/driver.md

Riot Vanguard (Valorant):
  Ring-1 Hypervisor: vgc.sys
  用户层: vgtray.exe / vguiproxy.exe
  特征: Hypervisor级监控, 检测内核完整性
  绕过思路: 极高难度, 需要HV级别对抗 → 见 references/driver.md

TenProtect (TP, 腾讯):
  内核驱动: tpsys.sys
  用户层: TP3Helper.dll / TPHelper.dll
  特征: HOOK SSDT/Shadow SSDT + 进程/线程保护
  绕过思路: EPT Hook / 回调恢复 → 见 references/driver.md

nProtect GameGuard:
  内核驱动: npggNT.sys
  用户层: gameguard.des / npggNT.dll
  特征: 反调试 + 反注入 + 进程内存保护
  绕过思路: DBGM抑制 + DLL卸载 → 见 references/anti-obf.md

XignCode3 (Wellbia):
  内核驱动: xigncode.sys
  用户层: x3.xem / x3.xmd
  特征: 代码段完整性 + 导入表监控 + 硬件断点检测
  绕过思路: EPT方式Hook / 回避检测 → 见 references/anti-obf.md
```

### 反作弊绕过通用方法

```
R3层 (用户态):
  BeingDebugged / NtGlobalFlag / PEB检测 → hook检测函数返回正常值
  → 详见 references/anti-obf.md

R0层 (内核态):
  KdDebuggerEnabled清零 / kdcom.dll MDL修改 → 恢复调试能力
  → 详见 references/driver.md

句柄保护:
  ObRegisterCallbacks剥离进程句柄权限
  → 物理内存读写 / DuplicateHandle提权 / EPT映射
  → 详见 references/driver.md

反Frida检测:
  Windows上Frida使用注入模式 (frida-agent.dll)
  检测: 枚举模块列表 → 发现frida-agent特征
  绕过: 擦除PE头 / 重命名DLL / Manual Map注入
  → 详见 references/frida.md

反注入检测:
  检测: EnumProcessModules / VirtualQuery扫描RWX区域
  绕过: Manual Map / Reflective注入擦除足迹
  → 详见 references/loader-injection.md

内核反作弊驱动对抗:
  清除PoolBigPageTable条目隐藏驱动
  Manual Map驱动 / DKOM摘链
  → 详见 references/driver.md
```

---

## Cheat Engine (Windows) 高级方法论

### 基础搜索

```
1. 精确值搜索: 金币=1000 → 4 Bytes / 8 Bytes
2. 变化值搜索: 血量变化 → Changed / Unchanged / Increased / Decreased
3. 未知初始值: Unknown initial value → 逐步缩小范围
4. 浮点搜索: 坐标/速度等 → Float / Double类型
```

### 指针扫描 / 指针图 (多级指针链)

```
目的: 找到从模块基址到目标地址的多级偏移链
  (如: Game.exe+0x12345 → [RAX+0x10] → [RCX+0x20] → 目标地址)

步骤:
  1. 找到目标地址 (如血量地址)
  2. 右键 → Pointer scan for this address
  3. 设置最大偏移(如0x1000)和最大级别(如6级)
  4. 等待扫描完成 → 得到候选指针路径
  5. 文件 → Pointer map → 保存.psc文件
  6. 重启游戏 → 用新地址对比验证路径
  7. 反复收敛直到得到稳定路径: [Module+Offset]+Off1]+Off2]+...

指针图对比:
  两次不同运行时dump指针图 → 对比消除不稳定路径
  只保留在两次dump中都出现的路径 → 高可靠度
```

### DBVM (内核级调试)

```
DBVM = DBVM (Driver-Based Virtual Machine) Cheat Engine自带微型Hypervisor
  提供Ring-0级调试能力, 可绕过部分反调试

启用条件:
  CPU支持VMX/AMD-V (现代CPU基本都支持)
  CE菜单 → DBVM → Load DBVM (需要重启或蓝屏风险, 谨慎使用)

DBVM功能:
  - 内核级读写内存 (绕过ObRegisterCallbacks)
  - 硬件断点不受DR寄存器限制 (EPT-based)
  - 隐藏调试器存在
  - 直接物理内存访问
```

### Structure Spider (结构体分析)

```
目的: 自动推断内存中的数据结构布局

使用:
  1. 找到对象基址
  2. Memory Viewer → Tools → Structure Spider
  3. 设置扫描范围和深度
  4. 自动识别: 指针字段、数值字段、字符串字段
  5. 输出推断的结构体布局

应用:
  分析游戏实体结构 (坐标、血量、装备等字段的偏移)
  配合指针扫描快速理解数据结构关系
```

### Group Scan (组合搜索)

```
目的: 同时搜索多个关联值 (如 X坐标+Y坐标+Z坐标 连续存储)

语法:
  组内用空格分隔多个条件:
  例: "4:100 4:200 4:300" → 搜索连续三个int分别为100/200/300
  例: "f:12.5 f:64.3 f:0.0" → 搜索三个连续float

高级用法:
  支持通配符: "4:* f:100.0 4:*" → 中间是float 100.0, 前后是任意int
  适用于: 定定连续的Vec3 / Transform / PlayerState结构
```

### CE Auto Assembler 代码注入

```
1. "Find what accesses this address" → 发现访问指令和偏移链
   [base+offset1+offset2+...] → 理解多级指针结构

2. CE Auto Assembler 注入:
   - 选择目标指令 → Toggle script
   - 替换指令逻辑 (subsd → addsd, 或cmp+jge跳转修改)
   - alloc分配代码洞穴 → jmp跳转 → 执行自定义逻辑后跳回

3. AOBScan方式定位:
   - 获取指令特征字节序列
   - AOBScanModule("sig", "Game.exe", "xx xx ?? xx")
   - 版本更新后自动重定位
```

---

## Frida 游戏逆向 (Windows注入模式)

```
Windows上Frida工作方式:
  无需frida-server (那是Android/Linux概念)
  使用注入模式: frida -p <pid> -l script.js
  或Spawn模式: frida -f Game.exe -l script.js

常用游戏Hook模板:
  // Hook UE4 ProcessEvent
  var pProcessEvent = Module.findExportByName("Game.exe", "?ProcessEvent@UObject@@");
  // 或通过偏移定位
  var base = Module.findBaseAddress("Game.exe");
  var pProcessEvent = base.add(0xOFFSET);

  // Hook Unity IL2CPP方法
  var il2cpp = Module.findBaseAddress("GameAssembly.dll");
  var targetFunc = il2cpp.add(RVA_FROM_IL2CPPDUMPER);

  // ImGui渲染Hook (DX11)
  var d3d11 = Module.findBaseAddress("d3d11.dll");
  // 定位SwapChain vtable → Hook Present

反检测:
  Frida注入会留下frida-agent.dll模块
  → 重命名 / Manual Map方式注入
  → 详见 references/frida.md
```

---

## Cocos2d-x 游戏逆向

```
Windows上的Cocos2d-x:
  主EXE内嵌引擎 或 libcocos2d.dll
  Lua脚本: .lua / .luaacb / .luaacb64 (加密后的Lua字节码)
  JS脚本: .jsc (加密后的JS字节码)

Lua脚本恢复:
  1. 定位 luaL_loadbuffer / luaL_loadfilex → Hook获取解密后脚本
  2. 或内存搜索Lua签名 "\x1bLua" (未加密字节码头)
  3. lua_State遍历 → 导出全局表中的函数和变量

JS脚本恢复:
  1. 定位 cocos2d::ScriptEngine::evalString / compileScript
  2. Hook获取解密后的JS源码
  3. SpiderMonkey引擎 → 遍历JSCompartment获取JSObject
```

---

## 交付最少包含

```
run/game-reverse-notes.md       # 引擎类型、版本、关键偏移
run/sdk-dump-output/             # SDK dump输出 (如适用)
run/offset-map.md                # 关键偏移表 (GNames/GObjects/UWorld/常用函数)
run/hook-template.js             # Frida Hook脚本模板
run/pointer-map.psc              # CE指针图文件 (如适用)
run/aes-key.txt                  # .pak AES密钥 (如适用)
```
