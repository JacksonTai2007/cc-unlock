# 快速开始

## 新任务

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

补充：

- 从 `Observe` 开始推进，先形成候选 `entrypoints`
- 再进入深 `Capture`，并把证据写入 task artifact

如果没有真实样本、而是要做真实感自主演练：

<!-- BEGIN GENERATED: bootstrap-drill-task -->
1. 运行 `npm run task:drill -- --list`
2. 选择 drill 后执行 `npm run task:drill -- <scenario-id> <task-id>`
3. 再按 `task.json -> route-state.json -> task-sync -> task-advance` 的标准闭环继续推进
<!-- END GENERATED: bootstrap-drill-task -->

## 继续已有任务

<!-- BEGIN GENERATED: bootstrap-resume-task -->
1. 先读 `task.json` 与 `state/route-state.json`
2. 再把 `state/route-plan.md`、`state/clues.md`、`state/progress.md` 作为派生视图补充查看
3. 执行 `node tools/task/task-sync.mjs <task-id>`
4. 执行 `node tools/task/task-advance.mjs <task-id>`
5. 若 `execution.status=ready-to-continue`，必须继续执行 `nextExecutableAction`，不要停在“已恢复”
6. 只有 `pauseCategory=user/risk`、缺样本或 closeout 已完成时，才允许暂停等待用户
<!-- END GENERATED: bootstrap-resume-task -->

补充：

- 每一阶段结束都先落盘，再自动进入下一阶段

## 开始前建议补读

- `docs/guides/minimal-usage-manual.md`
- `docs/guides/task-lifecycle.md`
- `references/mixed-mode-interop-playbook.md`
- `references/ipc-persistence-playbook.md`
- `references/exception-runtime-playbook.md`
- `references/memory-forensics-playbook.md`
