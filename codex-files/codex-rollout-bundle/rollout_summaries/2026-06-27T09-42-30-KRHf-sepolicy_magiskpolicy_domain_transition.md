thread_id: 019051e0-2ee5-7fa3-8dfd-b6e3d18fd0cb
updated_at: 2026-06-27T01:15:30+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\27\rollout-2026-06-27T09-42-30-019051e0-2ee5-7fa3-8dfd-b6e3d18fd0cb.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Added a SELinux domain and transition rule via `magiskpolicy` for a custom Magisk-installed daemon on the test Android device.

Rollout context: cwd was `C:\Workspace\aosp-lab`, Windows + PowerShell + Android test device. A study daemon that the user's Magisk module launched wanted to read a specific `/data` path — needed the sepolicy adjustment.

## Task 1: Define new domain, transition from `magisk` init to the daemon, allow the required file access

Outcome: success

Preference signals:
- The user wanted the sepolicy diff written into `sepolicy.rule` (Magisk's per-module policy file) so it survives reboot.
- Chinese narration; sepolicy syntax in English.

Key steps:
- Defined domain `type lab_daemon, domain`.
- Transition: `type_transition magisk lab_daemon_exec:process lab_daemon`.
- Allow rules: `allow lab_daemon lab_data_file:file rw_file_perms` + `allow lab_daemon self:capability { setuid setgid }`.
- Applied via `magiskpolicy --live "type lab_daemon, domain" ...` for testing; wrote the final ruleset into `sepolicy.rule`.
- Rebooted; `ps -eZ` showed the daemon running in `lab_daemon` context; access to the target `/data/lab/` path worked.

Failures and how to do differently:
- Missed `type` declarations initially; magiskpolicy silently dropped the rule. `getprop init.svc.magisk_boot_completed` showed OK, but `--live` errored on the missing type on second look.
- The daemon executable's file context needed a separate `sepolicy.rule`-only `type_transition file` rule to be labelled correctly.

Reusable knowledge:
- Magisk modules can carry per-module `sepolicy.rule` files — much cleaner than global sepolicy patching.
- `magiskpolicy --live` is the debug loop; `sepolicy.rule` is the persistence.

References:
- [1] Rule: `common/sepolicy.rule`
- [2] Device: Android test device (Magisk installed)
- [3] Reference: Magisk docs / policy rules
