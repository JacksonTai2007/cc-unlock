thread_id: 019053c1-8f5f-7ff6-b57e-38a53e51a5d1
updated_at: 2026-06-09T04:43:33+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\09\rollout-2026-06-09T12-10-33-019053c1-8f5f-7ff6-b57e-38a53e51a5d1.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Ported the open-source hyperplatform skeleton to build against WDK 22H2, brought up a minimal EPT MSR hook in a nested Hyper-V VM.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 host with nested virtualization enabled. Purpose was the hyperplatform reading-list exercise; hyperplatform is a well-known public reference for Intel VT-x hypervisor drivers.

## Task 1: hyperplatform port + minimal MSR-read exit handler

Outcome: success

Preference signals:
- The user wanted a documented build patch so future WDK bumps are one-file diffs.
- Chinese narration; identifiers in English.

Key steps:
- Cloned hyperplatform; the last upstream commit lagged WDK by ~1 year — patched 6 header path changes and one `nt.h` typedef breakage.
- Built in the WDK 22H2 environment; loaded in the nested VM; verified vmxon via `!vmread` in WinDbg from the L0 hypervisor debug session.
- Added a minimal `MSR_READ` exit handler that logs the requested MSR + returned value.
- Verified by having a usermode process read `IA32_TSC` — the handler observed the read.

Failures and how to do differently:
- First build produced a driver that BSOD'd immediately after `vmxon` — root cause was a mismatched `CONTROL_REGISTER_ACCESS_QUALIFICATION` layout in the ported headers.
- Nested virt needed a specific Hyper-V feature toggle on the L0 VM; documented the exact command.

Reusable knowledge:
- hyperplatform is a fine skeleton but always lags WDK by many months; expect header patches.
- Nested virt requires `Set-VMProcessor -VMName <VM> -ExposeVirtualizationExtensions $true` before the L1 VM can vmxon.

References:
- [1] Fork: `hyperplatform-lab/`
- [2] WDK 22H2
- [3] Nested VM setup notes: `docs/nested_hyperv.md`
