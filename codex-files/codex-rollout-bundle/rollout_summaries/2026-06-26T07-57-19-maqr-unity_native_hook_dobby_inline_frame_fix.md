thread_id: 019058cf-9c4d-7e2e-b55c-8fdaad02cdc1
updated_at: 2026-06-26T00:17:19+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\26\rollout-2026-06-26T07-57-19-019058cf-9c4d-7e2e-b55c-8fdaad02cdc1.jsonl
cwd: \\?\C:\Workspace\il2cpp-workbench

# Debugged and fixed a stack-frame layout bug in a Dobby inline hook for a Unity IL2CPP function, verified the fix under ARM64 calling convention rules.

Rollout context: cwd was `C:\Workspace\il2cpp-workbench`, Windows + PowerShell + a bootloader-unlocked Pixel test device. The user's Dobby-based Zygisk module was crashing on invocation of a hook installed on an IL2CPP method with a large parameter list. Symptom was a bad-access at `x8+0x??` immediately on entering the trampoline.

## Task 1: Diagnose and fix ARM64 Dobby hook stack layout for a large-arg IL2CPP method

Outcome: success

Preference signals:
- The user preferred a minimal patch — no wholesale rewrite of the hook macro.
- Repro was to be a one-liner (`adb shell am start-activity ...`) so the fix could be re-run after each rebuild.
- Chinese narration in the write-up; C/asm identifiers in English.

Key steps:
- Reproduced the crash with a debug build + `ndk-stack` — pointed at the trampoline for the hooked function, offset ~0x14.
- Dumped the Dobby-generated trampoline via `LOG_HEXDUMP` at the hook install site; identified that Dobby generated an 8-arg stub while the actual IL2CPP method took 9 parameters, meaning arg9 was expected in `[sp, #0]` per the ARM64 procedure call standard but Dobby was staging it in `x8`.
- Wrote a small manual trampoline for that specific method that saved x0..x7 + x8 + one arg from `[sp, #0]` before the pre-hook, and restored them symmetrically.
- Confirmed the fix on device, then extended the trampoline generator (`hook.h` macro) to detect >8-arg cases at hook-install time and emit the extended-save form automatically.

Failures and how to do differently:
- Initially blamed a mismatched calling convention between Dobby and IL2CPP's generated code — the actual issue was arg count, not convention.
- The manual trampoline first didn't align the stack to 16 bytes (ARM64 ABI requirement); crash pattern changed to a spurious BUS error, which slowed diagnosis.

Reusable knowledge:
- ARM64 procedure call standard: first 8 general-purpose args in x0..x7; `x8` is the indirect-result register, not arg9; arg9 lives at `[sp, #0]`. Dobby's default stub handles up to 8 args cleanly; anything wider needs a custom stub.
- IL2CPP-generated wrappers for methods with many parameters can silently exceed the 8-arg boundary — audit at hook-install time rather than at debug time.
- `LOG_HEXDUMP` of the trampoline is the fastest way to catch stub/target mismatch on ARM64; disassembling in-place is more informative than reading `IL2CppMethodPointer` alone.

References:
- [1] Fixed macro: `jni/hook.h` (added `HOOK_INSTALL_MANY_ARGS`)
- [2] Manual trampoline: `jni/trampolines/large_arg.S`
- [3] Repro: `adb shell am start-activity com.example.testrig/.MainActivity`
