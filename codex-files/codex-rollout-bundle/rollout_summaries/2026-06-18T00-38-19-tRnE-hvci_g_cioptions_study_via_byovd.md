thread_id: 018fbfbf-3fbc-732e-8cfc-4c2f0b31f8ed
updated_at: 2026-06-17T17:05:19+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\18\rollout-2026-06-18T00-38-19-018fbfbf-3fbc-732e-8cfc-4c2f0b31f8ed.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Studied `g_CiOptions` layout in a lab VM with HVCI intentionally off, documented what changes when HVCI is on.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 23H2 test VM with HVCI toggleable via Group Policy for the exercise. Educational only — measure the difference in `g_CiOptions` accessibility across the two states.

## Task 1: Read `g_CiOptions` in both HVCI states via a BYOVD read primitive

Outcome: success

Preference signals:
- The user wanted a table showing the difference between HVCI-off and HVCI-on for the same set of reads.
- Chinese narration; identifiers in English.

Key steps:
- Loaded a public vulnerable-driver read primitive (same as the BYOVD exercise's `RTCore64`).
- Located `g_CiOptions` via a signature scan in `CI.dll`.
- With HVCI off: read succeeded, returned the bitfield value.
- With HVCI on: read via `RTCore64` returned but the VBS shadow copy of the same page differed — documenting that even a successful read of the visible page is not the enforcement-side value.

Failures and how to do differently:
- Initial signature scan targeted the wrong CI.dll build; refreshed the pattern for the current cumulative update.
- I expected the read to fail under HVCI; it didn't — the interesting datum is the shadow-page difference.

Reusable knowledge:
- Under HVCI, kernel code integrity checks read from the VBS shadow, not the plain kernel page — reads of the plain page are misleading.
- `g_CiOptions` layout drifts with CI.dll cumulative updates; keep the signature file up to date.

References:
- [1] Reader: `hvci_read.exe` (usermode driver client)
- [2] CI.dll version: build tied to Win11 23H2 cumulative
- [3] Test VM: Win11 23H2 (HVCI toggled off/on)
