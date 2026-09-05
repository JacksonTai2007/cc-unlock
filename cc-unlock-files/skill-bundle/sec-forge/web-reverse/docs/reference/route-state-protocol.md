<!-- publish: framework -->
# Route State Protocol

`web-reverse` 把任务路线状态拆成两层：

- 机器真源：`artifacts/tasks/<task-id>/state/route-state.json`
- 人类视图：`state/route-plan.md`、`state/clues.md`、`state/progress.md`

`task-sync`、`validation`、`closeout` 优先读取 `route-state.json`。
Markdown 文件继续保留，但它们是从 JSON 派生的展示层，不再承担状态恢复真源职责。

## topic pack 激活协议

`task.taskPacks` 里至少区分两层：

- `selectedTopics / selectedExtensions`：初始化时挂载、候选可用的 topic pack
- `activatedTopics / activatedExtensions`：已经被真实证据激活、需要进入正式验证与交付约束的 topic pack

约束：

- `task-init` 默认只设置 `selected*`，`activated*` 初始应为空
- `task-sync` 可根据 present path、路线证据、artifact 触碰、report/clues 交叉命中来自动激活 topic
- `validation` 在 `activatedTopics` 非空时，只对激活态 topic 强制交付；未激活 topic 不应制造假失败
- 如果一个 topic 只是因为模板初始化被挂载，但尚未命中真实证据，不应进入 hard validation
- `activatedExtensions` 应与 `activatedTopics` 对应，避免出现 topic 已激活但 extension 未同步的漂移

## 启动顺序

恢复已有任务时，按以下顺序读取：

1. `task.json`
2. `state/route-state.json`
3. `state/route-plan.md`
4. `state/clues.md`
5. `state/progress.md`

恢复完成后的默认动作：
- 立刻回到 `route-state.json.phase` 对应阶段继续执行
- 不把“已恢复”“已同步”或“已总结”当作暂停条件
- 紧接着运行 `task-advance`，以 `route-state.execution` 刷新当前是否允许暂停、下一条切入点和下一可执行动作
- 如果上一轮是 `pauseCategory=user`，而用户已经回复“已加载 / 已登录 / 继续 / 好了”，则恢复后必须执行 `task-advance --resume-from-user`（或 `--pause-category=none`）清除旧暂停，再看新的 `execution`

如果只有 Markdown 没有 JSON，允许 `task-sync` 做一次 `backfilled-from-markdown`。
一旦回填完成，后续恢复都必须以 JSON 为准。

## route-state.json 最小结构

必须包含：

- `schemaVersion`
- `updatedAt`
- `taskId`
- `phase`
- `syncStatus`
- `activeTracks`
- `activeEntrypoints`
- `execution.status`
- `execution.autoAdvanceEligible`
- `execution.pauseCategory`
- `execution.pauseReason`
- `execution.nextEntrypointId`
- `execution.nextExecutableAction`
- `tracks`
- `entrypoints`
- `retrospectives`
- `clues`

## entrypoints

`entrypoints` 是任务的主调度单元，不是 topic 的别名。

每条 `entrypoint` 至少记录：

- `id`
- `title`
- `hypothesis`
- `boundTopics`
- `targetTrack`
- `rationale`
- `cost`
- `expectedGain`
- `probe`
- `successCriteria`
- `failureCriteria`
- `status`
- `resultSummary`
- `nextOnSuccess`
- `nextOnFailure`
- `updatedAt`

状态建议只使用：

- `CANDIDATE`
- `PROBING`
- `EXPANDED`
- `PARKED`
- `EXHAUSTED`
- `SUCCESS`

约束：

- 同时活跃的 `entrypoints` 最多 2 个
- 单次恢复后默认先回到 `activeEntrypoints`
- 只要切入点结论已明确，就必须推进“扩展 / 切换 / 复盘”三选一，不能停在模糊状态

## retrospectives

当当前切入点集整体无效时，必须写一次 `retrospective`。

每条 `retrospective` 至少记录：

- `id`
- `triggeredByEntrypoints`
- `summary`
- `failedBecause`
- `newEntrypoints`
- `decision`
- `nextFocus`
- `createdAt`

## execution

`execution` 是续跑协议的命令式补充层，用来回答“现在能不能停、不能停的话下一步必须做什么”。

至少记录：

- `status`
- `autoAdvanceEligible`
- `pauseCategory`
- `pauseReason`
- `nextEntrypointId`
- `nextPhase`
- `nextExecutableAction`
- `summary`
- `updatedAt`

状态建议只使用：

- `not-evaluated`
- `ready-to-continue`
- `needs-route-rebuild`
- `needs-retrospective`
- `blocked-on-user`
- `blocked-on-risk`
- `completed`

约束：

- 若 `execution.status=ready-to-continue`，则 `nextExecutableAction` 不能为空
- 只有 `pauseCategory=user/risk` 才允许暂停等待用户
- 用户协作动作已完成后，不得继续把旧 `pauseCategory=user` 当作可回复状态；应先 clear pause，再重新计算 `execution`
- `syncStatus=backfilled-from-markdown-lossy` 时，`execution.status` 必须切到 `needs-route-rebuild`
- 若 `execution.status=completed`，则 `nextEntrypointId / nextExecutableAction` 必须为空，且 `activeEntrypoints` 应清空

## 写盘时机

以下事件发生后，必须立即刷新 `route-state.json` 并回写 Markdown 视图：

- 新建或修改路线
- 新建、激活、暂停、废弃或成功扩展一个切入点
- 完成检查点
- 发现高价值线索
- 路线进入阻塞
- 更新切入点状态或扩展决策
- 完成一次复盘
- 阶段切换

写盘完成后的默认动作：
- 若下一阶段前提已满足，立即继续推进，不等待用户额外发送“继续”
- 若只是完成恢复、同步或阶段总结，不能把这些动作本身当作暂停条件
- 每次 `task-sync` 后都要刷新一次 `execution`
- 每次阶段收尾后都要重新运行 `task-advance` 或等价逻辑，确保 `nextExecutableAction` 指向新的最小动作
- 若 `run/*` 或 `pure-*` 产物明显新于 `task.json / route-state / progress`，应先标记或输出 `stale-detected`，再同步状态；closeout 前必须消除这种时间线漂移

## 约束

- 不要把原始证据写进 `route-state.json`
- 原始证据仍然落在 `network.jsonl`、`scripts.jsonl`、`runtime-evidence.jsonl`
- `report.md` 负责阶段性结论，不负责机器恢复
- 外部公开资料检索结果也不要塞进 `route-state.json`；应写入 `task.json.externalRefs` 与 `state/external-research.{json,md}`

## 2026-03 Addendum

- Markdown backfill 不是随便补默认值。`task-sync` 必须优先从 `route-plan.md` 恢复真实 `entrypoints` 和 `retrospectives`。
- 如果 Markdown 里已经存在 `EP-*` 迹象，但无法恢复结构化切入点，`syncStatus` 必须写成 `backfilled-from-markdown-lossy`，并在继续推进前人工重建切入点集合。
- 默认切入点应保持中性分诊，不要预先绑死到某一个 topic。
- `entrypoints` working set 上限为 5；超过后必须归档或裁剪已经 `EXHAUSTED / PARKED / SUCCESS` 的记录。
- `retrospectives` 只保留最近 5 条；更旧的复盘应写入 `report.md` 或归档，而不是持续堆在 route-state 里。
