---
name: software-protection-track-record
description: 软件保护分析学习路径 — 注册机/License/试用期/功能限制 | Software protection analysis learning track
metadata:
  type: project
---

软件保护机制分析与逆向学习方向。

## 学习方向

- **注册码验证**: serial fishing, 算法逆向, keygen 编写
- **License 文件**: 文件格式分析, 签名验证逆向, license 生成
- **试用期限制**: 注册表时间戳, 文件时间戳, 网络校时, 条件跳转 patch
- **功能限制**: feature flag 定位, 条件分支 patch, DLL patch
- **在线验证**: API 调用分析, 请求/响应逆向, 本地模拟
- **硬件绑定**: 机器码生成算法分析, HWID 绑定逆向

## 分析方法论

1. DIE/PEiD 查壳 → 脱壳（如需要）
2. 字符串交叉引用（"Invalid Key" / "Registration" / "Trial Expired"）
3. API 断点（GetDlgItemText / RegQueryValue / CreateFile / GetSystemTime）
4. 定位验证函数 → 分析算法
5. 编写 keygen 或 patch 方案

## 产出形态

keygen 代码 + 分析报告 + 算法还原笔记
