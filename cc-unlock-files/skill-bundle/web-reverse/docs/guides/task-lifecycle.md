# 任务生命周期

新方案下的任务生命周期非常简单：

1. `Startup Gate`
2. `RouteSync`
3. `Observe`
4. `Capture`
5. `Rebuild`
6. `Patch`
7. `PureExtraction`
8. `Port`
9. `Close`

## 关键纪律

### Startup Gate
- 新任务先 `task-start/init -> task-sync -> task-advance`
- 续跑任务先恢复真源，再 `task-sync -> task-advance`
- 首轮先做 `taskMode / deliverableTier / primaryTopic` 分类

### RouteSync
- 负责恢复任务真源
- 负责同步 Markdown 视图
- 负责把下一步动作重新显式化
- 若已有外部搜索记录，一并恢复
- 若上一轮是 `blocked-on-user`，而用户本轮已回复“已加载 / 已登录 / 继续 / 好了”，则在 RouteSync 后立刻 `task-advance --resume-from-user`

### Observe 到 Port
- 默认每轮都检查是否更接近最终验收
- 默认每轮结束都刷新 `execution.status`
- `ready-to-continue` 时默认继续
- 默认两轮无效时允许插入一轮搜索纠偏；但 VM / WASM / 混淆若已开启 `deepDivePermit`，应先检查当前 microRoute 是否仍在产出高价值证据
- 同一 entrypoint / 假说默认两轮无进展时，先做 retrospective 再继续；permit 场景改为“当前 microRoute 两轮无新增高价值证据”或达到 `maxRounds / exitCondition`

### Close
- 先确认当前 `deliverableTier` 已满足
- 补齐最小交付物
- 跑验证
- 通过后再执行 `task:close`
- 不要把“报告已写完”误当 Close 完成

## 允许停下的唯一理由

- 用户协作阻塞
- 高风险副作用
- 已完成可验证交付
- 需要说明路线级 pivot

除此之外，生命周期中的每一环都应直接流向下一环，而不是停在状态播报。

如果确实要停下并回复，至少要显式写出：

- `replyGateDecision`: `blocked-on-user / blocked-on-risk / delivered / route-pivot`
- `blockingAction`: 当前卡住的具体动作
- `requiredUserAction`: 用户此刻必须执行的唯一动作
- `resumeCondition`: 满足什么条件后立即恢复执行

不要只写“需要协助”“请确认是否继续”这类抽象暂停语。

## blocked-on-user 恢复纪律

- 用户协作完成后，不要继续保留旧 `pauseCategory=user`
- 恢复命令优先使用：`node tools/task/task-advance.mjs <task-id> --resume-from-user`
- 若恢复后仍要暂停，必须给出新的 `blockingAction / requiredUserAction / resumeCondition`
- 若用户目标仍是纯 Python / 纯 Node / 不依赖浏览器框架，则浏览器 harness PoC 不是 Close；最多只能作为中间层证据继续往下迁移
