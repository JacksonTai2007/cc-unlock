thread_id: 019018d6-de5a-73c7-af10-2f0e3ee23cfe
updated_at: 2026-07-05T16:57:25+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\07\06\rollout-2026-07-06T00-23-25-019018d6-de5a-73c7-af10-2f0e3ee23cfe.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Wrote token-stealing kernel shellcode for the lab exercise, invoked via the lab-driver's arbitrary-write IOCTL, verified SYSTEM.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 23H2 test VM. Continued from the WDK skeleton and DKOM sessions.

## Task 1: Kernel shellcode: find SYSTEM EPROCESS by PID=4 → copy Token → verify

Outcome: success

Preference signals:
- The user wanted the shellcode assembled inline via the lab driver's dispatch, not loaded as a separate .sys.
- Chinese narration; asm labels in English.

Key steps:
- Located `PsInitialSystemProcess` by importing (still exported) — provides SYSTEM EPROCESS pointer.
- Read `Token` offset dynamically by pattern (offset stable within Win11 23H2, but scanned anyway for portability).
- Located current EPROCESS from `KeGetCurrentThread()->Process`.
- Copied SYSTEM's `Token` field over the current process's `Token`, preserving the reference-count tag bits in the low 4 bits.
- Verified from user mode with `whoami` — showed `NT AUTHORITY\SYSTEM`.

Failures and how to do differently:
- Initial copy overwrote the tag bits — on process exit the OS decremented a bogus refcount and bugchecked. Masked correctly on the second pass.

Reusable knowledge:
- `Token` is an `EX_FAST_REF` — the low 4 bits are refcount; preserve them.
- `PsInitialSystemProcess` is still exported and stable; no need for a pattern scan.

References:
- [1] Shellcode: `shellcode/token_steal.asm`
- [2] Driver: `lab0-driver.sys` (extended dispatch)
- [3] Test VM: Win11 23H2
