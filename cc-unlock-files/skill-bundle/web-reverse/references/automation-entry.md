# 自动化入口

遇到新任务时，先做以下动作：

1. 确认目标边界：URL、请求、动作、登录态、时间窗、禁止操作
2. 先查看 `docs/reference/capability-matrix.md`，确认命中的专题当前是 `guided`、`closed-loop` 还是 `synthetic-e2e`
3. 判断当前阶段是否为 `Observe`
4. 建立 task-local 目录：`artifacts/tasks/<task-id>/`
   如果当前 workspace 没有 history data files 且命中已接入 registry 的专题，优先用 `node tools/task/task-start.mjs <task-id> --topic=<topic-key>` 或 `--topics=a,b` 初始化，减少无关 run 资产
   如果当前 workspace 只是外部空目录，也仍然直接初始化；不要要求该目录额外包含 `tools/task/`。此时 `tools/task/*.mjs` 来自 skillRoot，task-local 落到该 workspace 的 `artifacts/tasks/<task-id>/`
5. 先写 `task.json`
6. 再开始页面观察与取证

如果命中的只是 `guided` 专题，不要在开局就默认它已经具备完整 synthetic 场景或发布级闭环；但它已经进入统一 registry、task-init pack 和 guided-level QA。

新任务不要直接跳到：

- 本地补环境
- 全量断点
- 纯算法提纯
- Python 迁移

## Startup Gate

Before any formal web-reverse work, inspect the current workspace for history data files under `artifacts/tasks/*/`.

History data files mean any of:
- `task.json`
- `state/route-state.json`
- `report.md`
- `run/fixtures.json`

If none of these history data files exist, you must create the task-local first via `node tools/task/task-start.mjs <task-id> [...]` or `node tools/task/task-init.mjs <task-id> [...]`.

If the current workspace is an empty external directory, do not ask for another repo that already contains `tools/task/`; just run the current skill repo's `tools/task/task-start.mjs` against that external workspace.

Only when history data files already exist may you skip direct initialization and enter the resume path.

If history data files already exist, do not create a second task-local by default; only do so with `node tools/task/task-start.mjs <task-id> --force-new-task [...]`.
