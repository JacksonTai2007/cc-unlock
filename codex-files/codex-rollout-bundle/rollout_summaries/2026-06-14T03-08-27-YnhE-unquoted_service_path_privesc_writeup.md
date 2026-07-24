thread_id: 01906b1c-8f79-7b1b-a1c7-5e57a3fb2b64
updated_at: 2026-06-13T19:47:27+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\14\rollout-2026-06-14T03-08-27-01906b1c-8f79-7b1b-a1c7-5e57a3fb2b64.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Exploited an unquoted service path on a training VM to escalate from user to SYSTEM.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Windows 10 lab VM with a training-pack service installed with an unquoted binPath containing spaces.

## Task 1: Unquoted binPath discovery → drop payload at token boundary → service restart → SYSTEM

Outcome: success

Preference signals:
- Chinese narration; PowerShell in English.
- Wanted the enumeration + exploit as separate scripts so future boxes reuse the enum stage.

Key steps:
- Enumerated with `wmic service get name,pathname,startmode | findstr /i "auto" | findstr /i /v "c:\\windows"` then manually filtered for unquoted paths.
- Found: `C:\Program Files\Vuln Software\service.exe` (unquoted, has space).
- Confirmed writability of `C:\Program Files\Vuln Software\` — writable by `Users`. (`icacls` output.)
- Placed a payload at `C:\Program Files\Vuln.exe` — Windows resolves the unquoted path by trying `C:\Program.exe` → `C:\Program Files\Vuln.exe` → `C:\Program Files\Vuln Software\service.exe`.
- Restarted service; the payload ran as SYSTEM.

Failures and how to do differently:
- First payload was a full C2 beacon — service startup timeout killed it. Reduced to a simple "spawn cmd" that exits fast.
- Restart via `sc stop / sc start` failed as user; had to trigger via a scheduled task or wait for reboot. Documented the "how to trigger" step.

Reusable knowledge:
- PowerUp module has `Get-UnquotedService` and `Invoke-ServiceAbuse` that automate this — good for quick scans.
- ACL check on every path token boundary is essential; unquoted service path is only exploitable if a token boundary directory is writable.
- Service payloads must respond to SCM control codes quickly or the service manager kills the process — use a two-stage payload (small stub → real payload).

References:
- [1] Enum script: `find_unquoted.ps1`
- [2] PoC payload: `Vuln.exe` (spawns cmd as SYSTEM)
- [3] Reference: HackTricks unquoted service path writeup
