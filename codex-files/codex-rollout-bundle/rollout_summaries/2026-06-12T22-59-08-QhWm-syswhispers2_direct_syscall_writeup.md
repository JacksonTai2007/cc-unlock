thread_id: 019052a4-df90-72d1-be6b-3d7e2ab7b902
updated_at: 2026-06-12T15:33:08+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\12\rollout-2026-06-12T22-59-08-019052a4-df90-72d1-be6b-3d7e2ab7b902.jsonl
cwd: \\?\C:\Workspace\evasion-lab

# Generated SysWhispers2-style direct-syscall stubs for a small `NtAllocateVirtualMemory` demo, verified the syscall executed.

Rollout context: cwd was `C:\Workspace\evasion-lab`, Win11 23H2 test VM. Study of the SSN retrieval + direct syscall pattern.

## Task 1: SysWhispers2 stub gen → link into demo binary → verify

Outcome: success

Preference signals:
- The user wanted a small demo (< 100 lines total) rather than a full framework.
- Chinese narration; identifiers in English.

Key steps:
- Ran SysWhispers2 for `NtAllocateVirtualMemory`; got the `.asm` + `.h` pair.
- Linked into a small Visual Studio project; called the wrapper from `main`.
- Confirmed via WinDbg that the syscall path bypassed `ntdll!NtAllocateVirtualMemory` proper.

Failures and how to do differently:
- SSN retrieval failed on the target build initially; SysWhispers2 sig scan needed a small update for 23H2. Applied the community-provided patch.

Reusable knowledge:
- SysWhispers2 style relies on discovering the Syscall Service Number by ntdll pattern scan; keep the scan pattern up to date across Win updates.
- Direct syscalls skip ntdll's userland patches but not kernel-mode monitoring; useful as a study of "what is monitored where".

References:
- [1] Demo: `direct_syscall_demo/`
- [2] SysWhispers2 patched fork
- [3] Test VM: Win11 23H2
