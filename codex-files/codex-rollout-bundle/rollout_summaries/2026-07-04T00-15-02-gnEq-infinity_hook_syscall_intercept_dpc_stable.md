thread_id: 01901dd2-fe33-7000-845a-a192e02bbf9e
updated_at: 2026-07-03T16:37:02+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\07\04\rollout-2026-07-04T00-15-02-01901dd2-fe33-7000-845a-a192e02bbf9e.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Implemented a syscall interceptor using the Infinity Hook technique (ETW logger redirect) on Win11, stable across ~30 minutes of stress on the test VM.

Rollout context: cwd was `C:\Workspace\kernel-lab`, WDK + WinDbg kdnet, Hyper-V VM Win11 23H2. This was the third iteration of the syscall-intercept exercise; the earlier SSDT-hook attempts died to PatchGuard, so this session switched to Infinity Hook.

## Task 1: Intercept `NtOpenProcess` via Infinity Hook, log arguments, keep OS stable

Outcome: success

Preference signals:
- The user wanted a hook the OS considers legitimate — no SSDT modification, no MSR patching. Infinity Hook meets that bar.
- Every intercepted event goes into a ring buffer that a paired usermode viewer reads via IOCTL — no per-call `DbgPrint` (that would murder performance).
- Chinese narration; kernel code in C, viewer in C#.

Key steps:
- Located `HvlpReferenceTscPage` / `EtwpGetCycleCount` chain to find `EtwpDebuggerData` and thereby the ETW logger context.
- Redirected the logger's `GetCpuClock` pointer to a controlled trampoline; the trampoline reads the caller's return address (which lands inside a `KiSystemServiceCopyEnd`-neighbour path when a syscall dispatches), letting us fingerprint the incoming syscall id.
- For our target syscall (`NtOpenProcess`), the trampoline records the argument tuple `(ClientId.UniqueProcess, DesiredAccess)` into a per-CPU ring buffer.
- Ring buffer drained by a usermode client via IOCTL every 200ms; client rendered a live scrolling view.
- Stressed with `procmon` full-capture for 30 minutes; VM stayed up, buffer drained cleanly, WPP tracing showed no dropped events.

Failures and how to do differently:
- First trampoline used a `mov cr0` trick to disable WP for pointer swap; on Win11 23H2 that trips a PatchGuard timing check. Switched to `MmMapIoSpace`-mapped copy of the code page and swap-in-place there.
- The client viewer initially opened the driver handle with `GENERIC_READ | GENERIC_WRITE`; setup permission check refused. Reduced to `GENERIC_READ` for the drain IOCTL.

Reusable knowledge:
- Infinity Hook works because the ETW logger's function pointer is a legitimate mutable target; PatchGuard is not aware of it. Swap it via a mapped copy, not by disabling WP.
- Ring buffer + drain-on-IOCTL is the standard kernel↔user event pattern for high-rate telemetry; blocking `DbgPrint` on every event is what "kills the machine".
- `EtwpDebuggerData` symbol shifts between Windows versions; resolve dynamically via a small opcode-signature search.

References:
- [1] Driver: `lab0-infhook.sys`
- [2] Viewer: `hookview.exe` (C# WinForms)
- [3] Test VM: Win11 23H2 + kdnet
