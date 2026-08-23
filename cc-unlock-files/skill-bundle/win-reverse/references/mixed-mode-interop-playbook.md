# Mixed-Mode / Interop Playbook

适用：C++/CLI（IJW）、P/Invoke、COM Interop、CLR Hosting 等混合模式二进制分析。

## 命中信号

- PE 中导入 `mscoree.dll`（`_CorExeMain` / `_CorDllMain`）
- COM 目录存在（`clrhost.dll` / `coreclr.dll` 依赖）
- DUMPBIN 输出显示 "IL + Native" 混合代码
- 导入 `CLRCreateInstance`、`CorBindToRuntimeEx`、`ICLRRuntimeHost`
- dnSpy/ILSpy 中出现 `MethodImplOptions.InternalCall` 或 `DllImport` 标记
- IDA 中出现 `msvcrt!_gettxthack` 或 CLR thunk 指令模式

## 最小目标

1. 判清托管/非托管边界与加载顺序
2. 建立至少一条跨边界调用链
3. 明确真正承载业务语义的一侧
4. 落盘 `run/mixed-mode-notes.md`、`run/bridge-map.md`

## 阶段工作流

```
识别为混合模式
 ├─ 阶段1: 判定混合类型
 │   ├─ C++/CLI (IJW): PE 头同时有 CLR 目录和 native 代码段
 │   ├─ Native Host + CLR: native EXE 通过 CLR Hosting API 加载托管代码
 │   ├─ Managed + P/Invoke: .NET 程序调用 native DLL
 │   └─ COM Interop: 通过 COM vtable 跨边界调用
 ├─ 阶段2: 定位边界桥接点
 │   ├─ P/Invoke: DllImport 声明 → native 导出函数
 │   ├─ IJW thunk: C++/CLI 编译器生成的 VTFixup thunk
 │   ├─ COM: CoCreateInstance → vtable 调用链
 │   └─ CLR Hosting: CLRCreateInstance → ICLRRuntimeHost::ExecuteInDefaultAppDomain
 └─ 阶段3: 选择主分析工具链
     ├─ 核心逻辑在托管侧 → dnSpy/ILSpy 为主
     ├─ 核心逻辑在 native 侧 → IDA 为主
     └─ 跨边界频繁 → Frida hook 桥接点（frida.md Pattern 15 COM vtable hook）
```

## IDA 分析技巧

### C++/CLI (IJW) 识别

```
1. PE 头: IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR (目录索引14) 非空
2. 节区: 同时存在 .text (native) 和 .IL (托管) / 或 .text 同时含 native 和 IL
3. VTFixup 表: .vtfixup 节，记录托管/非托管 thunk 映射
4. IDA 常见模式:
   - 调用 __CxxCallCXXStdSurrogate（IUnknown thunk）
   - 调用 _CorDllMain / _CorExeMain（CLR 入口）
   - 存在 managed/unmanaged token 转换（VTFixupEntry）
5. 关键: IDA 对 IL 代码无反编译能力，需要 dnSpy 辅助
```

### P/Invoke 定位

```
dnSpy/ILSpy 侧:
  1. 搜索 DllImportAttribute 标记的方法
  2. 记录: 目标 DLL 名、导出函数名、调用约定、参数签名
  3. 常见: kernel32.dll!CreateFileW, advapi32.dll!RegSetValueExW

IDA 侧 (被调用 native 函数):
  1. 在目标 DLL 中定位导出函数
  2. 检查调用约定是否与 DllImport 声明匹配
     - stdcall vs cdecl 不匹配会导致栈不平衡
  3. 检查字符串参数编码: 查看 DllImport CharSet 属性（Ansi=LPStr / Unicode=LPWStr / Auto=取决于平台）
```

### COM Interop 分析

```
托管侧创建:
  new SomeComClass() → CoCreateInstance(CLSID, ...) → 返回 native COM 对象

native 侧:
  1. 定位 CoCreateInstance 调用 → 获取 CLSID
  2. 在注册表中查找 CLSID → InprocServer32 → 真实 DLL 路径
  3. 在 DLL 中找 DllGetClassObject → CClassFactory::CreateInstance → 实际对象
  4. 对象 vtable → 接口方法（真正承载逻辑的地方）

Frida 捕获:
  # frida.md Pattern 16: COM vtable hook
  # 在 CoCreateInstance 返回后读取 vtable，逐个 hook 接口方法
```

### CLR Hosting (Native Host 场景)

```
常见于: 游戏脚本引擎、插件系统、定制运行时

初始化链:
  CLRCreateInstance(CLSID_CLRMetaHost, ..., &pMetaHost)
  → pMetaHost->GetRuntime(L"v4.0.30319", ..., &pRuntimeInfo)
  → pRuntimeInfo->GetInterface(CLSID_CLRRuntimeHost, ..., &pHost)
  → pHost->Start()
  → pHost->ExecuteInDefaultAppDomain(assemblyName, typeName, methodName, args, &ret)

IDA 定位:
  1. 搜索 CLRCreateInstance / CorBindToRuntimeEx 导入
  2. 追踪 ICLRRuntimeHost 接口指针
  3. ExecuteInDefaultAppDomain 参数即为托管入口

分析策略:
  1. 提取 assemblyName 和 methodName → 用 dnSpy 分析托管程序集
  2. 如果托管程序集是内嵌资源 → 先提取再分析
```

## Frida 模式交叉引用

```
场景                           frida.md 模式
──────────────────────────────────────────
COM vtable hook                Pattern 16
GetProcAddress 动态解析        Pattern 8
WinAPI Hook（CoCreateInstance） Pattern 7
CLR 方法 hook                  Pattern 17
```

## Observe

- 看 PE 头、CLR 目录（COM_DESCRIPTOR 目录索引14）、导出、入口和 `mscoree` 相关导入
- 判断是 `native host -> CLR`、`managed -> native` 还是 `IJW thunk`
- 记录 `x86/x64/WOW64`、CLR 版本（v2.0/v4.0/coreclr）和是否伴随 COM
- 混合模式下注意架构一致性: 32位 native host 只能加载 32位 CLR

## Capture

- 优先抓 `P/Invoke`（DllImport 目标）、`IJW thunk`（VTFixup 表项）、`CoCreateInstance`（CLSID）、`CLRCreateInstance`（CLR 版本）
- 给每条桥接记录：调用方、被调方、参数/对象、线程上下文、返回值或错误码
- 如果只看得到一侧，立刻补另一侧工具链，不要把单侧视角当成闭环
- Frida hook CoCreateInstance 返回值可捕获 COM 对象 vtable 地址

## Rebuild / Patch

- 先做最小桥接复现，再做局部 patch
- patch 只改首个分叉原因，不要跨托管/非托管两侧同时大改
- 托管侧 patch: 用 dnSpy Edit IL 或 Frida CLR hook
- native 侧 patch: 用 IDA + Frida Pattern 5 inline patch

## 常见失误

- 只看到 IL 就忽略 native thunk（IJW 场景下两者交织）
- 只看到 native 导出就忽略 CLR host 初始化（native host 场景）
- 把 COM 对象构造误判成普通 API 调用（CoCreateInstance 只是工厂）
- 忽略 P/Invoke 调用约定不匹配导致的栈不平衡
- 在 32/64 位边界上用错工具（32位进程只能加载 32位 CLR/native DLL）
