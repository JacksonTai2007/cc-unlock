thread_id: 018ff9d2-8a4a-78d1-aa6c-0b145a89d7ce
updated_at: 2026-06-02T15:28:11+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\02\rollout-2026-06-02T23-15-11-018ff9d2-8a4a-78d1-aa6c-0b145a89d7ce.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Reproduced PwnKit (CVE-2021-4034) on a lab Ubuntu 20.04 VM, got root from unprivileged user.

Rollout context: cwd was `C:\Workspace\pwn-lab`, WSL + QEMU VM running Ubuntu 20.04.3 with polkit 0.105-26. Purpose was the public PwnKit reproducibility exercise from Qualys's disclosure.

## Task 1: PwnKit local privesc — build + fire + root shell

Outcome: success

Preference signals:
- The user wanted the classic Qualys `cve-2021-4034.c` PoC (not a rewrite), built with `gcc -o exploit`, then run once.
- Chinese narration in the writeup; C identifiers in English.

Key steps:
- Confirmed polkit version via `dpkg -l policykit-1` — vulnerable (fix landed in 0.120-0ubuntu0.20.04.3).
- Downloaded the Qualys PoC from a public mirror; compiled inline (`gcc -o exploit exploit.c`).
- Ran `./exploit` — dropped into a `#` shell as root within ~50ms.
- Confirmed root: `id` showed uid=0(root); read `/etc/shadow` to verify capability.

Failures and how to do differently:
- First VM had already been auto-patched via unattended-upgrades — snapshotted, rolled back to pre-patch state before re-running.
- gcc missing on the target initially; the PoC also works cross-compiled from the WSL side and dropped in as a static ELF.

Reusable knowledge:
- PwnKit exploits pkexec's argv handling with `argc == 0` — the bug lets envp values (including `GCONV_PATH`) be interpreted as elevated. Any distro with polkit < 0.120 fixed cutoff is candidate.
- The fix is a one-line check `if (argc < 1) exit(127)`; verify with `strings /usr/bin/pkexec | head -20` for the specific error string, or check package version.
- Standard mitigation for exercises is `chmod 0755 /usr/bin/pkexec` (removes the setuid bit) — apply after the exercise if you're not rolling back.

References:
- [1] PoC: `cve-2021-4034.c` (Qualys public mirror)
- [2] Target VM: Ubuntu 20.04.3 LTS + polkit 0.105-26
- [3] Reference: Qualys advisory CVE-2021-4034
