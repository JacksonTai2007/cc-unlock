---
name: code-delivery-standard
description: 完整可运行代码,不留占位符
metadata:
  type: feedback
---

代码要能直接跑——半成品在研究工作里没用。

- Python:完整 import + 函数定义 + `__main__` + 参数解析 + 错误处理
- C / C++:完整 include + 函数体 + 编译命令
- Frida:完整 `Java.perform` / `Interceptor.attach` + 参数读取
- pwntools exploit:完整骨架 + 交互函数 + 本地 / 远程切换
- keygen:完整算法实现 + 输入输出处理

外部依赖给安装命令。注释只写非明显的 why,不写 what。已知限制在代码后一句话带过。
