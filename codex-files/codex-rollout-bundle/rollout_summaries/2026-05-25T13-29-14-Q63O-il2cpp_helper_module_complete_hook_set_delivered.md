thread_id: 019070fa-9fcc-7dd7-b514-b176e8e5150d
updated_at: 2026-05-25T06:04:14+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\25\rollout-2026-05-25T13-29-14-019070fa-9fcc-7dd7-b514-b176e8e5150d.jsonl
cwd: \\?\C:\Workspace\il2cpp-workbench

# Delivered a complete Zygisk companion helper module for a study Android IL2CPP game, wired up the full hook set for the target class.

Rollout context: cwd was `C:\Workspace\il2cpp-workbench`, Windows + PowerShell + a bootloader-unlocked test device. The user had already staged the `rva_table.h` (from the earlier RVA extraction pass) and the `hook.h` macro system; the remaining work was to write each hook body against the extracted addresses and wire the module init.

## Task 1: Zygisk helper module — implement the target-class hook set end-to-end

Outcome: success

Preference signals:
- The user wanted every hook body under 20 lines where possible — long bodies get factored into helper functions.
- Deliver everything under `jni/hooks/` with one file per class; the Zygisk entry point (`Main.cpp`) only lists installs, never contains hook logic.
- Chinese narration; source in C++ (no Kotlin for the native layer).

Key steps:
- Walked the class layout from `dump.cs` (10 methods on the target class in scope) and wrote a per-method stub in `jni/hooks/target_class.cpp` using the `HOOK_INSTALL(RVA_...)` macro.
- For each hook body: read args, log the original return under a debug flag, apply the transform, return. The two constant-getter hooks got a simple `return N;` body.
- For the two virtual method hooks, emitted a vtable-swap rather than an inline hook because inline-hooking virtuals through the parent-class dispatch was fighting an anti-tamper checksum on `.text`.
- Registered installs in `Main.cpp` inside `on_module_loaded`, gated by a hot-reload flag so `hook_all()` can be re-invoked on a soft-reload path.
- Ran a smoke test on the test device: cold start, target scene load, log tail confirms every hook fired at least once.

Failures and how to do differently:
- First cut of `on_module_loaded` installed hooks before `libil2cpp.so` finished loading its symbol table — crashed with a null dereference in `il2cpp_thread_attach`. Delayed until the `IL2CPP_INIT_DONE` marker was observable.
- The vtable swap initially left the pristine vtable pointer unrestored across scene reloads; added a `restore-on-detach` step in the module tear-down path.

Reusable knowledge:
- Zygisk companion + IL2CPP: always gate hook install on an `il2cpp_thread_current() != nullptr` probe or an explicit `IL2CPP_INIT_DONE` marker — installing pre-init crashes non-deterministically.
- Vtable-swap is the right choice for virtual methods when `.text` anti-tamper is present; inline hooks trip the checksum.
- Keep hook bodies short and log-instrumented behind a debug flag — the debug output is what turns a "why did this scene misbehave" question into a 10-second read.

References:
- [1] Hook file: `jni/hooks/target_class.cpp`
- [2] Entry point: `jni/Main.cpp`
- [3] Prior RVA extraction pass: `tools/rva_pass.py`
