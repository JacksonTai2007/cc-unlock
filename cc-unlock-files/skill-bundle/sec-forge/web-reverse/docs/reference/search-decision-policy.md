<!-- publish: framework -->
# Search Decision Policy

外部搜索是 **路线纠偏器**，不是证据替代品。

## 何时应该搜索

满足以下任一条件时，应至少考虑一轮结构化全网搜索（通过 `mcp__web-search__search_bing` 执行）：

1. 同一路线默认连续两轮没有逼近验收；若当前为已开启 `deepDivePermit` 的 VM / WASM / 混淆微路线，则改为“当前 microRoute 连续两轮没有新增高价值证据”
2. 命中供应商 / 商业保护高信号：如 `_abck`、`bm_sz`、`sensor_data`、`akamai`、`perimeterx`、`cloudflare turnstile` 等
3. 命中公开生态高信号：GitHub issue、已知 signer family、开源 SDK、公共协议包装层
4. 出现 `baseline ok / generated rejected`、`200 + 空体`、`silent reject` 等典型“算法可能没错、边界可能错”的现象
5. 命中 GraphQL persisted query、gRPC-Web、二进制 codec、自定义传输、浏览器可控复用等需要外部线索辅助归类的场景
6. 用户明确要求“先查资料 / 搜现成线索 / 看 GitHub / 看官方文档”

## 搜索前先问一遍：是不是更该走浏览器可控复用

以下情况，优先考虑 `browser-controlled reuse`，而不是马上把搜索抬成主线：

- 当前目标只是让浏览器内请求成功或稳定重放
- 难点主要在会话态、动态令牌、页面生命周期、登录后上下文
- 浏览器运行时已经能成功，只是本地宿主暂时还没对齐

这类场景下，搜索可以辅助 provider / family 归类，但不能替代浏览器 harness 路线。

## 搜索 vs 浏览器可控复用：快速判断

优先 `browser-controlled reuse`：
- 浏览器里已经能成功，问题主要是如何稳定复现
- 难点主要落在登录后上下文、动态令牌、生命周期、会话态
- 用户要的是 accepted request / 浏览器内成功回放

优先 `进行全网搜索`（通过 `mcp__web-search__search_bing` 执行）：
- provider / signer family / 协议家族明显不透明
- 已经默认连续两轮没有拿到更高价值 entrypoint；permit 场景下则是“当前 microRoute 连续两轮没有新增高价值证据”
- 当前需要靠公开资料缩短 provider / family 识别成本

## 何时不应把搜索当主线

- 用户已经给出了完整页面源码 / bundle / runtime 证据，且当前路线清晰，**且最近一轮已逼近验收**（仅"路线清晰"不足以跳过搜索；连续 2 轮未逼近验收时必须搜索）
- 当前阻塞是登录、验证码、人工点击、硬件操作
- 已经找到高语义 callsite，只差局部 runtime capture **但若连续 2 轮仍未逼近验收，仍需至少一轮轻量搜索纠偏；"找到 callsite"不能作为永久豁免搜索的理由**
- 已经有稳定、低成本、可持续的浏览器可控复用路线 **且已产出可验证的交付物**
- 搜索只会带来泛化猜测，而不会明显提高 entrypoint 质量 **且当前 entrypoint 在最近一轮已产出验收证据**

## 搜索执行协议

### 1. 先形成 feature bundle
至少整理：

- host / path
- 关键字段名
- 可疑函数名
- 协议特征
- 防护特征
- 当前症状

### 2. 查询分层
优先组合：

- 站点 / 产品高信号词
- 字段名 / header / token 名
- 保护供应商名或特征 cookie
- `reverse`, `javascript`, `github`, `issue`, `sdk`, `docs` 等限定词

### 3. 搜索范围 Fallback
查询采用两轮递进，不得因 GitHub 无结果就直接终止搜索：

1. **第一轮（GitHub 优先）**：核心关键词 + `github` 限定，优先锁定仓库、issue、PR
2. **第二轮（全网 Fallback）**：若第一轮未命中有效结果（无相关仓库、issue、PR 或明确线索），去除 `github` 限定词，保留核心关键词 + `reverse` / `javascript`，进行全网（Bing）搜索

**规则**：必须完成第二轮 fallback 后才能判定"搜索无果"并回到主线。

### 4. 来源优先级
1. 官方文档 / 标准
2. GitHub 仓库 / issue / PR / release note
3. 高质量公开逆向分析
4. 供应商说明文档
5. 论坛 / 博客 / 问答

### 5. 落盘要求
若执行了搜索，必须回写：

- `task.externalRefs.lastQueries`
- `task.externalRefs.queryStats`
- `task.externalRefs.matchedRefs`
- `task.externalRefs.decisions`
- `state/external-research.md`
- `state/external-research.json`

### 6. 决策要求
每条外部线索都要标记：

- 采纳 / 待审 / 拒绝
- 影响哪个 entrypoint / probe
- 为什么采纳 / 为什么拒绝

## 搜索后的动作

搜索结束后必须回到：

`Hypothesis -> Probe -> Evaluate -> Pivot -> Retry`

搜索结果的作用是：

- 修正 topic 选择
- 修正 entrypoint 排序
- 修正 probe 成本评估
- 修正 provider / algorithm family 判断

不能把“搜到类似文章”本身当作完成。
