thread_id: 0190402b-1a1a-72c9-b2d7-2841fda8f81c
updated_at: 2026-06-04T23:52:10+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\05\rollout-2026-06-05T07-19-10-0190402b-1a1a-72c9-b2d7-2841fda8f81c.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Solved a format-string CTF challenge: leaked libc via %p walk, then arbitrary write to `printf`'s got entry with `%hn`.

Rollout context: cwd was `C:\Workspace\pwn-lab`, WSL Ubuntu, glibc 2.35. Public CTF challenge with a printf-format vulnerability.

## Task 1: Format string → libc leak → arbitrary write → shell

Outcome: success

Preference signals:
- The user wanted the exploit small and readable (< 60 lines), pwntools style.
- Chinese narration; identifiers in English.

Key steps:
- Enumerated stack offsets with a `%p.%p.%p.%p` template; found the read of the printf return address at offset 8.
- From that leak, computed libc base, then `system`.
- Constructed a `%<N>c%<off>$hn` chain to overwrite the low two bytes of `printf@got` with the low two bytes of `system`; libc base upper bits were shared with `printf` in this binary.
- Sent a `/bin/sh` string as the next format-string trigger; got a shell.

Failures and how to do differently:
- Miscounted `%hn` positional writes on the first attempt; the write went to a nearby stack slot. Verified with `gdb.attach` before firing the real write.

Reusable knowledge:
- `%<N>c%<off>$hn` writes low N-bit count to the pointer at stack slot `off`; the sum of `N`s across successive `hn`s is what lands in the target — order matters.
- When target and source addresses share high bits, single-halfword `hn` writes are enough; otherwise use two `hn` writes.

References:
- [1] Exploit: `exploit.py`
- [2] libc: 2.35
