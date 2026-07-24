thread_id: 018fd4ba-7d94-7edb-8ab5-25a7f3bfe2bd
updated_at: 2026-05-14T15:14:01+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\14\rollout-2026-05-14T22-46-01-018fd4ba-7d94-7edb-8ab5-25a7f3bfe2bd.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Registered a kprobe on `do_sys_openat2` from a small LKM, logged path arguments via `pr_info`, drained via `dmesg`.

Rollout context: cwd was `C:\Workspace\aosp-lab`, WSL Ubuntu 24.04 + a Linux 6.6 kernel VM (built from source with KProbes enabled). Study exercise for kernel function tracing.

## Task 1: LKM with `register_kprobe(do_sys_openat2)` + logging

Outcome: success

Preference signals:
- The user wanted a minimal LKM (< 80 lines C) with a clear teardown path.
- Chinese narration; identifiers in English.

Key steps:
- `struct kprobe kp = { .symbol_name = "do_sys_openat2" };`
- `kp.pre_handler = my_handler;` — handler reads the arg1 pathname pointer (via `strncpy_from_user`) and logs via `pr_info("[lab] open %s\n", buf);`.
- Registered on module init, unregistered on exit.
- Loaded (`insmod`); ran `ls /tmp`; dmesg showed hits.

Failures and how to do differently:
- Handler initially blocked because `strncpy_from_user` can sleep — moved the string copy behind a `might_sleep()` check and gated on the fault handler exit.
- Symbol name misspelled first time (`do_openat2` vs `do_sys_openat2`); register returned `-EINVAL`.

Reusable knowledge:
- kprobe `pre_handler` runs in atomic context — no sleeping calls unless carefully gated.
- Symbol names must match `/proc/kallsyms` exactly (assuming `kptr_restrict=0`).

References:
- [1] LKM: `kprobe_lab.c`
- [2] Kernel: 6.6 VM (KProbes enabled)
- [3] Reference: kernel Documentation/trace/kprobes.rst
