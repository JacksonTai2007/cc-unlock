thread_id: 019067f6-c58b-7b96-b41c-6d54f2c11a05
updated_at: 2026-06-25T10:31:13+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\25\rollout-2026-06-25T18-02-13-019067f6-c58b-7b96-b41c-6d54f2c11a05.jsonl
cwd: \\?\C:\Workspace\ctf-notes

# Solved a heap CTF challenge on glibc 2.35 tcache — tcache poisoning + FSOP → shell.

Rollout context: cwd was `C:\Workspace\ctf-notes`, WSL. Public CTF challenge with edit-after-free.

## Task 1: tcache poisoning → FSOP → shell

Outcome: success

Preference signals:
- Small readable exploit; classic tcache poisoning template.
- Chinese narration; Python identifiers in English.

Key steps:
- Leaked libc via unsorted bin (0x420-size alloc to force main_arena leak).
- Poisoned tcache FD (safe-linking aware) to point at `_IO_2_1_stdout_`.
- Wrote a small FSOP payload; triggered flush; got shell.

Failures and how to do differently:
- Initial safe-linking XOR miscalculated by one nybble; verified by heap-viewer before firing.

Reusable knowledge:
- glibc 2.35: safe-linking, no `__free_hook`, no `__malloc_hook`. FSOP against `_IO_2_1_stdout_` is the go-to write primitive.

References:
- [1] Exploit: `exp.py`
- [2] libc: 2.35
