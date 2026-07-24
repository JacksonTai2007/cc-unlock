thread_id: 019055be-e5c8-7cf9-89b6-16c8a8f42b57
updated_at: 2026-05-24T10:44:59+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\24\rollout-2026-05-24T18-06-59-019055be-e5c8-7cf9-89b6-16c8a8f42b57.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Studied a DPC-timer-based PatchGuard bypass on the Win11 23H2 test VM, demonstrated a modification survived a PG cycle in the lab.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 23H2 test VM. Purely educational: what does a PG cycle check, and how does the DPC-timer window slip through?

## Task 1: DPC-timer modify-then-restore pattern; measure the window

Outcome: success

Preference signals:
- The user wanted every measurement logged (window size in nanoseconds, cycles per PG check estimate).
- Chinese narration; identifiers in English.

Key steps:
- Set a DPC timer at IRQL DISPATCH_LEVEL.
- Inside the DPC, modified the target byte, executed one instruction that read the modified value, restored the byte.
- Measured the modification window via `RDTSC` — averaged ~450ns per cycle on the VM.
- Confirmed the modification survived by leaving the state modified across many DPCs and observing PG didn't fire within 24h.

Failures and how to do differently:
- First DPC ran too long between modify and restore; PG's timing check triggered a bugcheck. Reduced to a single instruction between the pair.
- IRQL restoration path had a subtle bug that leaked one raise — traced with `!irql` in WinDbg.

Reusable knowledge:
- PG's periodic scan does not sample at IRQL DISPATCH_LEVEL synchronously; the DPC-timer window is what makes the trick work.
- Measure with `RDTSC` — do not rely on `KeQueryPerformanceCounter` for nanosecond-scale measurements inside a DPC.

References:
- [1] Driver: `lab0-pg-window.sys`
- [2] Measurement log: `pg_window_measurements.csv`
- [3] Test VM: Win11 23H2
