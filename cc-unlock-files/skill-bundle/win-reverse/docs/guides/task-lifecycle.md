# 任务生命周期

一个标准任务应沿着下面的闭环推进：

1. `Init`
   若当前 workspace 没有 history data files，优先使用 `node tools/task/task-start.mjs <task-id>` 创建 task-local
   如果已能预判 topic 或交付约束，可在这里直接带 `--topic=`、`--topics=`、topic alias flag、`--local-repro`、`--protocol-replay`、`--task-input=...`
   `task-start` 会在“无历史文件”时转发到 `task-init`；若已有 history data files，则默认阻止再建第二个 task-local，除非显式 `--force-new-task`
2. `Sync`
   使用 `node tools/task/task-sync.mjs <task-id>` 建立状态真源和 Markdown 视图
   如 task-local 中相关脚本仍是模板占位，`task-sync` 还会桥接 workspace 根目录已有的 `run/*` 脚本到 task-local
3. `Advance`
   使用 `node tools/task/task-advance.mjs <task-id>` 刷新 `execution.status / nextExecutableAction`
   如需显式写入暂停语义，可带 `--pause-category=`、`--pause-reason=`；如需程序化消费，可加 `--json`
4. `Observe`
   先识别专题、目标边界、样本类型、入口点、导入面与关键运行时迹象
   若安装目录存在大量 `js/html/css/json/map/asar/pak`，并行新增一条 `Web 套壳 / WebView 技术路线指纹` 线路
   同时列出 2 到 5 个候选切入点并排序
5. `Capture`
   采集静态、动态、hook、dump、网络、消息流等证据
   先验证当前活跃切入点的最小 probe
6. `Rebuild`
   在本地复现关键逻辑、调用条件、协议边界或运行时环境
7. `Patch`
   若样本与复现、静态与动态、用户态与内核态结果不一致，按 first divergence 做最小补丁
8. `PureExtraction`
   仅在 local rebuild 稳定后进入纯算法提取
9. `Port`
   把算法、请求验收脚本或验证脚本迁移到目标宿主
10. `Close`
    更新 `report.md`，补齐 `verify-once`，再用 `node tools/task/task-close.mjs <task-id>` 收口
    `task-close` 会保留当前 workspace 下的 task-local 数据，并把清理后的 task 快照归档到已安装同名 SKILL 的 `artifacts/tasks/<task-id>/`；可复用经验则沉淀到其知识目录；若未安装，再回退到当前仓库
    closeout 前还会自动修复 `report.md` 必填段、同步 `route-plan / clues / progress`，并在需要时桥接 workspace 根目录已有脚本

补充约束：
- 运行中 task-local 必须放在当前用户 workspace；若 cwd 位于 skill 目录内，先改 `WIN_REVERSE_WORKSPACE_ROOT`，不要直接在 skill 目录里开任务
- 每个阶段完成后先写盘，再自动进入下一阶段；不要把阶段总结、状态同步或恢复完成当作停点
- 每次 `task-sync` 后都要看 `execution.status`；若为 `ready-to-continue`，必须继续执行 `nextExecutableAction`
- 只有用户协作阻塞、高风险确认或 closeout 已完成时，才等待用户下一条指令
- `interactiveUnlockRequired` 只描述环境门槛，不会自动造成 `blocked-on-user`
- 只有当前下一动作严格依赖用户实际操作时，才允许设置 `pauseCategory=user`
- `closeout` 完成后，必须把 `route-state / route-plan / progress / report.md` 同步到 `execution.status=completed`，不能遗留 `ready-to-continue -> verify-once`
- `topics` 是能力模块；`entrypoints` 才是当前推进顺序
- 若当前切入点无效，必须显式切换；若当前切入点集全部无效，必须先复盘，再生成新切入点

## 每个任务至少应留下

- `artifacts/tasks/<task-id>/report.md`
- `artifacts/tasks/<task-id>/run/verify-once.mjs`
- `artifacts/tasks/<task-id>/run/fixtures.json`
- 与专题相关的最小脚本、样本和说明
