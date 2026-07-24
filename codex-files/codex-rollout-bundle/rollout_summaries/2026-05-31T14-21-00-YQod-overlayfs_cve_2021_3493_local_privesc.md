thread_id: 0190725d-5310-79cb-a9a5-ddec38cb4290
updated_at: 2026-05-31T06:36:00+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\31\rollout-2026-05-31T14-21-00-0190725d-5310-79cb-a9a5-ddec38cb4290.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Reproduced OverlayFS local privesc (CVE-2021-3493) on Ubuntu 20.04.2, went from user to root via unprivileged user namespace.

Rollout context: cwd was `C:\Workspace\pwn-lab`, WSL + QEMU VM running Ubuntu 20.04.2 (kernel 5.8.0-53-generic). Purpose was the Ubuntu-specific OverlayFS bug reproducibility exercise.

## Task 1: OverlayFS unprivileged user namespace → setuid file → root

Outcome: success

Preference signals:
- Reproduce with the classic Ian Coldwater / Bhavuk Jain writeup, don't over-engineer.
- Chinese narration; C identifiers in English.

Key steps:
- Confirmed kernel is Ubuntu-flavored and pre-patch (5.8.0-53; fix landed in 5.8.0-55).
- Compiled the public PoC (creates a user namespace, mounts OverlayFS as unprivileged, writes a setuid-root shell to the upper dir).
- Ran the exploit; a `/tmp/root_shell` binary appeared, owned root:root, mode 4755.
- `./root_shell` dropped into `#` as uid=0.

Failures and how to do differently:
- First run hit `mount: permission denied` — the VM had `kernel.unprivileged_userns_clone=0` set. Reset via `sysctl -w kernel.unprivileged_userns_clone=1` (needs root, so did it from the VM console pre-exercise as the whole point is to have the bug exploitable).
- Kernel 5.8 has the vulnerability but 5.11+ has multiple mitigations that block the specific write-to-upper path; verified target kernel first.

Reusable knowledge:
- OverlayFS + unprivileged user namespace is an Ubuntu-specific patch bug (Debian upstream restricts). Only affects distros with the Ubuntu unprivileged namespace patch.
- The primitive is "unprivileged user in NS mounts overlay whose upper is a real filesystem the user has write to; kernel copies setuid bit through the copy-up path". Fixed by disallowing setuid on the copy-up.
- Detection: `getcap` on the copied-up file shows preserved caps; that's the signal the mount succeeded.

References:
- [1] PoC: public `exploit.c` from Bhavuk Jain writeup
- [2] Target VM: Ubuntu 20.04.2 + kernel 5.8.0-53
- [3] Reference: Ubuntu CVE-2021-3493 advisory
