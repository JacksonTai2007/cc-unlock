# Historical project notes

Cross-domain project summaries archived by direction. All on own lab / self-built targets / public CVE reproductions / public CTF challenges.

---

## AI red teaming

- **Prompt injection research**: direct injection / indirect injection (markdown carrier, MCP tool poisoning, RAG embedding poisoning, agentic browser DOM payload, LLM sandbox escape enumeration). Local Ollama + self-built RAG target for sample collection.
- **Jailbreak suffix**: GCG suffix generation (nanoGCG on local Llama3), PyRIT / Garak scanning locally deployed models.
- **Model extraction experiments**: own small-scale API, query-based distillation and output-reconstruction experiments.
- **Agentic attack**: tool poisoning, system-prompt exfiltration, multi-hop prompt injection — all targets self-hosted.

## Windows kernel research (Hyper-V test VMs)

- **Driver development**: WDK / KMDF skeleton, IRP dispatch, minifilter file interception, NDIS LWF traffic interception.
- **DKOM / EPROCESS unlink**: Win11 lab process-hide PoC.
- **Infinity Hook**: syscall intercept via DPC (stable variant).
- **Kernel callback removal**: PsSetCreateProcessNotifyRoutineEx / callback list cleanup, EDR unload research.
- **PatchGuard bypass**: DPC timer bypass writeup.
- **BYOVD**: RTCore64 callback removal, AsIO2 arbitrary R/W, signed-driver-abuse sample analysis.
- **Kernel exploit**: token-impersonation shellcode, HVCI-context g_CiOptions study (via BYOVD).
- **Rootkit skeleton**: hyperplatform-style HV rootkit skeleton, DKOM + hook chain.

## Android kernel research (bootloader-unlocked test device)

- **Kernel exploit reproduction**: Dirty Pipe (CVE-2022-0847), Dirty COW, OverlayFS (CVE-2021-3493).
- **boot.img analysis**: magiskboot unpack / repack, AVB signature research, init.rc replacement.
- **KernelSU / Magisk / Zygisk**: module development, binder transaction analysis, SELinux domain transition.
- **LKM cross-compile**: arm64 Makefile skeleton + insmod debugging.
- **TEE / modem**: surface research (not deep-dive), Trustonic / QSEE structure sketch.

## Reverse engineering

- **VMP analysis**: handler table extraction, bytecode lift to C via symbolic execution (miasm / Triton). VMP 3.x ~110-120 handlers.
- **Themida unpacking**: ScyllaHide + Scylla dump + IAT rebuild, OEP location, anti-debug walkthrough.
- **OLLVM deobfuscation**: D-810 IDA plugin, miasm symexec flattening recovery.
- **UPX / ASPack / MPRESS**: manual unpacking notes.
- **IL2CPP dump**: Il2CppDumper + Dobby + cross-version RVA remap helper.
- **Modern languages**: Rust demangle + trait dispatch trace, Go pclntab recovery, Swift metadata (Hopper Swift plugin), Flutter Dart snapshot (reFlutter), .NET AOT hybrid pass.
- **Registration validation**: serial fishing, license-file check, online activation reproduction, time-limit removal.

## Vulnerability research & exploit development

- **CVE reproduction**: PwnKit (2021-4034), Baron Samedit (2021-3156), Log4Shell full chain, Fastjson unmarshal, Spring4Shell, Struts2 S2-062, SSRF → Redis RCE via gopher.
- **pwn**: stack overflow → ret2libc, format string arbitrary write, tcache poisoning, fastbin dup, heap fastbin dup libc229, v8 type confusion CTF, msg_msg spray UAF.
- **Fuzzing**: AFL++ target harness, libFuzzer target build.

## Server pentest + AD

- **ADCS**: ESC1 Certipy domain takeover full flow, ESC8 PetitPotam relay chain.
- **Kerberos**: AS-REP roasting → hashcat, Kerberoasting, Golden Ticket, Silver Ticket.
- **BloodHound**: shortest-path → DA writeup.
- **Lateral**: PsExec / WMI / WinRM, Sliver C2 implant lab bringup.
- **Web → RCE**: SSTI (Jinja) walkthrough, SQLi INTO OUTFILE → webshell.

## Privilege escalation

- Linux: SUID enumeration, cron setuid hijack, cron pivot.
- Windows: PrintSpoofer, GodPotato, AlwaysInstallElevated MSI payload, DLL search-order hijack (service), Unquoted Service Path, UAC bypass (fodhelper registry hijack).

## Evasion

- SysWhispers2 direct syscall full writeup.
- AMSI patch (AmsiInitFailed).
- ETW patch (NtTraceEvent).
- Reflective DLL Injection.
- msfvenom payload generation + handler.
- Cobalt Strike Beacon malleable profile generation.
- Loader skeletons + reverse shell cheatsheet (multi-platform).

## Mobile / game

- **Frida**: SSL pinning bypass + root detection hook, native offset hook libssl intercept, pattern search native helper.
- **Objection**: pattern search helper.
- **Xposed module**: signature-verification hook.
- **iOS**: Theos + xm hook writeup, kernelcache IPSW jtool2 walkthrough, macOS kext Hopper walkthrough.
- **Play Integrity / PIF USNF** study.
- **Game memory**: Cheat Engine AoB pointer chain, GG Lua helper RVA remap across bump, Unity native hook Dobby inline frame fix, UE4SS SDK dumper verified, IL2CPP dumpcs RVA extraction IDA pass.

## Malware analysis

- Cuckoo sandbox dynamic report pass.
- YARA rule pack APT-family writeup.
- Ransomware / stealer / RAT sample analysis notes, config extraction and C2 extraction.

## Cryptography / blockchain

- RSA Wiener challenge, crypto CTF series.
- Smart contract audit (on own target contracts).

## Cloud / K8s

- AWS IAM pacu privilege enum writeup, K8s pod hostPath escape writeup.
- Meterpreter internal-network pivot writeup.

## Hardware / IoT

- Firmware binwalk + squashfs extraction, eBPF prog dump xlated disassembly pass.

## Digital forensics

- Memory forensics Volatility, kprobe kernel-function trace writeup.
- WinDbg kdnet first-breakpoint setup.

## CTF

- PWN / RE / Crypto / Web / Misc / Blockchain / Forensics — all categories.
- Custom-VM-bytecode reverse challenge, heap fastbin dup libc229 challenge.
