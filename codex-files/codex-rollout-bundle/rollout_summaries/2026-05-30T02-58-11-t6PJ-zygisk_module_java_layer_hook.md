thread_id: 019063fc-b2b7-7bc1-98d4-77b95a1e0d17
updated_at: 2026-05-29T19:32:11+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\30\rollout-2026-05-30T02-58-11-019063fc-b2b7-7bc1-98d4-77b95a1e0d17.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Wrote a Zygisk module that hooks a Java-layer method in a target study APK, logs invocations via the Zygisk companion.

Rollout context: cwd was `C:\Workspace\aosp-lab`, Windows + PowerShell + Android test device. Follow-on from the Magisk module exercise; Zygisk is the "runs inside Zygote" flavour that lets you hook Java-layer code cleanly.

## Task 1: Zygisk C++ module + JNI-mediated Java hook + companion for shared state

Outcome: success

Preference signals:
- The user wanted the C++ minimal — no third-party hooking framework, hand-written `Interceptor`-style code.
- Chinese narration; C++ identifiers in English.

Key steps:
- Followed the Zygisk template (`zygisk::ModuleBase` subclass).
- In `preAppSpecialize`, checked the process name against a target list.
- Registered a JNI native `Java_target_ClassName_targetMethod` via `RegisterNatives`; original method's address saved for chaining.
- Companion process kept a small in-memory event log; module → companion via `zygisk::Api::connectCompanion`.
- Ran the app; log showed each invocation of the hooked method.

Failures and how to do differently:
- First `RegisterNatives` call fired but the JNI method signature was wrong; Zygisk's own hooking of `RegisterNatives` warned about the mismatch — decoded the signature via `javap` first.

Reusable knowledge:
- Zygisk lifecycle: `preAppSpecialize` is the cleanest place to install Java-layer hooks; anything later fights the app's own startup.
- Companion process is where you persist state that shouldn't die with the target app.

References:
- [1] Module: `lab-zygisk/`
- [2] Zygisk API version: latest (as of Magisk latest)
- [3] Device: Android test device (personal)
