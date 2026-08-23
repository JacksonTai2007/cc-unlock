# Prompt Composition Guide

本文件承接 `PROMPTS.md` 中不再保留的长变体与组合建议。  
原则是：`PROMPTS.md` 只保留最常用模板，本文件承接组合技巧与扩展例句。

## 1. 组合顺序

推荐顺序：

1. 新任务 / 续跑任务模板
2. 验收导向
3. 交付梯度控制
4. Topic 预算控制
5. 专项附加句（VM / signer / DRM）
6. 外部搜索纠偏
7. 收尾 / Closeout

## 2. 适合下沉到扩展层的长说明

以下内容通常不必每次都塞进顶层提示：

- 好/坏示例对照
- 长格式暂停示例
- deliverableTier 降级解释模板
- browser-controlled reuse 与全网搜索（`mcp__web-search__search_bing`）取舍说明

只有当前任务真的卡在这些决策点上，再按需补回。

## 3. 可选扩展句

### deliverableTier 降级

```text
如果执行中发现当前 deliverableTier 选高了，请主动降级到更贴近验收的一层，并说明：
- 为什么原梯度过高
- 降级后新的主目标是什么
- 哪个高成本路线被暂停
```

### Topic 预算解释

```text
请顺带说明：
- 为什么这个主专题最贴近当前验收边界
- 哪个辅助专题如果默认两轮不再提供新证据，就会被移出预算；若该专题下的某条 VM / WASM / 混淆 microRoute 已开启 `deepDivePermit`，则改按 permit 预算判断
```

### browser-controlled reuse vs 全网搜索（web-search MCP）

```text
如果你准备进行全网搜索（通过 `mcp__web-search__search_bing`），请先说明：
- 为什么当前不是更适合继续 browser-controlled reuse
- 这轮搜索准备纠正哪一个 provider / family / entrypoint 判断
```

### 精确暂停示例

```text
- blocked-on-user
- blockingAction: 浏览器 harness 已到登录页，但签名请求依赖登录后内存态
- requiredUserAction: 现在请登录，并停留在目标页面不要刷新
- resumeCondition: 看到登录后的目标请求与 signer state 写入后立即继续
```

## 4. 何时不需要扩展句

以下情况不必补长模板：

- 只是常规新任务启动
- 只是续跑 task-local
- 当前主线已很清晰
- 暂无 deliverableTier 降级、全网搜索（`mcp__web-search__search_bing`）取舍、或 route-pivot 争议

## 5. 顶层瘦身原则

- 顶层保留高频模板
- 低频长模板放这里
- 规则真源仍是 `SKILL.md`
- 专题真源仍是 `topics/*/topic.json`
