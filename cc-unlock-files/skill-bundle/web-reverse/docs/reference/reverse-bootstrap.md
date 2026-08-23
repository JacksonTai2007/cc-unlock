<!-- publish: framework -->
# Reverse Bootstrap

这是新方案下的最小启动协议。

## 新会话先读

1. `SKILL.md`
2. `docs/reference/reverse-bootstrap.md`
3. `docs/reference/reverse-workflow.md`
4. `docs/reference/first-response-contract.md`
5. `docs/reference/deliverable-ladder.md`
6. `docs/reference/search-decision-policy.md`
7. 若任务已经稳定进入本地复现，再按需读 `docs/reference/pure-extraction.md`

## 新任务

如果当前 workspace 没有历史任务文件：

1. 执行 `task-start` 或 `task-init`
2. 执行 `task-sync`
3. 执行 `task-advance`
4. 先完成首轮压缩协议，再进入正式分析

## 续跑任务

如果当前 workspace 已有任务真源：

1. 读取 `task.json`
2. 读取 `state/route-state.json`
3. 读取 `state/route-plan.md`
4. 读取 `state/clues.md`
5. 读取 `state/progress.md`
6. 读取 `report.md`
7. 若存在 `state/external-research.md/json`，一并恢复
8. 执行 `task-sync`
9. 执行 `task-advance`
10. 先恢复当前 `taskMode / deliverableTier / primaryTopic`，再继续执行

如果续跑时已经接近 Close：

11. 先检查 `report / fixtures / verify / retrospective / external-research` 是否齐备
12. 先跑验证，再决定是否进入 `task-close`

如果 `task-advance` 给出 `execution.status=ready-to-continue`，先执行 `nextExecutableAction`，再考虑是否回复用户。

## 启动期路径纪律

- 真实任务真源以 `workspaceRoot/artifacts/tasks/<task-id>/` 为准
- 外部 workspace 可以是空目录
- 不要因为外部目录里没有 `tools/task/` 就误判无法启动
- 需要时应复用当前 skill 仓库里的 `tools/task/*.mjs` 去初始化外部 workspace
- 恢复或 close 前先核对 `workspaceRoot / taskLocalRoot / artifactTruthRoot / workspaceKind`，不要把 skill 根目录误写成 task artifact 真源
- 对外回复或报告也应沿用这组路径真源，而不是只写含糊的相对路径

## 搜索恢复纪律

- 若任务已执行过外部搜索，恢复时要同步恢复 `task.externalRefs` 与 `state/external-research.*`
- 搜索记录的作用是修正路线，不是替代 runtime evidence

## Close 恢复纪律

- 续跑时如果已经进入 Close，不要默认“差不多该结束了”
- 先确认当前 `deliverableTier` 已满足
- 再检查是否已经满足 `assert-can-reply --require-validated-deliverable`
