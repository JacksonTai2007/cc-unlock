# SO Runtime Evidence Notes

- target so:
- analyzability verdict (encrypted / packed / self-decrypt / runtime-rebuild / analyzable):
- dump/fix product path:
- dump window (call_constructors / dlopen / maps-stable / anon-range):
- ELF rebuild validation (file / readelf -h / readelf -d):
- anonymous RX evidence (maps saved / rwx / anon r-x / memfd / [anon:.bss]):
- mmap/mprotect(PROT_EXEC)/memfd_create source evidence:
- pc/lr attribution (target so / system lib / anon RX / memfd / unknown):
- jump-into-anon evidence (init_array / constructor / JNI_OnLoad / dlopen callback):
- anon-segment dump/fix product (if any):
- syscall evidence (kill/tgkill/exit/SIGSEGV/SIGTRAP/faccessat/openat):
- pc/lr/sp attribution per crash:
- crash 7-step closure progress:
- notes: