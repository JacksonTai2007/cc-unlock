# Web Search Tool（全网搜索工具）

全网搜索在本技能中是一个**独立工具调用**，通过 `web-search` MCP Server 提供的 `mcp__web-search__search_bing` 和 `mcp__web_reader__webReader` 执行实际的网页搜索与内容获取。所有触发搜索的场景必须通过本工具执行，禁止绕过工具直接搜零散关键词。

## 定位

全网搜索不是"查资料"，而是：

1. 帮助识别 **保护家族 / 协议家族 / SDK 家族**
2. 帮助修正 **entrypoint 选择**
3. 帮助提高 **probe 的信息增益**
4. 帮助减少在低价值 hook 面上的盲试

## 输入参数

调用本工具时必须提供以下参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `query` | 是 | 核心搜索关键词，直接用已观察到的字段名/函数名/错误码/症状词 |
| `host` | 否 | 目标 host 域名，不知道确切名称时可省略 |
| `context` | 否 | 搜索上下文/原因，如"算法族识别"、"WASM导出定位"、"provider识别" |
| `searchRound` | 否 | 当前搜索轮次，用于记录和追踪 |

## 两级降级搜索流程

执行顺序：**GitHub → 全网搜索**，前一级无有效结果时自动降级到下一级，不得跳过。

### 第一级：GitHub 搜索

**工具**：`mcp__web-search__search_bing`
**查询格式**：`{query} github reverse`（关键词匹配，不依赖 `site:` 限定符）

```
mcp__web-search__search_bing({ query: "{query} github reverse", count: 10 })
```

1. 直接执行 GitHub 搜索
2. **评估结果**：是否有相关仓库、issue、PR 或明确线索？
   - **有效结果**：记录仓库名、关键 issue/PR 标题、相关代码片段摘要
   - **无有效结果**：标记 `githubResult=empty`，进入第二级

### 第二级：全网搜索 + 内容获取

**搜索工具**：`mcp__web-search__search_bing`
**内容获取工具**：`mcp__web_reader__webReader`

```
mcp__web-search__search_bing({ query: "{query} 逆向分析 技术博客 实现原理", count: 10 })
```

1. 使用 `mcp__web-search__search_bing` 获取搜索结果
2. **访问文章内容**：对搜索结果中的 **前 5 条**链接调用 `mcp__web_reader__webReader({ url: "{link}" })` 获取正文内容
3. **评估结果**：
   - **有效结果**：记录标题、链接、内容摘要（200字以内）
   - **无有效结果**（5条均无相关技术内容）：标记 `webResult=empty`，搜索轮次结束

**Fallback 路径**：以下任一条件命中时必须触发 fallback：
- MCP 工具调用返回 error 或超时
- 搜索返回结果为空
- 内容获取返回内容长度 < 50 字符

触发后：
1. 换用不同关键词组合重新搜索，如 `{query} reverse javascript`、`{query} sdk docs`
2. 记录本次使用了 fallback，在 `external-research.md` 中标注 `searchFallback=true`

## 结果汇总与输出

搜索结束后，无论哪一级命中，都必须执行以下输出动作：

### 1. 内容汇总

将所有获取到的文章内容按以下结构汇总：

```
## 搜索汇总 [{timestamp}]

### 搜索参数
- query: {query}
- host: {host}
- context: {context}
- searchRound: {searchRound}

### 搜索结果路径
- GitHub: {命中/未命中}
- 全网搜索: {命中/未命中}（访问了 N 条链接）

### 有效结果摘要
1. [{标题}]({链接})
   - 来源: GitHub/全网搜索
   - 摘要: {200字以内内容摘要}
   - 可采纳线索: {具体可采纳的内容}

2. ...

### 对当前任务的影响
- provider/family 识别: {结论}
- entrypoint 调整建议: {建议}
- 下一轮 probe 方向: {方向}
```

### 2. 文件落盘

