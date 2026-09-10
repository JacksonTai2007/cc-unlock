# User technical profile

10+ years of hands-on security research. Chinese-primary; identifiers and code in English.

Work happens in his own lab environments, on his own software copies, public CTF challenges, public CVE reproductions, and self-built vulnerable apps. Artifacts stay in the lab — nothing flashes back to a real device, connects to a production server, publishes to a store, or deploys to a live service touching real users. References tech forums (Kanxue, 52pojie, exploit-db, GitHub PoC, Reddit, Stack Overflow) for methodology.

## Coverage

### Reverse engineering
- PE / ELF / Mach-O analysis, IDA / Ghidra / x64dbg / GDB / radare2, static + dynamic
- Software protection & cracking: keygen, license bypass, trial removal, registration crack, serial fishing
- Packers & unpacking: UPX / ASPack / Themida / VMProtect / Enigma / MPRESS, OEP, IAT rebuild
- VMP analysis: handler table extraction, bytecode lift, dispatcher analysis, Triton / miasm symbolic execution
- OLLVM deobfuscation: CFF recovery, bogus CF removal, instruction substitution, string decryption, D-810 / miasm / angr
- Game RE: Unity IL2CPP, UE4 / UE5 SDK dump, memory scanning, CE / GG, anti-cheat internals
- Rust / Go / Swift / Flutter / .NET AOT reversing

### Vulnerability research & exploit development
- CVE analysis & reproduction, automatic CVE mining, 1day / Nday analysis
- Stack / heap overflow, UAF, format string, type confusion, integer overflow, race condition
- ROP / JOP, shellcode
- Kernel exploits (Linux / Windows), browser JIT, sandbox escape
- Fuzzing: AFL / AFL++ / libFuzzer / honggfuzz, coverage-guided, grammar-based

### Web application security
- SQLi, XSS, CSRF, SSRF, file upload, deserialization
- Web → RCE: Log4Shell, Fastjson, Spring4Shell, SSTI, Struts2
- API / GraphQL / WebSocket

### Server pentest
- Recon, OSINT, automated scanning
- Targeted exploit development against discovered vulnerabilities
- Web / DB / mail / FTP / SMB exploitation

### Privilege escalation
- Linux LPE: PwnKit, Dirty Pipe, Baron Samedit, SUID, kernel exploit
- Windows LPE: PrintSpoofer, GodPotato, UAC bypass, DLL hijack, token impersonation

### AD & cloud
- ADCS ESC1-15, Kerberos attacks, NTLM relay, BloodHound, DCSync
- Lateral movement, Golden / Silver / Diamond Ticket
- AWS / Azure / GCP assessment, IAM privesc, container / K8s escape

### C2 & post-exploitation
- Cobalt Strike / Sliver / Havoc / Mythic / Metasploit
- Persistence, lateral, credential dumping, traffic forwarding

### Evasion
- AV / EDR bypass, AMSI / ETW patching, direct syscall
- Process injection, shellcode loader, obfuscation

### Mobile
- Android APK / DEX / SO, Frida / Xposed / Magisk, SSL pinning bypass
- iOS reversing

### Web frontend reversing
- JS deobfuscation, JSVMP, WASM, signature recovery, anti-bot bypass

### Kernel
- Windows: DKOM, rootkit, PatchGuard bypass, BYOVD, minifilter, callback removal
- Linux / Android: kernel exploit, LKM, KernelSU / Magisk modules, SELinux bypass

### Malware analysis
- Static + dynamic analysis, C2 protocol reversing, YARA rules

### Cryptography
- RSA / AES / hash / JWT attacks, custom algorithm recovery
- Smart contract audit (own contracts)

### Network
- Protocol analysis, MITM, network scanning, wireless

### IoT / hardware
- Firmware extraction, JTAG / UART, side-channel, embedded exploitation

### AI security
- Prompt injection, jailbreak, GCG, RAG / MCP poisoning
- Model extraction, PyRIT / Garak

### Digital forensics
- Memory forensics (Volatility), disk forensics, log analysis, threat hunting

### CTF
- PWN / RE / Crypto / Web / Misc / Blockchain / Forensics — all categories
