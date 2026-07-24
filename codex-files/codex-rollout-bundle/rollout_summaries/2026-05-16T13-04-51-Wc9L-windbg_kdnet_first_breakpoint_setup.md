thread_id: 018fd91f-4d38-7fbe-9b0f-1c40a819e5f7
updated_at: 2026-05-16T05:47:51+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\16\rollout-2026-05-16T13-04-51-018fd91f-4d38-7fbe-9b0f-1c40a819e5f7.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Documented WinDbg + kdnet setup from scratch: host + Hyper-V VM + first breakpoint in `DriverEntry`.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 host + Hyper-V. Setting up the debugging pipeline for the rest of the kernel-lab series.

## Task 1: kdnet setup end-to-end, break at `DriverEntry`

Outcome: success

Preference signals:
- The user wanted the setup captured in a single Markdown so any lab-VM rebuild takes minutes.
- Chinese narration; commands in English.

Key steps:
- On the target VM: `bcdedit /debug on` + `bcdedit /dbgsettings net hostip:<host_ip> port:50000 key:<autogen_key>` — captured the generated key.
- On the host: WinDbg Preview → "Attach to kernel" → Net → paste key + port.
- Rebooted the VM; WinDbg attached during boot.
- Placed a breakpoint on `nt!IopLoadDriver` for the next driver load; loaded the lab driver; hit break at driver entry.

Failures and how to do differently:
- Initial `bcdedit` on the wrong entry (VM had an EFI + BIOS dual entry); had to enum with `bcdedit` first and use the specific `{guid}`.
- Hyper-V virtual switch was External NAT — kdnet needs the host to be reachable from the VM at `hostip`; switched to Internal.

Reusable knowledge:
- kdnet key + port + hostip is all Windows needs; don't over-engineer with COM/1394 unless netstack is broken.
- Hyper-V default External switch NATs the VM behind the host; kdnet needs bidirectional visibility — use Internal.

References:
- [1] Notes: `docs/kdnet_setup.md`
- [2] WinDbg Preview 10.0.27829
- [3] Host / VM: Win11 host, Win11 23H2 VM
