## 驱动 / SYS 分析

### 概览
```
范围：WDM / KMDF / minifilter / NDIS / legacy NT drivers
入口：DriverEntry(PDRIVER_OBJECT, PUNICODE_STRING)
隔离：必须使用带快照的 VM；内核崩溃=蓝屏；禁止在裸机加载未知 SYS
```

### IDA 分析 - DriverEntry 检查表
```
[ ] DriverEntry -> MajorFunction 表填充（IRP_MJ_CREATE/CLOSE/READ/WRITE/DEVICE_CONTROL）
[ ] IoCreateDevice / IoCreateDeviceSecure -> 设备对象 + 符号链接
[ ] IoCreateSymbolicLink -> 用户态可访问设备路径（如 \\DosDevices\\TargetDevice）
[ ] IOCTL 分发：IRP_MJ_DEVICE_CONTROL handler -> 根据 IoStackLocation->Parameters.DeviceIoControl.IoControlCode 分支
[ ] 解码 IOCTL：CTL_CODE(DeviceType, Function, Method, Access)
    Method: METHOD_BUFFERED=0, METHOD_IN_DIRECT=1, METHOD_OUT_DIRECT=2, METHOD_NEITHER=3
[ ] 内核回调：PsSetCreateProcessNotifyRoutine / PsSetLoadImageNotifyRoutine / ObRegisterCallbacks
[ ] DKOM 指标：PsGetCurrentProcess / PsLookupProcessByProcessId + 链表操作
[ ] Rootkit 指标：SSDT hooks / IDT hooks / IRP hooks / DKOM
[ ] 危险 IOCTL：METHOD_NEITHER 未校验导致任意读写 -> 本地提权
```

### WinDbg KD 命令参考
```
# Attach to kernel (local or remote)
windbg -k com:port=\\.\pipe\com_1,baud=115200,pipe  # QEMU serial pipe
windbg -k net:port=50000,key=a.b.c.d                # KDNET

# Driver basics
lm m target*           # verify driver loaded
!drvobj \Driver\Target 7   # show driver object + dispatch table
!devobj \Device\Target     # device object info
dt nt!_DRIVER_OBJECT <addr>

# IOCTL trace (x64: IRP.Tail.Overlay.CurrentStackLocation = IRP+0x70; IoControlCode = stack_loc+0x18)
# Verify offsets with: dt nt!_IRP; dt nt!_IO_STACK_LOCATION
bp target!DispatchDeviceControl "r rcx; .printf \"IoControlCode: %x\", poi(poi(@rcx+0x70)+0x18); g"
!irp @rcx              # dump IRP at entry

# Kernel callbacks
!for_each_module "!object \Driver\@#ModuleName"
# PsLoadedModuleList walk to find hidden drivers
dt nt!_LDR_DATA_TABLE_ENTRY <PsLoadedModuleList>

# Memory
!pool <addr>           # pool allocation info
!address <addr>        # memory region type
db/dw/dd/dq <addr> L<n>  # dump bytes/words/dwords/qwords

# Crash analysis
!analyze -v            # post-crash analysis
!thread                # current thread info
```

### IOCTL Fuzz 模板（Python / ctypes）
```python
import ctypes, struct, os

GENERIC_READ  = 0x80000000
GENERIC_WRITE = 0x40000000
OPEN_EXISTING = 3
FILE_SHARE_READ  = 0x00000001
FILE_SHARE_WRITE = 0x00000002

k32 = ctypes.windll.kernel32

def open_device(path):
    h = k32.CreateFileW(path, GENERIC_READ|GENERIC_WRITE,
                        FILE_SHARE_READ|FILE_SHARE_WRITE, None, OPEN_EXISTING, 0, None)
    if h == ctypes.c_void_p(-1).value:
        raise OSError("CreateFile failed: " + str(ctypes.GetLastError()))
    return h

def send_ioctl(handle, ioctl_code, in_buf=b'\x00'*64, out_len=256):
    out_buf = ctypes.create_string_buffer(out_len)
    bytes_ret = ctypes.c_ulong(0)
    ret = k32.DeviceIoControl(handle, ioctl_code,
                              ctypes.c_char_p(in_buf), len(in_buf),
                              out_buf, out_len, ctypes.byref(bytes_ret), None)
    return ret, bytes_ret.value, out_buf.raw[:bytes_ret.value]

# Example: fuzz IOCTL range for a target driver
h = open_device(r"\\.\TargetDevice")
for func_code in range(0x800, 0x900):
    ioctl = (0x0022 << 16) | (func_code << 2) | 0  # DeviceType=0x22, Method=BUFFERED
    ret, n, data = send_ioctl(h, ioctl)
    if ret or n > 0:
        print(f"[+] IOCTL 0x{ioctl:08X}: ret={ret} bytes={n} data={data.hex()}")
k32.CloseHandle(h)
```

