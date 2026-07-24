thread_id: 018fff26-49aa-77a8-828e-5c639b277382
updated_at: 2026-05-17T07:50:19+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\17\rollout-2026-05-17T15-15-19-018fff26-49aa-77a8-828e-5c639b277382.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Reproduced Sudo Baron Samedit (CVE-2021-3156) heap overflow on a lab VM, got root.

Rollout context: cwd was `C:\Workspace\pwn-lab`, WSL + QEMU VM running Ubuntu 18.04.5 with sudo 1.8.21p2. Purpose was the public Baron Samedit reproducibility exercise from Qualys's disclosure.

## Task 1: Baron Samedit heap overflow → root shell

Outcome: success

Preference signals:
- Follow the exact Qualys PoC layout (nss_load_library / _nss_files_open) so the walk is a study of the technique, not just "run this exploit".
- Chinese narration; C identifiers in English.

Key steps:
- Confirmed vulnerable sudo version via `sudo --version` (1.8.21p2 — fix in 1.9.5p2).
- Checked the "trigger" condition: `sudoedit -s '\'` returns "sudoedit: ..." and does NOT segfault → indicates vulnerable to Baron Samedit specifically.
- Cloned Qualys's `sudo-hax-me-a-sandwich` PoC from the public repo, built with the provided Makefile.
- Ran `./sudo-hax-me-a-sandwich <target_offset>` — the exploit tried offsets 0-9 automatically and landed root shell on offset 3.

Failures and how to do differently:
- Initial trigger check on a different VM (Debian 10) returned segfault — confirming NOT vulnerable to this exact variant; had to switch to Ubuntu 18.04.5 for the exercise.
- The auto-offset scan is not deterministic across kernel versions; documented the working offset per VM for repeat runs.

Reusable knowledge:
- Baron Samedit (CVE-2021-3156) affects sudo 1.8.2 through 1.9.5p1 — the bug is heap overflow in `parse_args` when `sudoedit` is symlinked with `-s`/`-i` flag.
- Detection primitive: `sudoedit -s '\' any/thing` — vulnerable sudo prints the sudoedit help; patched sudo segfaults with a sanitised message. Non-invasive check.
- Qualys PoC uses `nss_load_library` overflow into `service_user` structs, then hijacks nss module load.

References:
- [1] PoC: `sudo-hax-me-a-sandwich` (Qualys public repo)
- [2] Target VM: Ubuntu 18.04.5 + sudo 1.8.21p2
- [3] Reference: Qualys advisory CVE-2021-3156
