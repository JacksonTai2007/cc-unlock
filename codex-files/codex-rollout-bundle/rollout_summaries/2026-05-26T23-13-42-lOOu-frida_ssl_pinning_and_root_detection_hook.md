thread_id: 01903881-d025-71e8-95b7-9963e7f39354
updated_at: 2026-05-26T15:45:42+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\26\rollout-2026-05-26T23-13-42-01903881-d025-71e8-95b7-9963e7f39354.jsonl
cwd: \\?\C:\Workspace\mobile-re-lab

# Delivered a Frida script for a study APK covering SSL pinning + root/Magisk detection in one attach.

Rollout context: cwd was `C:\Workspace\mobile-re-lab`, Windows + PowerShell + a bootloader-unlocked Android test device on adb. The study APK used OkHttp3 pinning plus its own file/prop-based root check. The user wanted a single-file Frida script that could be reused across the two child APKs in the same study repo.

## Task 1: Frida hook script covering SSL pinning + root detection

Outcome: success

Preference signals:
- One `.js` file loaded via `frida -U -f pkg -l hook.js --no-pause`, not a modular loader.
- Chinese-preferred narration; identifiers in English.
- The user prefers hooks to fail loud (`console.warn`) rather than silently no-op when a symbol is missing at attach time, so version drift is caught early.

Key steps:
- Enumerated app classes with `Java.enumerateLoadedClasses` to confirm the OkHttp version (4.11 in this build).
- Replaced `okhttp3.CertificatePinner.check` overload `(String, List)` with a no-op returning normally; also handled the legacy `check(String, Certificate...)` signature for safety.
- Neutralised the app's `SecurityChecker.isRooted` by rewriting the return-boolean path to `false`, and stubbed `SafetyNetHelper.attest` to hand back the "compliant" JWT shape the app expected.
- Added a wildcard `System.getProperty` hook that returned empty for the specific `ro.debuggable`/`ro.build.tags` props the checker touched, without changing anything else.
- Wrapped everything in `Java.perform`, plus a `Module.enumerateExports('libssl.so').forEach(...)` diagnostic that logged `SSL_read`/`SSL_write` addresses once for later native inspection.

Failures and how to do differently:
- First attempt broke the app on cold start because the check ran inside `<clinit>` before `Java.perform` was ready. Moved to a delayed hook using `setImmediate` and gated on a class-loaded probe.
- The initial `SecurityChecker` hook missed a Kotlin `object` companion; `Java.use("...$Companion")` handled it after that.

Reusable knowledge:
- OkHttp3 4.x pinning path is worth confirming with `enumerateLoadedClasses` because 4.10 -> 4.12 shuffled a helper class name.
- For `<clinit>`-early checks, delaying via `setImmediate` inside `Java.perform` is enough on most devices; a Zygisk companion is only needed when the check runs pre-Zygote.
- Keeping the diagnostic export dump inside the same script means you always have `SSL_read` addresses handy without a second attach.

References:
- [1] Hook script: `hook.js`
- [2] Attach command: `frida -U -f com.example.target -l hook.js --no-pause`
- [3] Test device: bootloader-unlocked Android test device, Android modern release, Magisk latest
