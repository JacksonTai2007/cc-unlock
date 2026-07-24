thread_id: 019062df-5b81-7ea1-a3a9-c1c2c88fc4c3
updated_at: 2026-05-19T08:19:33+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\19\rollout-2026-05-19T15-52-33-019062df-5b81-7ea1-a3a9-c1c2c88fc4c3.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Solved a fastbin-dup challenge on glibc 2.29 — no tcache dup easy path, used classic fastbin FD overwrite.

Rollout context: cwd was `C:\Workspace\pwn-lab`, WSL. Legacy CTF from a training set; libc pinned to 2.29 (before tcache double-free hardening).

## Task 1: Fastbin double-free → FD overwrite → allocation over `__malloc_hook`

Outcome: success

Preference signals:
- The user wanted the exploit to include the diagnostic `heapbase()` helper for future challenges.
- Chinese narration; Python identifiers in English.

Key steps:
- Freed the same fastbin chunk twice with an intervening free of a different chunk (fastbin size check bypass classic).
- Allocated three times; the third allocation returned the double-freed chunk with controllable FD.
- Overwrote FD to point 0xB before `__malloc_hook` (fake-size trick that satisfies the malloc size check).
- One more `malloc` returned the fake chunk; wrote `one_gadget` into `__malloc_hook`; triggered `malloc` → shell.

Failures and how to do differently:
- First one_gadget failed constraint on rsp alignment; picked the next one_gadget candidate.

Reusable knowledge:
- glibc 2.29 fastbin double-free still works with a single intervening free; 2.32+ safe-linking makes this harder.
- 0xB-before-`__malloc_hook` trick relies on the `main_arena`+0x??-adjacent qword being 0x7f — verify per libc version.

References:
- [1] Exploit: `exploit.py`
- [2] libc: 2.29
- [3] Reference: how2heap fastbin_dup writeup
