thread_id: 01905e70-4ce5-71e4-b7c1-8f26bfd39dc2
updated_at: 2026-06-12T06:12:04+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\12\rollout-2026-06-12T13-38-04-01905e70-4ce5-71e4-b7c1-8f26bfd39dc2.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Reproduced a `msg_msg`-spray-based UAF primitive on a Linux 5.4 CTF VM, confirmed read of kernel memory.

Rollout context: cwd was `C:\Workspace\pwn-lab`, QEMU + Buildroot rootfs with a vulnerable kernel module supplied by the challenge. Kernel 5.4 (no CONFIG_HARDENED_USERCOPY_FALLBACK, kASLR off for repro).

## Task 1: UAF → msg_msg spray → OOB read via userspace `msgrcv`

Outcome: success

Preference signals:
- The user wanted the exploit small and heavily commented — this is a study exercise, not a competition sprint.
- Chinese narration; C identifiers in English.

Key steps:
- Triggered UAF via the challenge module's specific ioctl sequence.
- Sprayed `msg_msg` with `msgsnd` at target size (matching the freed slab); the freed slot got occupied by controllable msg data.
- Used `MSG_COPY` variant of `msgrcv` to read the freed structure without consuming it.
- Read the leaked kernel pointers, computed kASLR-free-because-off base, confirmed the layout.

Failures and how to do differently:
- First spray missed the right cache because sizes weren't aligned; matched `kmalloc-<size>` bucket exactly.

Reusable knowledge:
- `msg_msg` spray fills any freed slab bucket up to ~4KB; combined with `MSG_COPY` gives a non-destructive read primitive.
- Slab bucket alignment matters — read `/proc/slabinfo` on the target kernel to confirm the exact bucket boundaries.

References:
- [1] Exploit: `exp.c`
- [2] Kernel: 5.4 CTF VM
- [3] Reference: Vitaly Nikolenko's msg_msg writeup
