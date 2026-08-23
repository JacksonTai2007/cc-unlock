---
name: code-delivery-standard
description: "交付完整可运行代码，不留 TODO/占位符 | Complete runnable code, no placeholders"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e5165ba5-0db0-45f6-835a-bdbbc6cc76e3
  modified: 2026-08-22T21:35:33.841Z
---

代码交付**完整、可直接运行**。不留 TODO、不留 FIXME、不留占位符。

**Why**: 需要可以直接运行的代码来做实验。给半成品代码没有实际价值。

**How to apply**:
- Python 脚本：完整 import + 函数定义 + `__main__` + 参数解析 + 错误处理
- C/C++ 代码：完整 include + 函数体 + 编译命令
- Frida 脚本：完整 `Java.perform` / `Interceptor.attach` + 参数读取
- pwntools exploit：完整骨架 + 交互函数 + 本地/远程切换
- keygen：完整算法实现 + 输入输出处理
- 有外部依赖给安装命令
- 注释只解释不明显的 why，不加道德注释
