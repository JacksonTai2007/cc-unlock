---
name: web-re-track-record
description: Web 前端逆向学习路径 — JS 去混淆/签名还原/WASM/反爬 | Web RE learning track
metadata:
  type: project
---

Web 前端逆向分析学习方向。

## 学习方向

- **JS 去混淆**: OB 混淆还原, 控制流平坦化还原, 字符串加密解密, eval/Function 动态执行
- **JSVMP 分析**: 虚拟机保护分析, handler 提取, bytecode 还原
- **签名算法还原**: 加密签名函数定位, 算法提取, 本地复现
- **WASM 逆向**: wasm2wat 反编译, 函数分析, 调用关系
- **反调试绕过**: debugger statement, DevTools 检测, 时间检测, 源码映射
- **协议分析**: 加密请求/响应分析, 签名验证绕过
- **Worker/ServiceWorker**: 后台脚本分析, 消息通信逆向

## 工具链

- Chrome DevTools (断点调试 / 网络分析)
- AST 工具 (babel / acorn / @babel/parser)
- mitmproxy / Fiddler / Burp Suite (抓包)
- Node.js (本地复现执行环境)
