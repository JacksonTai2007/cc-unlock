thread_id: 018fee81-0574-746c-848b-a817c8d2f95f
updated_at: 2026-05-28T04:46:13+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\28\rollout-2026-05-28T12-10-13-018fee81-0574-746c-848b-a817c8d2f95f.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Went from a service account with `SeImpersonate` to SYSTEM via GodPotato on a Windows Server 2022 lab VM (post-PrintSpoofer patch).

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows Server 2022 fully patched. PrintSpoofer/JuicyPotato are blocked on modern Server; GodPotato works via COM DCOM abuse of RPCSS in-proc COM class.

## Task 1: GodPotato → SYSTEM shell

Outcome: success

Preference signals:
- Same style as the PrintSpoofer exercise — public binary, one command, verify.
- Chinese narration; commands in English.

Key steps:
- Confirmed `whoami /priv` showed `SeImpersonatePrivilege: Enabled`.
- Uploaded `GodPotato-NET4.exe` (the .NET 4.x build works on Server 2022).
- Ran `GodPotato-NET4.exe -cmd "cmd /c whoami"` → returned `nt authority\system`.
- For an interactive shell: `GodPotato-NET4.exe -cmd "cmd /c C:\Windows\System32\cmd.exe"`.

Failures and how to do differently:
- First attempt used the .NET 2.0 build; Server 2022 didn't have .NET 2.0 installed. Switched to NET4 build.
- GodPotato output includes an "OXID resolver" fingerprint that some EDR products flag — for exercises this is fine; for real assessments, an obfuscated fork exists.

Reusable knowledge:
- GodPotato bypasses the PrintSpoofer-era mitigation because it uses DCOM RPCSS's in-proc COM class instead of the RPC print spooler pipe. Works on Server 2019/2022/2025 as of 2026 patch level.
- Any modern Windows box where you land as an IIS/MSSQL/service account with `SeImpersonate` is one-tool-away from SYSTEM via GodPotato.

References:
- [1] Binary: `GodPotato-NET4.exe` (BeichenDream public build)
- [2] Test VM: Windows Server 2022 (fully patched)
- [3] Reference: BeichenDream's GodPotato writeup
