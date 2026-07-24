thread_id: 019064b2-6bce-7841-b3d1-6feb6c8ee3fb
updated_at: 2026-06-27T13:59:38+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\27\rollout-2026-06-27T21-19-38-019064b2-6bce-7841-b3d1-6feb6c8ee3fb.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Cross-compiled a Linux LKM for arm64 targeting an AOSP kernel, loaded on the Android test device with matching kernel headers.

Rollout context: cwd was `C:\Workspace\aosp-lab`, WSL Ubuntu + Android test device (running the AOSP build kernel from the KernelSU exercise). Purpose was a reusable Makefile template.

## Task 1: Reusable Makefile that builds LKM against AOSP kernel tree for arm64

Outcome: success

Preference signals:
- The user wanted the Makefile to accept `KERNEL_DIR=` and `CROSS_COMPILE=` at command line so future kernels swap easily.
- Chinese narration; make identifiers in English.

Key steps:
- Standard kbuild `obj-m += lab_mod.o` in the module Makefile.
- Top-level Makefile: `make -C $(KERNEL_DIR) M=$(shell pwd) ARCH=arm64 CROSS_COMPILE=$(CROSS_COMPILE)`.
- Set defaults: `KERNEL_DIR ?= ~/aosp-kernel-lab`, `CROSS_COMPILE ?= aarch64-linux-android-`.
- Built; `adb push lab_mod.ko`; `adb shell insmod` succeeded (KernelSU su present).

Failures and how to do differently:
- First build failed with `Module.symvers not found`; ran a preliminary `make modules_prepare` in the kernel tree.
- Toolchain mismatch: the AOSP kernel was built with Clang but I tried gcc for the module. Switched to Clang via `LLVM=1`.

Reusable knowledge:
- AOSP kernels are typically Clang-built; module builds must match with `LLVM=1` or you get subtle CFI issues at load.
- `make modules_prepare` on the kernel tree is a required one-time step before out-of-tree module builds.

References:
- [1] Makefile: `Makefile`, `Kbuild`
- [2] Kernel tree: local AOSP checkout matching Android test device build
- [3] Toolchain: Clang from AOSP prebuilts
