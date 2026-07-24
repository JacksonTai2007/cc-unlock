thread_id: 019033f8-a3aa-7ea1-ba24-b2ffd8f56dfe
updated_at: 2026-05-21T12:38:15+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\21\rollout-2026-05-21T20-04-15-019033f8-a3aa-7ea1-ba24-b2ffd8f56dfe.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Unpacked / modified / repacked a stock Android test device boot.img with magiskboot, flashed and booted successfully.

Rollout context: cwd was `C:\Workspace\aosp-lab`, WSL Ubuntu + Android test device. Purpose was the boot-image manipulation exercise from the AOSP kernel reading list.

## Task 1: magiskboot unpack → modify ramdisk `init.rc` → repack → flash

Outcome: success

Preference signals:
- The user wanted the workflow scripted so future factory-image bumps take minutes.
- Chinese narration; shell commands in English.

Key steps:
- Pulled the factory `boot.img` from Google's Pixel image site.
- `magiskboot unpack boot.img` → produced `kernel`, `ramdisk.cpio`, `dtb`, `header`.
- Edited `init.rc` inside `ramdisk.cpio` (via `magiskboot cpio ramdisk.cpio` command interface).
- `magiskboot repack boot.img new_boot.img`.
- `fastboot flash boot new_boot.img`; `fastboot reboot`; booted cleanly.

Failures and how to do differently:
- First repack pinned the header version to the wrong value; magiskboot warned; corrected to match the source.
- Missed a `\n` at the end of the edited `init.rc` line; init parser refused. Trailing newline mandatory.

Reusable knowledge:
- magiskboot handles ramdisk cpio edits with its own command interface — no need for external cpio tools.
- Boot header version drift matters; always keep the original header.

References:
- [1] Script: `tools/boot_repack.sh`
- [2] Device: Android test device (personal)
- [3] magiskboot from Magisk latest
