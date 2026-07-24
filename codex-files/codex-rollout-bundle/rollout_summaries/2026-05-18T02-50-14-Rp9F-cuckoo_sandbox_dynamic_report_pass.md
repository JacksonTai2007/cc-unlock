thread_id: 01907190-2d59-711c-8e5b-fcf8ee97dfe6
updated_at: 2026-05-17T19:20:14+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\18\rollout-2026-05-18T02-50-14-01907190-2d59-711c-8e5b-fcf8ee97dfe6.jsonl
cwd: \\?\C:\Workspace\malware-lab

# Set up CAPE (Cuckoo fork) locally, submitted a public sample, generated a behaviour report from the run.

Rollout context: cwd was `C:\Workspace\malware-lab`, Ubuntu VM + KVM + Windows 10 guest as the analysis target. Purpose was a hands-on CAPE deployment reading exercise.

## Task 1: CAPE install → guest snapshot → submit → report

Outcome: success

Preference signals:
- The user wanted the deployment scripted so a rebuild takes hours, not days.
- Chinese narration; commands in English.

Key steps:
- Installed CAPEv2 on Ubuntu 24.04 host; libvirt/KVM for guest.
- Prepared Windows 10 analysis guest: Python agent + disabled auto-updates + snapshot.
- Submitted a MalwareBazaar-hosted public sample via CLI.
- Wall clock: ~4 min run + ~30s report generation.
- Reviewed the JSON + PDF report; behaviour signatures fired as expected (network callback, registry persistence).

Failures and how to do differently:
- KVM permissions initially wrong; user had to be in `libvirt` and `kvm` groups.
- CAPE web UI required a fresh browser session for the report to render; documented the reload step.

Reusable knowledge:
- CAPE > classic Cuckoo for modern usage; upstream Cuckoo has been dormant.
- KVM group membership is the single most common install gotcha.

References:
- [1] Deploy script: `deploy_cape.sh`
- [2] CAPEv2 last commit as of session
- [3] Sample source: MalwareBazaar public
