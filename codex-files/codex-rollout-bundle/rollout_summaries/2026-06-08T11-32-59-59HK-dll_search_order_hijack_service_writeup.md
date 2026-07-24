thread_id: 01902171-1e31-74ae-aff4-572fb6b3f030
updated_at: 2026-06-08T03:57:59+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\08\rollout-2026-06-08T11-32-59-01902171-1e31-74ae-aff4-572fb6b3f030.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Exploited a DLL search-order hijack in a lab third-party service to run code as SYSTEM on Windows 10 test box.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows 10 lab VM with a deliberately-vulnerable third-party service (from a HTB-style training pack) running as SYSTEM.

## Task 1: Identify writable DLL search path → drop payload DLL → wait for service restart → SYSTEM

Outcome: success

Preference signals:
- Chinese narration; C in English for the payload DLL.
- Payload DLL should just spawn `cmd.exe` — no beacon needed for the exercise.

Key steps:
- Ran ProcMon filtered on the service process during startup; captured `NAME NOT FOUND` results for DLL loads.
- One `NAME NOT FOUND` was for `dwmapi.dll` in the service's install directory (which was ACL'd world-writable).
- Wrote a minimal DLL with `DllMain` that spawns `cmd.exe` — compiled with mingw for portability.
- Dropped the DLL to the writable path; restarted the service.
- Interactive cmd.exe spawned as SYSTEM.

Failures and how to do differently:
- First DLL used `system("cmd.exe")` — sometimes silently fails from `DllMain`. Switched to `CreateProcess` with `CREATE_NO_WINDOW` cleared.
- Payload DLL blocked the process init when it did too much in `DllMain`. Kept it minimal: fork process, return immediately.

Reusable knowledge:
- ProcMon + `NAME NOT FOUND` filter is the fastest DLL hijack discovery technique. Filter by process name at start.
- Service ACL check: `icacls <service_dir>` — writable by non-admin is the exploitable state.
- Standard payload for the exercise stage is a "spawn cmd" DLL. Real assessments should use a proper beacon (out of scope here).

References:
- [1] Payload DLL: `dwmapi.dll` (custom, replaces the not-found lookup)
- [2] Test VM: Windows 10 22H2 with training-pack service
- [3] Reference: itm4n / PowerUp DLL hijack primer
