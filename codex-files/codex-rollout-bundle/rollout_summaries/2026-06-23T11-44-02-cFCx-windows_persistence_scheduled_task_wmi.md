thread_id: 01900b4d-bc52-7488-ab57-bbbc40715253
updated_at: 2026-06-23T04:12:02+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\23\rollout-2026-06-23T11-44-02-01900b4d-bc52-7488-ab57-bbbc40715253.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Installed three persistence mechanisms on a lab Windows 10 VM — Scheduled Task, Registry Run, WMI event subscription — and documented removal.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows 10 lab VM with SYSTEM already achieved. Exercise was to compare persistence techniques + their detection signatures.

## Task 1: Three persistence installs + verification + cleanup

Outcome: success

Preference signals:
- Chinese narration; PowerShell/schtasks in English.
- Each install includes a paired removal command in the writeup.

Key steps:
1. **Scheduled Task** (user-visible in Task Scheduler): `schtasks /create /tn "LabTask" /tr "C:\Temp\lab.exe" /sc onlogon /ru SYSTEM`. Remove: `schtasks /delete /tn "LabTask" /f`.
2. **Registry Run key** (per-user autorun on logon): `reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v LabRun /d "C:\Temp\lab.exe"`. Remove: `reg delete ... /f`.
3. **WMI event subscription** (stealthiest of the three, survives reboot, no scheduled task entry): PowerShell script that binds an `__EventFilter` (poll for logon) + `CommandLineEventConsumer` (spawn lab.exe) + `__FilterToConsumerBinding`. Remove: three `Remove-WmiObject` calls in reverse order.
- Verified each by rebooting the VM and confirming lab.exe fired; checked EventLog (schtasks makes 4698/4700; Run key + WMI make less noise).

Failures and how to do differently:
- WMI subscription initially bound to `Win32_LogonSession` — fires many times per boot. Bound to `__InstanceCreationEvent WITHIN 60 WHERE TargetInstance ISA 'Win32_LogonSession'` for one-per-logon behavior.
- Registry Run wrote to HKLM in a first attempt; user context failed on write. Moved to HKCU (user-writable).

Reusable knowledge:
- Detection difficulty: Scheduled Task = high (audit log entries), Registry Run = medium (autoruns catches it), WMI = low (Sysmon with WMI subs enabled catches it; default logging doesn't).
- WMI subscriptions require SYSTEM to write to the root/subscription namespace; user-context WMI subs don't survive logoff.
- Always document removal alongside install for exercise cleanliness; forgotten persistence artefacts on a shared lab VM waste future team time.

References:
- [1] Install scripts: `sched.ps1`, `runkey.reg`, `wmisub.ps1`
- [2] Cleanup scripts: `_uninstall.ps1`
- [3] Reference: MITRE ATT&CK T1053.005, T1547.001, T1546.003
