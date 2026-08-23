<!-- generated: route-plan; source=state/route-state.json; do-not-edit-directly -->

# 路线计划

生成时间: 2026-03-25T13:26:40.567Z
任务摘要: replace-me
最终交付: report.md + run/*

## 当前状态

- 活跃线路: A
- 活跃切入点: EP-001
- VM 分诊: not-applicable
- 执行状态: ready-to-continue
- 可自动续跑: yes
- 下一可执行动作: 执行 EP-001 的最小 probe：做一次最小观测，确认当前主阻塞更像 signer、session、env、vm 还是协议编排问题。
- 工作区根目录: (none)
- task-local 根目录: (none)
- 产物真源根目录: (none)
- 工作区模式: skill-workspace
- 当前必须执行: yes
- 暂停类别: none
- 暂停原因: (none)
- 外部情报状态: not-started
- 外部情报查询: (none)
- 外部情报引用数: 0
- 外部情报草案数: 0
- 同步状态: restored-from-route-state

## 线路定义

### A

- 目标: 
- 输入依赖: 
- 输出格式: 
- 优先级: 
- 检查点: 

### B

- 目标: 
- 输入依赖: 
- 输出格式: 
- 优先级: 
- 检查点: 

## 切入点循环

- 原则: topic 提供能力边界，entrypoint 决定当前优先探哪一刀。
- 并行上限: 同时只保留 1 到 2 个活跃切入点。
- Pivot 规则: 若最小 probe 无效，则 park / exhaust 后切换或进入 retrospective。

#### EP-001 先做最小成本分诊

- 假设: 先用一个最便宜的观察性探针判断当前主阻塞更像 signer、session、env、vm 还是协议编排问题。
- 关联专题: 
- 对应线路: A
- 选择理由: 复合场景先做中性分诊，避免一开始就把某个 topic 误当成唯一主线。
- 启动成本: low
- 预期收益: high
- 最小探针: 做一次最小观测：hook / input-boundary diff / request initiator trace 三选一，先确认下一刀切在哪条链路。
- 成功判据: 能明确缩窄主阻塞点，或激活下一条更高价值的切入点。
- 失败判据: 没有带来新的可执行分歧，且不能支持下一步判断。
- 当前状态: CANDIDATE
- 当前结论: 
- 成功后: 扩展该切入点并绑定更具体的 topic。
- 失败后: 切到下一个候选切入点。
- 更新时间: 

## 协同规则

- 一旦出现高价值线索或决定性证据，立即更新 clues.md。
- route-state.json 是机器真源，Markdown 只是渲染视图。
- 复合任务要先按成本与预期收益排序候选切入点，再扩展 topic。
- task-sync / task-advance 之后若 execution.status=ready-to-continue，必须继续执行 nextExecutableAction，而不是停在状态汇报。
- 只有 execution.pauseCategory=user/risk 时才允许等待用户；其余状态要么继续推进，要么先修复 route-state working set。
- 一切“已落盘 / 已更新 / 已成功”声明，都必须先以 artifactTruthRoot 下的真实文件或最新验证结果自检。
- 若 当前必须执行=yes，则禁止用“我会继续 / 下一步继续”代替动作。
