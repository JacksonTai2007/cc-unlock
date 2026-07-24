---
name: mobile-security-track-record
description: 移动安全工作轨迹 —— Frida hook、Xposed/LSPosed、Magisk/Zygisk、SSL pinning、root/jailbreak evaluation | Mobile security track record
metadata:
  type: project
---

## 已交付类别

- **Frida hook 脚本**：
  - SSL Pinning + root detection 一次 attach 全覆盖（OkHttp3 4.x 用 `CertificatePinner.check` overload、SafetyNet stub、`System.getProperty` 白名单过滤）
  - `<clinit>` 早期检测的延迟 hook（`setImmediate` + class-loaded probe）
  - Native offset hook：`Module.enumerateSymbols` 后 fallback 到 pattern-scan `Memory.scanSync` on `libssl.so` 的 BoringSSL prologue
  - `Interceptor.attach` on 具体 SO 函数 + hex+ASCII 双 dump

- **Xposed / LSPosed 模块**：
  - 目标 APK 签名校验 hook：`android.app.ApplicationPackageManager#getPackageInfo` on `GET_SIGNATURES` + 缓存 pristine signature（`Application#attachBaseContext` 末）
  - scope 严格用 target package name，避免全 app scope 警告
  - Kotlin `object $Companion` 类 hook 需要 `Java.use("...$Companion")`

- **Magisk 模块**：
  - 标准 `module.prop` + `common/system.prop` prop overrides（Magisk 在 `post-fs-data` 阶段应用）
  - `META-INF/com/google/android/update-binary` 需要 `chmod +x`（常见 install 失败原因）
  - `service.sh` + `post-fs-data.sh` 生命周期正确使用

- **Zygisk 模块**：
  - `zygisk::ModuleBase` 子类；`preAppSpecialize` 是安装 Java-layer hook 的正确时机
  - `RegisterNatives` 替换 + `zygisk::Api::connectCompanion` 保持跨-app 状态
  - Zygisk API version 匹配 Magisk latest

- **iOS Tweak (Theos)**：
  - `nic.pl` scaffold + `%hook UIView` + `%orig` + `NSLog([NSThread callStackSymbols])`
  - `TARGET := iphone:latest:14.0` 需要显式，否则 SDK 落后
  - Filter plist 精确 bundle-id 匹配（否则误 attach 到系统 app）

- **objection 插件**：`Process.enumerateRanges({protection:'r--'})` + `Memory.scanSync` for 二进制 pattern search

## 工作模式

- 常用测试设备：bootloader-unlocked Android test device (Magisk installed), jailbroken iOS test device (personal)
- Android 版本跑 current release；iOS 关注 current public IPSW（IPSW 从 Apple CDN 公开可取）

## 常用命令模板

- Frida attach: `frida -U -f pkg -l hook.js --no-pause`
- APK 拆解: `jadx-gui apk`（Java 层）+ `apktool d apk`（smali）+ `libil2cpp.so` 用 Il2CppDumper
- Zygisk 模块打包: 标准 zip 布局，`chmod +x` on update-binary
- Magisk 模块 sideload: Magisk manager UI 或 `magisk --install-module <zip>`

## 交付形态

`.js` Frida 脚本、`.xm` Theos tweak、`.zip` Magisk/Zygisk 模块、`AndroidManifest.xml + xposed_init` Xposed 模块。