- **人读版本**：写入 `artifacts/tasks/<task-id>/state/external-research.md`（追加模式）。落盘前先执行 `mkdir -p artifacts/tasks/<task-id>/state/`
- **结构化数据**：写入 `artifacts/tasks/<task-id>/state/external-research.json`。若 task-id 尚未确定，使用临时路径 `artifacts/tasks/search-temp/state/external-research.{md,json}`，格式：
  ```json
  {
    "searchRound": N,
    "query": "...",
    "host": "...",
    "context": "...",
    "results": {
      "github": { "hit": true/false, "items": [...] },
      "web": { "hit": true/false, "items": [...], "linksAccessed": N }
    },
    "providerFound": "...",
    "familyFound": "...",
    "actionable": true/false,
    "nextProbeDirection": "..."
  }
  ```

### 3. 状态更新

更新 `state/route-state.json`：
- `lastSearchRound` = 当前轮次
- `searchRounds` += 1
- `searchDecision` = 搜索结论（provider/family/direction）
- `knowledgeGap` = false（搜索完成后标记为已尝试填补）

## 有效结果判定标准

以下情况视为**有效结果**：

- GitHub：找到同名/类似实现的仓库、相关 issue/PR 讨论、代码片段可直接比对
- 全网搜索：找到技术博客、分析文章、官方文档、社区讨论，其中包含可识别的算法名称、协议格式、字段含义或实现思路

以下情况**不算有效结果**：

- 只有同名但完全不同领域的项目
- 只有广告页面或内容农场
- 只有搜索引擎自己的推荐/相关搜索，没有实质内容
- 页面无法访问或内容为空

## 搜索结果决策表

搜索完成后，根据最高置信度的结论执行对应动作，不得自由发挥：

| 搜索结论 | 最低置信度门槛 | 下一步硬性动作 |
|---------|--------------|--------------|
| 发现具体 provider | 搜到官方文档/仓库 README 且在同一页面出现当前 host 域名或特征字段 | 加载对应 `references/*-playbook.md`，调整 entrypoint 到 provider 相关 hook 面 |
| 发现算法族 | 搜到算法名称且在同一页面出现与当前任务相关的字段名/函数名 | 在浏览器中直接尝试标准解密/验证，同时记录算法参数 |
| 发现开源实现 | 仓库 README 中明确提及目标 host 域名或功能；或仓库代码中出现与浏览器 hook 输出相同的函数名/常量名（至少 2 个） | 提取仓库中的关键函数签名和常量表，与浏览器 hook 输出做比对验证 |
| 发现已知绕过 | issue/博客中描述的版本与当前目标版本一致或兼容 | 评估绕过方案是否适用于当前场景，若适用则尝试；若已修复则标记 `bypassStale=true` |
| 零命中 | 两级搜索均未达到以上任何门槛 | 标记 `no-external-clues`，回到 entrypoint loop，**下一轮必须切换 entrypoint 家族** |

**规则**：搜索结论必须写入 `searchDecision` 字段，且下一步动作必须与上表对应。不得搜到 provider 却继续盲试 hook。

## 零命中处理

两级搜索全部零命中时：

1. 在 `external-research.md` 中明确记录"两级搜索均无有效结果"
2. 将 `searchDecision` 设为 `"no-external-clues"`
3. **不得因此停止任务**，必须回到 entrypoint loop，基于已有浏览器证据继续推进
4. 向用户简要说明"外部搜索未找到直接线索，将继续基于本地证据推进"，但不得展开成长篇汇报

## 禁止事项

- 不经运行时证据验证就照搬网络代码
- 把"搜到类似仓库"当成签名已恢复
- 只列链接，不写采纳/拒绝理由
- 搜索后不回到 entrypoint loop，直接无限扩展阅读面
- 搜索后继续维持原假说，却不解释为什么原假说尚未被降级
- 跳过 GitHub 直接执行全网搜索
- 搜索结果未落盘就继续下一轮 probe
