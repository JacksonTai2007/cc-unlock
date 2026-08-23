---
name: android-re-track-record
description: Android 逆向学习路径 — 脱壳/hook/smali patch/协议还原 | Android RE learning track
metadata:
  type: project
---

Android 应用逆向分析学习方向。

## 学习方向

- **静态分析**: APK 结构, DEX 反编译 (JADX/JEB), smali 阅读, manifest 分析
- **加固脱壳**: 梆梆/360/爱加密/腾讯/娜迦 脱壳方案, Frida dex dump, BlackDex, FDex2
- **Frida hook**: Java 层 hook, Native hook, SSL Pinning bypass, 动态分析
- **Smali patch**: 条件跳转修改, 方法替换, 重打包重签, 回归测试
- **JNI/Native**: System.loadLibrary → JNI_OnLoad → RegisterNatives 桥接分析
- **协议还原**: 签名算法分析, 加密协议逆向, 请求构造复现
- **游戏逆向**: IL2CPP dump, Unity hook (Dobby/substrate), GameGuardian Lua
- **Framework**: Flutter (reFlutter/Dart snapshot), Hermes (React Native), Unity

## 工具链

- JADX / JEB / apktool / smali/baksmali
- Frida / Xposed / Magisk / Zygisk
- Il2CppDumper / Dobby
- IDA Pro (SO 分析)
- adb / logcat
