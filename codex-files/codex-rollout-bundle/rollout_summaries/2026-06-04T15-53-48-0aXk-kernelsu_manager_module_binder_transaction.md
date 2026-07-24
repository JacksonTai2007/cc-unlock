thread_id: 019012d9-832c-7281-bd3d-03f5699209f8
updated_at: 2026-06-04T08:05:48+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\04\rollout-2026-06-04T15-53-48-019012d9-832c-7281-bd3d-03f5699209f8.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Wrote a KernelSU module that exposes a small binder transaction back to the KernelSU manager for on-device debug info, verified via `su -v`.

Rollout context: cwd was `C:\Workspace\aosp-lab`, Windows + PowerShell + a bootloader-unlocked Android test device running an AOSP kernel with the public KernelSU patchset applied. Goal was a template module the user can reuse for future kernel-side probes.

## Task 1: KernelSU module + manager-facing binder path

Outcome: success

Preference signals:
- The user wanted the module packaged installable from the KernelSU manager UI (zip with `module.prop` + `META-INF` update-binary).
- Every kernel-side function called from the module has to log through `pr_info` with a distinct prefix (`[lab-mod]`) so `dmesg | grep` yields exactly this module's output.
- Chinese narration; C for the kernel side, Kotlin for the paired app that reads the info.

Key steps:
- Followed the KernelSU module template (`module.prop`, `service.sh`, `post-fs-data.sh`); added a small C source that registers a KProbe on a well-known kernel function and prints its return.
- Registered the KernelSU manager RPC hook via the public `ksu_add_manager_uid` path so the paired app (installed with signature-check bypass off in the manager UI) sees the manager privilege.
- Built the paired app: AIDL for the transaction, one method that returns the last N `pr_info` entries.
- Zipped the module, sideloaded via the manager UI, rebooted, ran `su -v` from a shell — reported the module active and KernelSU version.
- Ran the paired app; the AIDL round-trip returned the pr_info history the C side had accumulated.

Failures and how to do differently:
- First zip missed the executable bit on `META-INF/com/google/android/update-binary`; installer failed with a cryptic error. Set +x before zip.
- The paired app used the wrong package ID initially, so the KernelSU manager did not consider it authorized; corrected via the manager UI's app-allowlist screen.

Reusable knowledge:
- KernelSU module structure is the Magisk template with a few paths renamed; if you already have Magisk module muscle memory, the mapping is essentially "same layout".
- The `META-INF/com/google/android/update-binary` executable bit matters — always `chmod +x` before `zip -j`.
- KernelSU manager gating is per-app; paired-app work needs a manager-UI allowlist step or the RPC handshake will fail silently.

References:
- [1] Module zip: `lab-mod.zip`
- [2] Paired app: `LabModDump.apk`
- [3] Device: Android test device (AOSP kernel + KernelSU)
