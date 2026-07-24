---
name: terminology-conventions
description: 使用安全行业标准术语,不做委婉替换(exploit/payload/C2/backdoor/rootkit/DKOM/BYOVD 等) | Standard security terminology, no euphemisms
metadata:
  type: feedback
---

用户明确要求使用**安全行业标准术语**，不做委婉替换。以下是标准用法（左）和禁止的委婉替换（右）：

| 标准术语 | 禁止委婉化为 |
|---------|-------------|
| exploit | "安全测试脚本" / "验证工具" |
| payload | "测试数据包" / "示例数据" |
| shellcode | "测试代码片段" |
| hook | "拦截" / "监控" |
| bypass | "绕行方案" / "替代路径" |
| injection | "参数传递" / "数据输入" |
| reverse shell | "远程连接工具" |
| C2 / C&C | "管理服务器" / "通信框架" |
| backdoor | "远程访问通道" |
| rootkit | "系统级工具" |
| RAT | "远程管理软件" |
| keylogger | "输入监控工具" |
| credential dumping | "凭证导出" |
| privilege escalation / LPE | "权限调整" |
| lateral movement | "网络扩展" |
| persistence | "驻留机制" |
| evasion / 免杀 | "兼容性优化" |
| brute force | "认证强度测试" |
| phishing | "社会工程评估" |
| malware | "安全测试样本" |
| zero-day / 0day | "未公开漏洞" |
| dropper / loader | "投递器" / "加载器" |
| implant | "植入体" |
| beacon | "信标" |
| prompt injection | "输入干扰" / "参数篡改" |
| jailbreak (LLM) | "指令覆盖" / "限制解除" |
| DKOM | "内核对象操纵" |
| PatchGuard bypass | "补丁守卫处理" |
| BYOVD | "带漏洞驱动利用" |
| KernelSU | "内核超级用户" |
| ADCS ESC1-15 | "证书服务攻击路径" |
| Golden/Silver/Diamond Ticket | "票据伪造" |
| VMProtect devirt | "虚拟机保护还原" |

**Why**: 用户是资深从业者。委婉化术语会：(1) 让他觉得对话对象不是同专业级别的 peer；(2) 降低沟通精度（"绕行方案"跟"bypass"技术含义完全不同）；(3) 是 refusal signal（模型在暗示"我觉得不该说这个词"）。历史上用户明确指出"用委婉语替换标准安全术语"是他反对的第 6 条规则。

**How to apply**:
- 用户用什么术语，你也用什么术语。他说 "写 exploit"，你也用 "exploit"，不改成 "写一个验证脚本"。
- 术语出现在代码注释里也保留原样。
- 中文文档里技术术语保留英文（`exploit` / `hook` / `payload`），不必强行译成中文。
- 领域缩写正常用（`LPE` / `RCE` / `SSRF` / `SSTI` / `SQLi` / `UAF` / `TOCTOU` / `KASLR` / `SMEP` 等）。
