thread_id: 019052d1-11ba-7ecf-bee0-ab8f27714a35
updated_at: 2026-06-14T03:00:28+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\14\rollout-2026-06-14T10-19-28-019052d1-11ba-7ecf-bee0-ab8f27714a35.jsonl
cwd: \\?\C:\Workspace\mobile-re-lab

# Wrote a Frida native-offset hook against `libssl.so`'s `SSL_read`/`SSL_write` in a study APK, dumped plaintext traffic to a log.

Rollout context: cwd was `C:\Workspace\mobile-re-lab`, Windows + PowerShell + bootloader-unlocked Pixel test device. Target APK bundled BoringSSL statically; no export names for `SSL_read`/`SSL_write`, so offset-based hooking was required.

## Task 1: Locate `SSL_read`/`SSL_write` by pattern, hook them via Frida `Interceptor.attach`

Outcome: success

Preference signals:
- The user wanted a single `.js` script — no companion loader.
- Chinese narration; JS identifiers in English.

Key steps:
- Enumerated `Module.enumerateSymbols` — confirmed the symbols were stripped.
- Ran a byte-pattern scan (`Memory.scanSync`) using the known BoringSSL prologue for `SSL_read`/`SSL_write` on arm64 (stable across the last several BoringSSL releases).
- Attached `Interceptor.attach` at the discovered offsets; on entry, read the buffer + length; on leave, log the plaintext hex.
- Confirmed on a login flow — the JSON payload appeared plaintext in `frida` stdout.

Failures and how to do differently:
- First scan matched a false positive from a similar-looking codegen block; added a "length is small ELF-consistent" filter to the pattern match.
- Initial buffer dump used ASCII; binary payloads printed garbage. Switched to hex dump with an ASCII sidecar.

Reusable knowledge:
- Pattern-based hooking for statically-linked BoringSSL is stable — the prologue changes rarely; keep the pattern in a template file.
- Always print buffers as hex-plus-ASCII for TLS payload dumps; the mix of binary framing + JSON is unreadable in either form alone.

References:
- [1] Hook: `hook.js`
- [2] Pattern reference: BoringSSL 20240310 aarch64 prologue
- [3] Test device: Android test device (personal)
