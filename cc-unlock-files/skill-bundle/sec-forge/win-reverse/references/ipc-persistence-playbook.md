# IPC / Persistence Playbook

适用：Windows 服务、计划任务、WMI 事件订阅、Named Pipe、RPC/ALPC、COM LocalServer 等 IPC 通道与持久化机制分析。

## 命中信号

- 导入 `CreateService`/`StartService`/`RegisterServiceCtrlHandler`
- 导入 `CreateNamedPipe`/`ConnectNamedPipe`/`CallNamedPipe`
- 导入 `RpcServerUseProtseqEp`/`RpcServerRegisterIf`/`RpcStringBindingCompose`
- 导入 `CoRegisterClassObject`/`CoCreateInstance` (COM LocalServer)
- 字符串中出现 `schtasks`/`/create`/`/ru`/`/sc`
- 注册表路径 `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run`、`HKLM\SYSTEM\CurrentControlSet\Services`
- ALPC 端口: `NtAlpcCreatePort`/`NtConnectPort`

## 最小目标

1. 列出控制面载体（服务/任务/WMI/COM/Pipe/RPC/ALPC）
2. 建立 `launcher -> registrar -> writer -> reader -> use` 链路
3. 明确权限、会话、触发条件
4. 落盘 `run/ipc-persistence-notes.md`、`run/ipc-surface.md`、`run/persistence-map.md`

## 阶段工作流

```
命中 IPC/持久化信号
 ├─ 阶段1: 载体识别
 │   ├─ 服务: CreateService → 二进制路径、启动类型、账户
 │   ├─ 计划任务: schtasks / ITaskService COM 接口 → 触发器、操作
 │   ├─ WMI: IWbemLocator → 事件过滤器和消费者绑定
 │   ├─ COM: CoRegisterClassObject / InprocServer32 / LocalServer32
 │   ├─ Named Pipe: CreateNamedPipe → 管道名、方向、安全描述符
 │   ├─ RPC: RpcServerUseProtseqEp → 协议序列、端点、接口 UUID
 │   └─ ALPC: NtAlpcCreatePort → 端口名、消息属性
 ├─ 阶段2: 消息流追踪
 │   ├─ 服务控制: HandlerEx 回调 → 控制码处理
 │   ├─ Pipe/RPC/ALPC: 序列化协议格式 → 消息类型分发
 │   └─ COM: IDispatch/vtable 方法调用链
 └─ 阶段3: 权限与会话模型
     ├─ 服务账户: LocalSystem/NetworkService/LocalService
     ├─ 会话隔离: Session 0 隔离（Vista+）
     └─ 完整性级别: System/High/Medium/Low
```

## IDA 分析技巧

### Windows Service 分析

```
入口识别:
  1. 搜索 ServiceMain 导出或注册回调
  2. StartServiceCtrlDispatcherW → SERVICE_TABLE_ENTRY → ServiceMain 函数指针
  3. ServiceMain 中调用 RegisterServiceCtrlHandlerEx → HandlerEx 回调

HandlerEx 控制码:
  SERVICE_CONTROL_STOP(1)       → 停止逻辑
  SERVICE_CONTROL_PAUSE(2)      → 暂停
  SERVICE_CONTROL_CONTINUE(3)   → 继续
  SERVICE_CONTROL_INTERROGATE(4)→ 状态查询
  SERVICE_CONTROL_DEVICEEVENT(11) → 设备事件（驱动相关）
  SERVICE_CONTROL_SESSIONCHANGE(0x80) → 会话变更

持久化特征:
  CreateService 参数:
    dwStartType: SERVICE_AUTO_START(2) / SERVICE_DEMAND_START(3)
    lpBinaryPathName: 实际执行路径
    lpDependencies: 依赖的其他服务
```

### Named Pipe 协议逆向

```
服务端:
  CreateNamedPipeW(pipeName, dwOpenMode, dwPipeMode, nMaxInstances, ...)
  ConnectNamedPipe(hPipe, ...) → 等待客户端连接
  ReadFile/WriteFile 或 TransactNamedPipe → 双向通信

客户端:
  CreateFileW(pipeName, ...) → 连接管道
  WriteFile/ReadFile → 收发消息

IDA 中定位协议结构:
  1. 找 ReadFile/WriteFile 调用 → buffer 参数
  2. 追踪 buffer 的处理逻辑 → 消息头解析
  3. 常见模式:
     - 长度前缀: [4B length][payload]
     - 类型分发: [4B type][4B length][payload] → switch(type)
     - 固定头: [magic][version][cmd][length][payload]

Frida 捕获:
  # Hook CreateNamedPipeW 获取管道名
  # Hook ReadFile/WriteFile 获取消息内容
  # 或 Hook TransactNamedPipe 一次获取请求和响应
```

### RPC 接口分析

```
IDA 定位:
  1. 搜索 RpcServerRegisterIf / RpcServerRegisterIfEx → 注册的接口
  2. RPC_SERVER_INTERFACE 结构体 → MIDL_SERVER_INFO → 分发表
  3. 分发表是函数指针数组，按 opnum 索引

协议分析:
  1. 接口 UUID → 可能在注册表 HKEY_CLASSES_ROOT\Interface 中找到注册信息
  2. 如果有 IDL 文件或类型库，直接获取接口定义
  3. 否则需要逆向每个分发表函数的参数

端点识别:
  RpcServerUseProtseqEp("ncacn_np", ..., "\\pipe\\xxx", ...)  → Named Pipe
  RpcServerUseProtseqEp("ncacn_ip_tcp", ..., "1234", ...)     → TCP 端口
  RpcStringBindingCompose → 组合绑定字符串
```

### COM LocalServer 分析

```
注册表路径:
  HKCR\CLSID\{GUID}\LocalServer32 → EXE 路径
  HKCR\CLSID\{GUID}\InprocServer32 → DLL 路径

IDA 分析:
  1. CoRegisterClassObject → 注册的 CLSID 和类厂
  2. IClassFactory::CreateInstance → 对象创建逻辑
  3. 对象 vtable → 接口方法实现

进程外 COM:
  - COM SCM 负责 activiation → 启动 LocalServer EXE
  - 通过 LRPC (Local RPC) 通信
  - 接口 marshaling: OLE 自动化 marshaling 或自定义 proxy/stub
```

### 计划任务分析

```
注册方式:
  1. schtasks.exe /create 命令行
  2. ITaskService COM 接口 (taskschd.dll)
  3. 直接写 XML 到 C:\Windows\System32\Tasks\

XML 任务定义:
  <Task>
    <Triggers> → 触发条件（登录/定时/事件/WMI）
    <Actions> → 执行操作（EXE/COM/邮件/消息）
    <Principal> → 运行账户和权限
    <Settings> → 运行配置
  </Task>

分析要点:
  - 持久化: Logon 触发器 → 用户登录时执行
  - 提权: RunLevel=Highest → 以高权限运行
  - 隐藏: Hidden=true → 在任务计划程序中隐藏
```

## Frida 模式交叉引用

```
场景                           frida.md 模式
──────────────────────────────────────────
Named Pipe 消息捕获            Pattern 7 (CreateNamedPipeW/ReadFile/WriteFile)
RPC 分发表 hook                Pattern 2 (RVA) 或 Pattern 16 (COM vtable)
COM 方法 hook                  Pattern 16
动态 API 解析                  Pattern 8 (GetProcAddress)
```

## Observe

- 先看服务、计划任务、WMI、COM 注册、命名对象、互斥体和事件
- 区分"启动器""存储点""通信载体""真正执行业务的一侧"
- 检查安全描述符: Pipe/RPC/ALPC 的 DACL 决定谁可以连接

## Capture

- NamedPipe/RPC/ALPC 先抓服务端创建点，再抓客户端使用点
- 服务和计划任务要同时记录注册路径、启动条件、命令行和宿主进程
- WMI / COM 先判提供者/类厂/LocalServer，不要只盯注册表
- RPC 分发表是函数指针数组，按 opnum 索引 — 逐个逆向获取参数签名

## Rebuild / Patch

- 先复现最小控制面消息流，再决定 patch 还是旁路
- 若控制面跨多进程，先记录每个进程的角色，再做局部验证
- 服务: patch ServiceMain 或 HandlerEx 中的控制逻辑
- Pipe/RPC: 伪造消息测试服务端行为

## 常见失误

- 把单个注册表项直接等同于完整持久化链（忽略触发器、依赖和启动条件）
- 只看 IPC 载体名称，不看读写双方和真实消息结构
- 忽略 Session 0 隔离导致复现失败（服务在 Session 0，桌面在 Session 1+）
- 忽略完整性级别差异（低权限进程无法连接高权限 Pipe）
- RPC 分发表分析时遗漏 opnum 到函数的映射
