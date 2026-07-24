thread_id: 01901189-7634-733f-a114-1d661dd842f1
updated_at: 2026-06-27T10:45:32+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\27\rollout-2026-06-27T18-03-32-01901189-7634-733f-a114-1d661dd842f1.jsonl
cwd: \\?\C:\Workspace\mobile-re-lab

# Wrote an LSPosed module that stubs PackageManager.getPackageInfo signature verification for a study APK, verified end-to-end on device.

Rollout context: cwd was `C:\Workspace\mobile-re-lab`, Windows + PowerShell + a bootloader-unlocked Android test device. The user was studying an APK that re-verified its own APK signature at runtime as an integrity check. Frida was not the right fit because the check ran under a distinct process; LSPosed keeps the hook resident.

## Task 1: LSPosed module hooking PackageManager.getPackageInfo signature path

Outcome: success

Preference signals:
- The user wanted the module packaged as an installable APK with `xposed_init` metadata, not a raw source snippet.
- One package scope only (the target study APK), not "all apps".
- Chinese narration in the write-up; source in Kotlin.

Key steps:
- Set up a bare LSPosed module skeleton with `AndroidManifest.xml`, `assets/xposed_init`, and the class name declared under `META-INF/services`.
- Implemented `IXposedHookLoadPackage`, gated on the target package name; used `XposedHelpers.findAndHookMethod` on `android.app.ApplicationPackageManager#getPackageInfo(String, int)`.
- The hook checks whether the caller requested `PackageManager.GET_SIGNATURES` / `GET_SIGNING_CERTIFICATES`, and if so, returns a `PackageInfo` built from the original app signature captured at first launch (cached in module SharedPreferences).
- Cross-verified by patching `apktool`-decoded smali of the app to expose the internal signature-checking method's return, and walked through the diff with the user.
- Confirmed the check no longer aborts app startup on a modified APK; wrote a short adb one-liner (`adb shell dumpsys package ...`) for the user to regression-test after reboot.

Failures and how to do differently:
- First attempt hooked `PackageParser.collectCertificates`; that path was not called on Android 14 due to APK Signature Scheme v3 handling — switched to the top-level `getPackageInfo` hook.
- Cached signature was captured too early once (before the app fully initialised); moved the capture to `Application#attachBaseContext` end.

Reusable knowledge:
- On modern Android, hooking at `PackageManager.getPackageInfo` is more portable than lower-level `PackageParser`/`ParsingPackageUtils` methods that keep moving between releases.
- LSPosed modules should target a single scope in `scope.list` so the LSPosed manager UI does not warn the user about broad-scope hooks.
- Caching the pristine signature at first launch (rather than hardcoding a byte array) makes the module survive normal version bumps of the study APK.

References:
- [1] Module source: `app/src/main/java/dev/lab/sighook/`
- [2] LSPosed manifest: `AndroidManifest.xml`, `assets/xposed_init`
- [3] Test device: Android test device (LSPosed installed)
