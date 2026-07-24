thread_id: 01901a3d-fced-714a-a3eb-9606189bab8d
updated_at: 2026-06-25T03:24:30+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\25\rollout-2026-06-25T11-00-30-01901a3d-fced-714a-a3eb-9606189bab8d.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Reproduced CVE-2022-0847 (Dirty Pipe) on a downgraded Android device kernel image, wrote to a read-only file, confirmed the technique.

Rollout context: cwd was `C:\Workspace\aosp-lab`, Windows + PowerShell + a bootloader-unlocked Android test device flashed with an AOSP kernel at 5.10.107 with the Dirty Pipe patch reverted for reproducibility (the 5.10 fix landed in 5.10.102). Purpose was the public Dirty Pipe reproducibility exercise from Max Kellermann's disclosure writeup.

## Task 1: Reproduce Dirty Pipe on a downgraded kernel, write to a root-owned read-only file

Outcome: success

Preference signals:
- The user wanted a walk that matches Kellermann's original PoC almost line-for-line, so the writeup is a study aid rather than a rewrite.
- No dependency on any private tool; only public compilers + adb.
- Chinese narration; C source verbatim from the disclosure.

Key steps:
- Confirmed the downgrade actually took (`uname -r` = 5.10.107) and that the target file (`/system/etc/passwd`-analogue in this lab image) was root:root and mode 0644.
- Cross-compiled the exact `dirty_pipe.c` from the disclosure using NDK's clang for `aarch64-linux-android`.
- `adb push` + `chmod +x` + ran with target-file arg and content-string arg.
- Verified from a separate `adb shell cat` that the target file's contents were changed despite the file being non-writable for the process.
- Wrote up the primitives table: (1) allocate pipe; (2) drain flags via a splice; (3) splice from target file to prime `PIPE_BUF_FLAG_CAN_MERGE`; (4) write to pipe to overwrite the target's page-cache backing.

Failures and how to do differently:
- First cross-compilation used `--target=aarch64` without the API level; ended up with a binary that segfaulted on Android bionic. Added `--target=aarch64-linux-android30`.
- Initially picked a target file whose page cache had not been read yet; splice returned nothing. Warmed the cache with a `cat > /dev/null` first.

Reusable knowledge:
- Dirty Pipe (CVE-2022-0847): fixed in 5.16.11, 5.15.25, 5.10.102. The bug is a missing zeroing of `pipe_buffer.flags` on allocation. Downgraded lab kernels are the standard reproduction environment.
- For any splice-based primitive, the target file's page cache must exist before splice — a cold cache silently defeats the technique.
- Prefer `--target=aarch64-linux-androidNN` with the NDK API level for anything intended to run under bionic.

References:
- [1] Public PoC: `dirty_pipe.c` (Max Kellermann's disclosure)
- [2] Kernel: 5.10.107 (deliberately downgraded)
- [3] Device: Android test device (bootloader-unlocked)
