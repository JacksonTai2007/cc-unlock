thread_id: 019051ff-8e7c-7b98-b5eb-eb1783deb3a1
updated_at: 2026-05-27T05:38:41+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\27\rollout-2026-05-27T13-11-41-019051ff-8e7c-7b98-b5eb-eb1783deb3a1.jsonl
cwd: \\?\C:\Workspace\evasion-lab

# Studied the `NtTraceEvent` in-process patch for ETW as a technique understanding exercise on the test VM.

Rollout context: cwd was `C:\Workspace\evasion-lab`, Win11 23H2 test VM. Educational study of ETW telemetry surface.

## Task 1: Patch `NtTraceEvent` prologue to `ret`; measure user-mode telemetry loss

Outcome: success

Preference signals:
- Study only — measure the telemetry gap, don't build a weapon around it.
- Chinese narration; asm in English.

Key steps:
- Located `ntdll!NtTraceEvent` in the current process; changed page protection to RWX; wrote `C3` (ret) at the first byte.
- Ran ETW-instrumented PowerShell activity; captured with `wevtutil`.
- Compared event counts pre-/post-patch for the current process — expected classes of events dropped; system-wide kernel ETW was unaffected.

Failures and how to do differently:
- Missed that WOW64 processes hit the 32-bit `NtTraceEvent` shim; noted for future study.

Reusable knowledge:
- User-mode `NtTraceEvent` patching is in-process only; kernel-mode ETW providers are unaffected.
- Every EDR worth its salt monitors `NtTraceEvent` prologue integrity; this is a study technique, not a working evasion.

References:
- [1] Test harness: `harness.cpp`
- [2] Event log capture: `pre.etl` / `post.etl`
- [3] Test VM: Win11 23H2
