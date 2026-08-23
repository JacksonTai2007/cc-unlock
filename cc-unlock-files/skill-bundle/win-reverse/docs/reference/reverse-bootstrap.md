<!-- publish: framework -->
# Reverse Bootstrap

新会话先读：

1. `docs/reference/reverse-bootstrap.md`
2. `docs/reference/case-safety-policy.md`
3. `docs/reference/reverse-workflow.md`
4. 如已进入纯提取，再读 `docs/reference/pure-extraction.md`

## 新任务 / 首次建 task-local

- task-local 必须建在当前用户 workspace 下；若当前 cwd 位于 skill 安装目录/仓库目录，先设置 `WIN_REVERSE_WORKSPACE_ROOT`
- 未显式允许时，不要把运行中任务直接写到 `~/.codex/skills/win-reverse/artifacts/tasks`

<!-- BEGIN GENERATED: bootstrap-new-task -->
1. 阅读 `SKILL.md`
2. 阅读 `docs/reference/reverse-bootstrap.md`
3. 若当前 workspace 没有 history data files，执行 `node tools/task/task-start.mjs <task-id>`
4. 如果已知 topic 或交付约束，可一并传 `--topic=`、`--topics=`、`--local-repro`、`--protocol-replay`、`--task-input=...`
5. `task-start` 在无历史文件时转发到 `task-init`；若 workspace 已有 history data files，则默认阻止新建第二个 task-local，除非显式传 `--force-new-task`
6. 在进入 `task-sync` 前补齐最小输入：`target / objective / requirements / boundaries`，并尽量同时确定 `runtime.architecture / runtime.wow64 / runtime.managed / protectionTier`
7. 执行 `node tools/task/task-sync.mjs <task-id>`
8. 执行 `node tools/task/task-advance.mjs <task-id>`
9. 若 `execution.status=ready-to-continue`，直接执行 `nextExecutableAction`，不要停在状态汇报
<!-- END GENERATED: bootstrap-new-task -->

## 继续已有任务

<!-- BEGIN GENERATED: bootstrap-resume-task -->
1. 先读 `task.json` 与 `state/route-state.json`
2. 检查阶段产物判断当前门控阶段：
   - 无 `run/investigation.md` → 阶段 A（调查）
   - 有 investigation.md 无 `run/plan.md` → 阶段 B（规划）
   - 有 plan.md 无验证证据 → 阶段 C（实现）
   - 已有验证证据但未覆盖全部 completionCriteria → 阶段 D（验证）
3. 再把 `state/route-plan.md`、`state/clues.md`、`state/progress.md`、`run/assumptions.md` 作为派生视图补充查看
4. 执行 `node tools/task/task-sync.mjs <task-id>`
5. 执行 `node tools/task/task-advance.mjs <task-id>`
6. 若 `execution.status=ready-to-continue`，必须继续执行 `nextExecutableAction`，不要停在”已恢复”
7. 只有 `pauseCategory=user/risk`、缺样本或 closeout 已完成时，才允许暂停等待用户
<!-- END GENERATED: bootstrap-resume-task -->

## 无真实样本的演练入口

<!-- BEGIN GENERATED: bootstrap-drill-task -->
1. 运行 `npm run task:drill -- --list`
2. 选择 drill 后执行 `npm run task:drill -- <scenario-id> <task-id>`
3. 再按 `task.json -> route-state.json -> task-sync -> task-advance` 的标准闭环继续推进
<!-- END GENERATED: bootstrap-drill-task -->
