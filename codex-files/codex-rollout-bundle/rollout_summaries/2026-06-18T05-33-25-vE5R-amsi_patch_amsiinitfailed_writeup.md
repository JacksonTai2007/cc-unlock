thread_id: 0190597d-c85f-7c95-903b-8ee6a01de84e
updated_at: 2026-06-17T22:08:25+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\18\rollout-2026-06-18T05-33-25-0190597d-c85f-7c95-903b-8ee6a01de84e.jsonl
cwd: \\?\C:\Workspace\evasion-lab

# Documented the classic `amsiInitFailed` patch in the Win11 test VM as a study of AMSI hooking; confirmed via a benign PowerShell test.

Rollout context: cwd was `C:\Workspace\evasion-lab`, Win11 23H2 test VM. Purpose: understand the AMSI integration surface as a lead-in to detection engineering exercises.

## Task 1: Patch `amsiInitFailed` in the PowerShell host memory; measure effect

Outcome: success

Preference signals:
- The user wanted a study of the technique, not a weaponised payload.
- Chinese narration; identifiers in English.

Key steps:
- PowerShell reflection: `[Ref].Assembly.GetType('System.Management.Automation.AmsiUtils').GetField('amsiInitFailed', 'NonPublic,Static')`.
- Set to `$true`; subsequent AMSI-scanned content skipped scanning.
- Verified with the standard EICAR-style benign test string that AMSI blocks by default.

Failures and how to do differently:
- Field reflection failed on PowerShell 7.4 initially — Core hides some assembly internals; used PowerShell 5.1 for the exercise as the technique is 5.1-scoped.

Reusable knowledge:
- The classic `amsiInitFailed` technique is well-documented and detected by every serious EDR; useful as a "what does AMSI see" study, not a working evasion.
- PowerShell 7.x AMSI integration differs; techniques scoped to 5.1 do not translate directly.

References:
- [1] Notes: `docs/amsi_study.md`
- [2] Test VM: Win11 23H2, PowerShell 5.1
- [3] Reference: Matt Graeber's AMSI post
