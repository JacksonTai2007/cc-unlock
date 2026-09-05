# 全网搜索升级 Playbook

## 分工声明

本文件只负责回答**"何时触发搜索"**，不负责回答**"如何执行搜索"**。  
搜索执行细则（GitHub → 全网搜索的两级降级流程、`mcp__web-search__search_bing` + `mcp__web_reader__webReader` 工具调用、结果汇总、文件落盘）一律以 `references/web-search-tool.md` 为唯一真源。

---

## 适用场景（何时触发）

- 当前主线默认连续两轮没有逼近验收；若当前为已开启 `deepDivePermit` 的 VM / WASM / 混淆微路线，则改为“当前 microRoute 连续两轮没有新增高价值证据”
- **已拿到加密/解密/WASM/签名样本，但算法族或变换模式无法立即识别**（最高优先级触发——不得在算法方向不明时继续深挖局部模式）
- 需要识别保护供应商、协议包装层、公开 SDK、开源实现或已知 signer family
- 命中 `baseline_ok_generated_rejected`、`silent reject`、`200 + 空体` 等需要路线纠偏的症状
- 用户明确要求”先查资料 / 搜 GitHub / 搜官方文档 / 看 issue”
- **起始阶段已识别 WASM / JSVMP / 自定义 VM 为核心算法载体，但尚未定位到具体算法函数**
- **准备进入第 2 个同类统计脚本 / 更大样本采集前，仍缺少标准家族 shortlist 或 direct-call 线索**

## 定位

全网搜索在本技能里不是”搜资料”，而是：

1. 帮助识别 **保护家族 / 协议家族 / SDK 家族**
2. 帮助修正 **entrypoint 选择**
3. 帮助提高 **probe 的信息增益**
4. 帮助减少在低价值 hook 面上的盲试

## 执行方法

一旦确认触发搜索，**立即调用 `references/web-search-tool.md` 中定义的搜索流程**，通过 `web-search` MCP Server 的 `mcp__web-search__search_bing` 执行搜索、`mcp__web_reader__webReader` 获取页面内容。按该文件规定的两级降级流程执行。不得自行设计替代搜索路径。

搜索完成后，在 `state/external-research.md` 中简要记录命中的 provider/family/protocol 及采纳/拒绝决定，然后立即回到 entrypoint loop 继续执行。不得搜索后继续维持原假说却不解释理由。

## 禁止事项

- 不经运行时证据验证就照搬网络代码
- 把“搜到类似仓库”当成签名已恢复
- 只列链接，不写采纳 / 拒绝理由
- 搜索后不回到 entrypoint loop，直接无限扩展阅读面
- 搜索后继续维持原假说，却不解释为什么原假说尚未被降级
