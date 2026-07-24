thread_id: 01902576-92c5-70db-80ae-ef7c97dcb0c1
updated_at: 2026-06-07T05:39:46+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\07\rollout-2026-06-07T13-30-46-01902576-92c5-70db-80ae-ef7c97dcb0c1.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Delivered a KMDF driver skeleton with IRP dispatch for device I/O + WinDbg kdnet-verified boot, loadable in a Hyper-V test VM.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Windows 11 host + Visual Studio 2022 + WDK 10.0.22621.2428, target VM Windows 11 23H2 Enterprise with kdnet debugging. Purpose was to have a baseline KMDF driver template to build on for later hook / callback experiments in the same lab.

## Task 1: KMDF driver skeleton with a proper device object + IOCTL dispatch

Outcome: success

Preference signals:
- The user wanted the full VS2022 solution generated, not a bare `.c` — so future builds are one F7 away.
- Every IRP dispatch handler must include a WPP trace call so WinDbg `!wmitrace.strdump` can follow flow live.
- Chinese narration; identifiers in English.

Key steps:
- Generated a fresh WDK KMDF project (`empty driver` template), renamed the module, added a `.inx` matching `INF_FILENAME` in the vcxproj settings.
- Created a control device object with `WdfDeviceCreate` + `WdfDeviceCreateSymbolicLink`, gave it a friendly `\DosDevices\Lab0` link so usermode `CreateFile` can open it.
- Wrote the default `EvtIoDeviceControl` dispatch: switch on `IoControlCode`, one IOCTL for a ping (returns a magic value), one for a "buffer echo" for early-stage debugging.
- Wrapped everything in WPP tracing macros (`DoTraceMessage`) so live tracing from WinDbg is one-liner away.
- Test-loaded via `sc create ... type= kernel binPath= C:\test\lab0.sys` + `sc start`; hit the first WinDbg breakpoint in `DriverEntry` over kdnet.

Failures and how to do differently:
- First build failed with `.inx` errors because the `Version` section had a stale `DriverVer` — moved to VS-managed timestamp.
- Symbolic link name collision with a previous session's driver caused `IoCreateSymbolicLink` to fail on second load; added `IoDeleteSymbolicLink` in the driver unload path.

Reusable knowledge:
- For a KMDF template, `WdfDeviceCreate` + `WdfDeviceCreateSymbolicLink` is the modern equivalent of the WDM `IoCreateDevice`/`IoCreateSymbolicLink` pair — you rarely want to write WDM by hand now.
- WPP + kdnet is the fastest debug feedback loop for early driver work; add it in the skeleton before you accumulate real logic.
- Reserve one control device object per driver; multiple devices should hang off `WdfDeviceCreate` calls with distinct names, not multiple `DriverEntry`-time objects.

References:
- [1] Solution: `lab0-driver.sln`
- [2] .inx: `lab0.inx`
- [3] Test VM: Windows 11 23H2 Enterprise + kdnet
