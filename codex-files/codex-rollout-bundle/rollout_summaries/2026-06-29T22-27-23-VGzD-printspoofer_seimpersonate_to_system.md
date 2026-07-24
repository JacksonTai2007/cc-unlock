thread_id: 018fe360-9334-742d-83db-33d55f89c14f
updated_at: 2026-06-29T14:54:23+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\29\rollout-2026-06-29T22-27-23-018fe360-9334-742d-83db-33d55f89c14f.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Went from a Windows service account with `SeImpersonatePrivilege` to `NT AUTHORITY\SYSTEM` via PrintSpoofer on a Server 2019 lab VM.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows lab VM Server 2019 (pre-2022 patch that mitigated PrintSpoofer). Foothold was an IIS AppPool identity with `SeImpersonate` in the exercise.

## Task 1: PrintSpoofer → SYSTEM shell

Outcome: success

Preference signals:
- Chinese narration; command line in English.
- Use the public `PrintSpoofer64.exe` binary as-is.

Key steps:
- Confirmed the token had `SeImpersonatePrivilege`: `whoami /priv` → Enabled.
- Uploaded `PrintSpoofer64.exe` via the web-based foothold; ran `PrintSpoofer64.exe -c cmd -i` → new cmd window ran as SYSTEM.
- Verified: `whoami` → `nt authority\system`.
- Used the SYSTEM shell to dump `lsass.exe` memory via `procdump -ma lsass.exe C:\Windows\Temp\lsass.dmp` for the next exercise stage.

Failures and how to do differently:
- On first attempt the target had been patched to Server 2019 May 2022 CU — PrintSpoofer failed with "Cannot connect to the local named pipe". Rolled the VM back to a pre-patch snapshot.
- `-c` flag needs a session — using `-i` (interactive) spawned a new window that survives.

Reusable knowledge:
- Server 2019 pre-May-2022 CU: PrintSpoofer works reliably. Post-patch: use RogueWinRM or GodPotato for the same "SeImpersonate → SYSTEM" escalation.
- Any account with `SeImpersonatePrivilege` (typical IIS AppPool, MSSQL service, some scheduled tasks) is a one-tool-away from SYSTEM on unpatched boxes.

References:
- [1] Binary: `PrintSpoofer64.exe` (itm4n public build)
- [2] Test VM: Windows Server 2019 (pre-2022-05 CU)
- [3] Reference: itm4n's PrintSpoofer writeup
