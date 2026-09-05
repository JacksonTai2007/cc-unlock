<!-- publish: framework -->
# Auto Advance Protocol

新方案下，自动续跑不是"建议"，而是默认执行纪律。

## 目标

把"恢复后继续执行、阶段结束后继续下一步"从文案要求变成可执行规则。

## 核心状态

由 `route-state.execution` 驱动：

- `status`
- `pauseCategory`
- `nextEntrypointId`
- `nextExecutableAction`
- `autoAdvanceEligible`
- `currentTier`：当前停损层级（`foundation / probe / deep-dive`）

## 核心规则

### 如果 `execution.status=ready-to-continue`

并且：

- `pauseCategory=none`
- `discipline.mustExecuteNow=true`

那么：

- 必须继续执行 `nextExecutableAction`
- 不允许停在状态汇报
- 不允许用"我会继续"代替动作
- 回复前 `assert-can-reply` 应该失败

### 只有以下情况才允许停下

- `pauseCategory=user`
- `pauseCategory=risk`
- `execution.status=completed`

## 长时间任务的可见性

当任务命中以下**硬触发条件**之一时，输出最小状态信号（不超过 3 行），信号后必须立即继续执行：

- 完成 Foundation 阶段，即将进入 Probe 阶段（以 Foundation 硬性完成标准 3 项全部满足为准）
- 完成一次 retrospective / 主模式切换
- 完成一次交付梯度升降级
- 完成一次 major pivot（跨 entrypoint 家族切换）
- 完成一次阶段回退
- 开启或结束 deepDivePermit

不依赖"预计超过 5 轮"这类主观判断——触发条件由上述硬事件决定。

这不是阶段性汇报，而是状态锚点。格式：
```
[阶段切换] Foundation → Probe
[梯度降级] 纯算法提取 → 浏览器可控复用
[阶段回退] Probe → Foundation（hook 空转，carrier 链路断裂）
[Permit 开启] deepDivePermit: VM dispatcher 微路线，maxRounds=6
```

**状态信号内容约束**：信号行只能包含阶段/梯度/permit 的变更事实，不得包含过程性描述（如"已完成 carrier 追踪""将继续推进""hook 面稳定"）。如果一行既包含变更事实又包含过程描述，算作违规。

## 工具降级时的自动续跑

当工具链处于 L1/L2/L3 降级模式时：

- 自动续跑纪律仍然通过文本规则生效
- 以 `route-state.json` 的 `execution.status` 为手动判据
- `execution.status=ready-to-continue` 且 `pauseCategory=none` → 继续执行
- `pauseCategory=user` 或 `risk` → 停下
- 在没有 `assert-can-reply.mjs` 的情况下，通过以下**硬检查**代替门禁判断（必须逐条核对，不得跳过）：
  1. `execution.status` 是否为 `ready-to-continue`？→ 检查 `pauseCategory`
  2. `pauseCategory` 是否为 `none`？→ **禁止回复**，必须继续执行
  3. `pauseCategory` 是否为 `user`？→ 用户是否已完成协作动作？未完成 → 允许回复（请求协作）；已完成 → **禁止回复**，必须先执行 `task-advance --resume-from-user`（L1/L2 降级时 task-advance 不可用，改为手动更新 `route-state.json`：将 `pauseCategory` 设为 `none`、`execution.status` 设为 `ready-to-continue`，然后立即执行 `nextExecutableAction`）
  4. `pauseCategory` 是否为 `risk`？→ 允许回复（确认风险）
  5. `execution.status` 是否为 `completed`？→ 允许回复
  6. 是否准备声明"已完成/已交付"？→ 必须提供 3 项硬证据：验证脚本成功运行 + fixtures 存在 + acceptanceGap 为空
- 不得用"基于文本规则判断，当前似乎可以暂停"这类模糊判断代替上述逐条核对

### L0-L3 自诊断

每轮开始或恢复时，必须先确定当前 toolingLevel（参见 SKILL.md "工具链自诊断"），不得凭感觉宣称"工具不可用"。诊断步骤：`node --version` → `ls tools/task/*.mjs` → 试运行 `task-sync` → 定级 L0/L1/L2/L3。

## 用户协作恢复

如果上一轮是 `pauseCategory=user`，而用户已经完成了要求的动作（如"已加载 / 已登录 / 继续 / 好了"），则：

- 不允许继续沿用旧 `blocked-on-user`
- 必须先执行 `task-sync`（降级时手动读取 route-state.json）
- 然后执行 `task-advance --resume-from-user`（或 `--pause-category=none`）
- 若恢复后是 `ready-to-continue`，必须立即执行 `nextExecutableAction`

"用户已经完成协作动作，但 route-state 还停在 blocked-on-user" 属于恢复失败，不是合法暂停。

## 三个关键工具

### `task-sync`
负责：
- 恢复真源
- 同步 Markdown 视图
- 刷新 execution 镜像

### `task-advance`
负责：
- 重算当前能否暂停
- 输出 `nextExecutableAction`
- 刷新 `execution.status`

### `assert-can-reply`
负责：
- 在用户可见回复前做最后门禁
- 当前仍应继续执行时直接阻止回复

## 新方案下的成功标准

自动续跑是否生效，不看"有没有写下一步计划"，而看：

- 是否真的继续执行了下一步
- 是否避免了中途状态播报停机
- 是否把"继续推进"变成默认动作而非口头承诺
- 长任务中是否保持了最小状态可见性而不退化成过程刷屏
