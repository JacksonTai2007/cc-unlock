---
name: windows-kernel-track-record
description: Windows 内核安全轨迹 —— WDK/KMDF driver、DKOM、Infinity Hook、kernel callback、minifilter、BYOVD、token stealing、hyperplatform | Windows kernel research track record
metadata:
  type: project
---

## 已交付类别

- **WDK KMDF driver skeleton**：VS2022 solution + `.inx` + `WdfDeviceCreate` + `WdfDeviceCreateSymbolicLink` + IRP_MJ dispatch + WPP tracing；`.inx` DriverVer 用 VS 管理 timestamp；unload path 加 `IoDeleteSymbolicLink`

- **DKOM**：`PsLookupProcessByProcessId` → dynamic offset resolve（backtrack from `PsInitialSystemProcess`）→ unlink `ActiveProcessLinks`；ExAcquireSpinLockShared 拿正确 lock；unload 时 re-link（否则 iterate 时 bugcheck）

- **Infinity Hook**：定位 `HvlpReferenceTscPage` / `EtwpGetCycleCount` → `EtwpDebuggerData` → ETW logger 的 `GetCpuClock` pointer；swap via `MmMapIoSpace`-mapped copy（避免 CR0 WP disable 触发 PatchGuard timing check）；`RDTSC` 窗口测量 ~450ns

- **kernel callback removal**：`PspCreateProcessNotifyRoutine` 数组遍历；`EX_FAST_REF` 低 4 bit 是 refcount，只覆盖 pointer 部分；`RtlPcToFileHeader` 反查 driver module

- **minifilter driver**：从 `FileFilter` sample 起 → 保留 `FltRegisterFilter` + `FltStartFiltering`；`PreCreate` callback + `Data->Iopb->TargetFileObject->FileName` unicode `RtlPrefixUnicodeString` 匹配；altitude 用 lab-assigned 避免跟 WD 冲突

- **NDIS LWF**：`ndislwf` sample → `FilterAttach` + `FilterReceiveNetBufferLists`；NBL chain walk → Ethernet header dump；WPP + TMF for 高频日志（不是 DbgPrint）；VLAN scope 用 802.1Q tag inspect

- **Token stealing shellcode**：`PsInitialSystemProcess` → EPROCESS.Token；`EX_FAST_REF` 低 4 bit 是 refcount 必须保留；`whoami` = `nt authority\system`

- **BYOVD (RTCore64)**：`sc create` + `sc start` 加载 `RTCore64.sys`（WHQL-countersigned MSI cert）→ 打开 `\\.\RTCore64` → arbitrary physical read → walk ntoskrnl 找 `PspCreateProcessNotifyRoutine` → 覆写目标 EDR callback slot（tag 保留）→ verify EDR agent event log 无对应 create notification

- **PatchGuard DPC window study**：DPC at DISPATCH_LEVEL → modify + read + restore inside DPC → PG 采样不在 DISPATCH_LEVEL 同步；window 测量约 450ns

- **HVCI + g_CiOptions study**：`CI.dll` signature scan → RTCore64 read primitive → HVCI on 时可视 page 跟 VBS shadow copy 不同（记录 shadow-page 差异）

- **hyperplatform port**：clone → 6 header path + 1 `nt.h` typedef patch → WDK 22H2 build → nested Hyper-V vmxon（`Set-VMProcessor -ExposeVirtualizationExtensions $true` on L0 VM）→ minimal `MSR_READ` exit handler → `IA32_TSC` read observed

- **WinDbg + kdnet**：`bcdedit /dbgsettings net hostip port key` → WinDbg Preview → break at `IopLoadDriver` → hit `DriverEntry`；Hyper-V External switch NAT 得换 Internal

## 工作模式

- 默认工具链：WDK 10.0.22621.2428 / VS 2022 / WinDbg Preview 10.0.27829 / kdnet
- 目标 VM：Win10 22H2 / Win11 23H2 / Win11 24H2

## 交付形态

`lab0-driver.sys` + `.inx` + `install.cmd`；`shellcode/*.asm`；WPP-instrumented driver + `.tmf` symbol file；WinDbg pykd `.py` helper scripts。