### 内核Hook实现

**Inline Hook（推荐，Win7-11通用）：**
```
三步曲：
  1. MmGetSystemRoutineAddress获取目标函数地址
  2. 保存原指令 → 构造JMP到Hook函数（注意x64需要14字节: 48 B8 [addr] FF E0）
  3. Hook函数：保存寄存器 → 自定义逻辑 → 恢复寄存器 → 执行原始指令 → 跳回原函数

实战(Inline Hook NtReadVirtualMemory):
  在call MiReadWriteVirtualMemory处替换为跳转
  → 比SSDT Hook更隐蔽且稳定
```

**SSDT Hook（仅Win7，Win10+困难）：**
```
1. 定位KeServiceDescriptorTable
2. 解密服务号
3. 关闭CR0.WP写保护
4. 替换SSDT条目
注意：Win10 KiSystemServiceRepeat校验返回地址，易触发0xC0000005
```

### 进程保护技术

**保护方法：**
```
方法1 - ObRegisterCallbacks(官方API):
  注册OB_PREOP回调 → 句柄创建时去除VM_READ/WRITE/TERMINATE权限
  局限：只保护句柄创建时刻

方法2 - 循环句柄降权(持续保护):
  遍历ActiveProcessLinks → 解析HANDLE_TABLE(TableCode层级0/1/2)
  → 对命中被保护进程的句柄降权 → CE等工具持续失效

方法3 - PoolBigPageTable清除(反bigpool枚举):
  定位PoolBigPageTable → 计算索引(ExFreeHeapPool算法)
  → 清零/删除无文件驱动的大内存分配条目
```

### 进程保护绕过

```
反ObRegisterCallbacks:
  修改LDR_DATA_TABLE_ENTRY Flags为0x20绕过注册验证
  或直接CR3切换读写进程内存

反句柄降权:
  DuplicateHandle提权 / \\Device\\PhysicalMemory物理内存读写

反进程隐藏:
  PspCidTable枚举(不依赖ActiveProcessLinks)
  _CSR_PROCESS遍历(通过CSRSS的CsrRootProcess)
  MmPfnDatabase遍历(物理页→EPROCESS映射)

CR3加密绕过(EAC/BE风格):
  Win7-10: 遍历MmPfnDatabase → 位操作解码加密EPROCESS引用
  Win11 24H2: MiGetPageTablePfnBuddyRaw推导解密公式
    使用MMPFN+0x24 flags和动态基值计算真实CR3
```

### 内核关键结构体定位

```
EPROCESS关键字段:
  ActiveProcessLinks  - 双向链表(进程枚举)
  ObjectTable         - HANDLE_TABLE(句柄表)
  VadRoot             - MMVAD树(虚拟地址描述)

HANDLE_TABLE层级判断:
  TableCode低2位: 0=单层 / 1=双层 / 2=三层

MmPfnDatabase定位:
  扫描KeCapturePersistentThreadState指令模式获取基址
  条目大小0x18字节
  用途: 物理页→EPROCESS / CR3获取

PoolBigPageTable:
  从ExFreeHeapPool逆向索引计算算法
  每条目0x18字节(_Pool_Info结构)
```

### VT-x 虚拟化

```
利用层次:
  Level 1(最小Hypervisor): VMXON→VMCS→VMLAUNCH→VM-Exit处理(CPUID)
  Level 2(EPT Hook): 扩展页表控制内存访问/读写执行分离
  Level 3(系统监控): MSR Hook/CPUID模拟/进程感知/反作弊框架

学习框架: SimpleVisor → HyperBone → Hypervisor-From-Scratch → HyperPlatform → hvpp

反作弊应用注意:
  VT-x只能有一个Hypervisor，与Hyper-V/VBS/已有反作弊冲突
  EAC/BattlEye/TP主要在Ring 0，Riot Vanguard用完整Ring -1
```

---

