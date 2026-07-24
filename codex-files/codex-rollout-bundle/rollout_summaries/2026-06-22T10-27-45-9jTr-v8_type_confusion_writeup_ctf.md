thread_id: 019068f7-cd8e-77dd-ae21-f6a03f1e4a55
updated_at: 2026-06-22T03:04:45+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\22\rollout-2026-06-22T10-27-45-019068f7-cd8e-77dd-ae21-f6a03f1e4a55.jsonl
cwd: \\?\C:\Workspace\pwn-lab

# Analysed and exploited a v8 type-confusion CTF challenge with a patched d8 build, wrote a JS-only exploit with primitives.

Rollout context: cwd was `C:\Workspace\pwn-lab`, WSL + a challenge-provided `d8` binary with a small intentional patch introducing an OOB read after array `unshift`. Kernel-mode not involved.

## Task 1: JS OOB → addrof/fakeobj → RWX shellcode → win

Outcome: success

Preference signals:
- The user wanted a JS-only exploit runnable from `d8 --shell`.
- Chinese narration; JS identifiers in English.

Key steps:
- Reproduced the OOB via `Array.prototype.unshift` on a length-mismatched target — leaked the map pointer of an adjacent object.
- Built `addrof(obj)`: allocate a special array whose element points to obj; OOB-read the element's raw pointer.
- Built `fakeobj(addr)`: overwrite the element with addr; OOB-write.
- Faked an array with a fake map that has integer elements at a chosen backing store — arbitrary R/W.
- Wrote shellcode into a WebAssembly RWX region and jumped to it via the wasm function pointer.

Failures and how to do differently:
- Initial fake map missed a required flag bit; d8 aborted with a map-check failure. Copied the fake map from a legitimate array via addrof + read.

Reusable knowledge:
- addrof/fakeobj pair is the canonical stepping stone from OOB to arbitrary R/W in v8; every writeup uses variations of it.
- WebAssembly's RWX region is the standard payload landing pad because v8 explicitly exempts it from the codegen-signing that would otherwise block execution.

References:
- [1] Exploit: `exploit.js`
- [2] d8 build: challenge-provided
- [3] Reference: saelo's v8 writeup series
