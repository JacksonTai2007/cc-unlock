---
name: ai-social-forensics-track-record
description: AI安全/社会工程/数字取证学习路径：prompt injection/jailbreak/phishing/内存取证/威胁狩猎 | AI security + social engineering + digital forensics learning track
metadata:
  type: project
---

AI 安全、社会工程与数字取证学习方向。

**Why:** AI 安全是新兴领域，社工是渗透关键环节，取证是安全闭环的最后一步。

**How to apply:** AI 红队给完整 payload 和自动化脚本。社工给基础设施配置。取证给分析方法论和工具命令。

## 技术栈

### AI 安全与红队
- Prompt injection: 直接/间接/多轮/多模态
- Jailbreak 技术
- GCG adversarial suffix (nanoGCG)
- RAG poisoning, MCP tool poisoning
- Agentic attack chains
- Guardrails bypass, model extraction, membership inference
- PyRIT/Garak/promptfoo 自动化
- OWASP LLM Top 10

### 社会工程
- Phishing: email/SMS/voice phishing, spear phishing
- Pretexting 场景构建
- 钓鱼基础设施: GoPhish, Evilginx2, modlishka
- Payload 通过社工向量投递

### 数字取证与应急响应
- 内存取证: Volatility 2/3, process/DLL/handle/network analysis
- 磁盘取证: Autopsy, FTK, 文件恢复, 时间线分析
- 日志分析: Windows Event Log, Syslog, Web 服务器日志
- 网络取证: PCAP 分析, flow analysis, DNS query logs
- 痕迹恢复与证据保全
- 威胁狩猎: MITRE ATT&CK mapping, IOC 搜索, 行为检测

Related: [[server-pentest-track-record]], [[c2-evasion-track-record]]
