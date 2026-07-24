thread_id: 018fd806-b4f3-7af0-a9b3-ee37e382e142
updated_at: 2026-07-03T22:35:24+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\07\04\rollout-2026-07-04T05-52-24-018fd806-b4f3-7af0-a9b3-ee37e382e142.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Implemented DKOM process-hiding by unlinking EPROCESS from ActiveProcessLinks on a Win11 23H2 test VM, verified from user mode.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Windows 11 host + WDK + WinDbg kdnet to a Hyper-V VM (Win11 23H2). Purpose was a hands-on DKOM exercise as part of understanding what a modern EDR would need to detect.

## Task 1: Unlink a target PID's EPROCESS from ActiveProcessLinks, verify hidden from EnumProcesses, verify still runnable

Outcome: success

Preference signals:
- The user wanted the driver to accept a target PID via IOCTL from a usermode probe rather than hardcoding it.
- Every offset that could shift across Win11 revisions must be looked up dynamically (no hardcoded magic numbers).
- Chinese narration; identifiers in English.

Key steps:
- Added an IOCTL to the lab driver skeleton that takes a PID.
- Located the target `EPROCESS` via `PsLookupProcessByProcessId`; walked `ActiveProcessLinks` using the offset resolved dynamically from `PsInitialSystemProcess` (backtrack from a known-good `EPROCESS` field pattern).
- Acquired the appropriate lock (`ExAcquireSpinLockShared` on `PspActiveProcessMutex`; on 23H2 the accessor is via `PsGetProcessInformation`-adjacent structure — inspected via WinDbg to get the correct type).
- Performed the classic double-unlink: `Flink->Blink = Blink; Blink->Flink = Flink;` on the target's `ActiveProcessLinks`.
- Confirmed from usermode: `EnumProcesses` no longer listed the PID; `OpenProcess` by PID still worked (process is still schedulable); Task Manager view no longer shows it.

Failures and how to do differently:
- First offset computation was for Win10 22H2 layout; crashed the VM with a `PAGE_FAULT_IN_NONPAGED_AREA` on the walk. Rebuilt with the dynamic offset lookup pass.
- Initially did not re-link on driver unload; the second load blue-screened when the OS eventually tried to iterate the process list. Added a `re-link on Unload` cleanup.

Reusable knowledge:
- Offsets in `EPROCESS` (`ActiveProcessLinks`, `UniqueProcessId`, `ImageFileName`) shift between Windows major releases and sometimes within cumulative updates; never hardcode.
- Modern Windows uses a shared/exclusive lock guarding the active-process list; taking the wrong lock (or none) is a fast way to a bugcheck.
- Cleanup on driver unload is essential — hidden processes not re-linked at unload will crash the OS eventually.

References:
- [1] Driver: `lab0-dkom.sys` (extends the lab skeleton)
- [2] Usermode probe: `probe.exe` (calls the IOCTL, EnumProcesses before/after)
- [3] Test VM: Win11 23H2 + kdnet
