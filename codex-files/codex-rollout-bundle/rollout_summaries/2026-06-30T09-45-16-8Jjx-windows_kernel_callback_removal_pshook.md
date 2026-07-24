thread_id: 019062c9-a0dd-7a11-be0d-83b26719e820
updated_at: 2026-06-30T02:12:16+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\30\rollout-2026-06-30T09-45-16-019062c9-a0dd-7a11-be0d-83b26719e820.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Walked `PsSetCreateProcessNotifyRoutine` slot removal in the Hyper-V test VM as a study exercise; documented the correct EX_FAST_REF handling.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 23H2 test VM. Continuing the kernel-callback series from the BYOVD exercise.

## Task 1: Enumerate and remove one callback slot cleanly

Outcome: success

Preference signals:
- The user wanted the walk written as a Python helper for WinDbg (`.load pykd`) so the enum is a one-liner after breakpoint.
- Chinese narration; commands in English.

Key steps:
- Resolved `PspCreateProcessNotifyRoutine` array via a signature scan in ntoskrnl.
- For each of the ~64 slots, deref (with the low-4-bit tag mask cleared) → `EX_CALLBACK_ROUTINE_BLOCK` → driver-owning module via `RtlPcToFileHeader`.
- Cleared only the pointer half of the target slot; preserved the tag bits.
- Sanity-checked with a probe process — the target driver no longer received the create notification.

Failures and how to do differently:
- First mask constant was wrong (0xF vs 0x7); on Win11 the low 4 bits are the ref count. Verified with `dt _EX_FAST_REF` in WinDbg.

Reusable knowledge:
- `EX_FAST_REF` low 4 bits are a refcount tag; overwrite the pointer half only.
- The `RtlPcToFileHeader` call resolves the driver module for any callback body address — cleaner than parsing the callback block's own metadata.

References:
- [1] Script: `windbg/pspcallback_enum.py`
- [2] WinDbg + pykd
- [3] Test VM: Win11 23H2
