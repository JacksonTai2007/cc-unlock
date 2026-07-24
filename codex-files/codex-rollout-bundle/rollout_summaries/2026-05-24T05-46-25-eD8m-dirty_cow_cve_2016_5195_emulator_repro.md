thread_id: 01905b12-19b8-70ff-9fb0-93e7ad5f38ad
updated_at: 2026-05-23T22:18:25+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\24\rollout-2026-05-24T05-46-25-01905b12-19b8-70ff-9fb0-93e7ad5f38ad.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Reproduced Dirty COW (CVE-2016-5195) inside a Buildroot VM with a 4.4 kernel, wrote to a root-owned file as non-root.

Rollout context: cwd was `C:\Workspace\aosp-lab`, QEMU + Buildroot + 4.4 kernel. Purpose was the classic Dirty COW reading-list reproduction alongside the Dirty Pipe exercise.

## Task 1: Dirty COW race → overwrite a read-only file

Outcome: success

Preference signals:
- The user wanted the exact public PoC from Phil Oester's disclosure repo, no rewrites.
- Chinese narration; C identifiers in English.

Key steps:
- Downloaded `dirtyc0w.c` from the public exploit-db mirror.
- Cross-compiled with the VM's toolchain.
- Ran with `./dirtyc0w /root/read_only.txt "overwritten"`.
- Verified from a root shell that the file contents changed while still owned root:root and mode 0644.

Failures and how to do differently:
- The 4.4 kernel had the CoW fix backported in some distros; verified the Buildroot config had it disabled for reproducibility.
- Race timing depended on thread count; 200 rounds converged; less was flaky.

Reusable knowledge:
- Dirty COW (CVE-2016-5195): a race between MADV_DONTNEED and CoW breaking; kernel 4.4 patch upstream was 4.9-rc1. Backports vary.
- Race exploits need reproducible timing; use fixed iteration counts, not "until it works".

References:
- [1] PoC: `dirtyc0w.c` (Phil Oester)
- [2] Kernel: 4.4 Buildroot VM
- [3] Reference: exploit-db 40611
