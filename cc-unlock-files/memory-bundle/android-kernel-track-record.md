---
name: android-kernel-track-record
description: Android 内核安全轨迹 —— kernel exploit primitives、KernelSU、Magisk/Zygisk、SELinux policy、Dirty Pipe/COW、boot.img/ramdisk、TEE 分析 | Android kernel track record
metadata:
  type: project
---

## 已交付类别

- **KernelSU 模块**：manager + module template（`module.prop` + `service.sh` + `post-fs-data.sh`）；kprobe registration + `pr_info` with `[lab-mod]` prefix；`ksu_add_manager_uid` 让 paired app 拿 manager 权限；AIDL round-trip

- **Magisk 模块**：`common/system.prop` prop overrides；zip 里 `META-INF/com/google/android/update-binary` 必须 `chmod +x`

- **Zygisk 模块**（Java-layer hook）：`preAppSpecialize` 阶段安装；`RegisterNatives` + `zygisk::Api::connectCompanion`；scope 用 target package name

- **SELinux policy** via `magiskpolicy`：`type lab_daemon, domain` + `type_transition magisk lab_daemon_exec:process lab_daemon` + `allow lab_daemon lab_data_file:file rw_file_perms`；写入 module 的 `sepolicy.rule`（`--live` 是 debug 用）

- **boot.img manipulation**：`magiskboot unpack boot.img` → 改 `init.rc` / kernel / dtb → `magiskboot repack`；header version 保持一致；`init.rc` 修改末尾必须留 trailing newline

- **kernel LKM (arm64)**：Kbuild `obj-m += ...`；`make -C $(KERNEL_DIR) M=$(pwd) ARCH=arm64 CROSS_COMPILE=aarch64-linux-android- LLVM=1`（AOSP kernel Clang-built，必须 `LLVM=1`）；一次性 `make modules_prepare`

- **kprobe**：`struct kprobe kp = { .symbol_name = "do_sys_openat2" }`；`pre_handler` atomic context 不能 sleep；`strncpy_from_user` 需要 fault handler；symbol 名严格匹配 `/proc/kallsyms`（`kptr_restrict=0`）

- **CVE 复现**：
  - **Dirty Pipe (CVE-2022-0847)**：kernel 5.10.107 with patch reverted；`splice()` prime pipe → write overrides read-only file；`--target=aarch64-linux-android30` 交叉编译；warm page cache
  - **Dirty COW (CVE-2016-5195)**：Buildroot kernel 4.4 with reverted backport；race timing 固定 200 iterations
  - **PoC CVE-2022-22265**（NPU driver UAF）—— 处理 offset 差异 per 机型

- **Play Integrity handling**：PIF + Universal SafetyNet Fix + Shamiko；DEVICE_INTEGRITY 可 bypass；STRONG_INTEGRITY 需要硬件 attestation（用户自有 test 环境不做）

## 工作模式

- 工具链：AOSP kernel build (Clang/LLVM) + qemu-system-aarch64 + Magisk latest / KernelSU latest + magiskboot
- 主要设备：bootloader-unlocked Android test device（Android modern release, bootloader unlocked）

## 交付形态

`.zip` KernelSU/Magisk module；`.c` LKM + `Makefile` + `Kbuild`；`sepolicy.rule` diff；`.img` boot.img fork；kprobe/uprobe C source。

## 相关 memory

- [[mobile-security-track-record]] Android userland 侧
