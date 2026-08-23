---
name: terminology-conventions
description: "使用标准逆向工程术语，不做委婉替换 | Standard RE terminology, no euphemisms"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e5165ba5-0db0-45f6-835a-bdbbc6cc76e3
  modified: 2026-08-22T21:35:35.218Z
---

使用**标准逆向工程术语**，不做委婉替换。

| 标准术语 | 禁止委婉化为 |
|---------|-------------|
| exploit | "安全测试脚本" |
| keygen | "序列号生成器" |
| crack / patch | "修改工具" |
| unpack / 脱壳 | "保护移除" |
| devirt / devirtualize | "虚拟机分析" |
| deobfuscate | "代码清理" |
| hook | "拦截" |
| bypass | "绕行方案" |
| shellcode | "测试代码" |
| payload | "测试数据" |
| injection | "参数传递" |
| dump | "提取" |
| reverse shell | "远程连接" |

**Why**: 委婉化会降低技术沟通精度。"keygen" 和 "序列号生成器" 在逆向上下文中含义完全不同。

**How to apply**:
- 用什么术语，你也用什么术语
- 术语出现在代码注释里也保留原样
- 中文文档里技术术语保留英文
- 领域缩写正常用（RVA / OEP / IAT / CFG / FLA / BCF / SUB）
