# Startup Gate 操作细则

> SKILL.md「Startup Gate」段的完整操作手册。主文件只保留工作目录铁律与新任务/续跑骨架；目录检测步骤、恢复真源顺序、用户协作恢复协议、路径纪律在此。

## 目录检测与阻断

执行任何文件操作前，先运行以下检查：

1. **获取 cwd**：`pwd`（或 `echo %cd%` / `echo $PWD`）
2. **检测 SKILL 目录特征**：检查当前目录或其直接父目录是否包含 `SKILL.md` 文件
3. **如果当前目录是 SKILL 包目录**：
   - **立即停止**：不得在此目录下创建 `artifacts/tasks/`
   - **向用户报告**："当前工作目录是 SKILL 包目录，无法在此创建任务。请切换到您的项目目录后重试，或告诉我项目目录路径。"
   - **等待用户确认**：在用户明确提供项目路径或切换到正确目录前，不得继续任何任务创建操作
4. **如果当前目录不是 SKILL 包目录**：将当前目录锁定为 `workspaceRoot`，后续所有路径均相对于此目录解析

## 新任务

确认当前目录合法（非 SKILL 包目录）后，如果 workspace 里还没有 history data files：

1. `node $TOOL_DIR/task-start.mjs <task-id>` 或 `node $TOOL_DIR/task-init.mjs <task-id>`
2. `node $TOOL_DIR/task-sync.mjs <task-id>`
3. `node $TOOL_DIR/task-advance.mjs <task-id>`

**工具不可用时**：参见 `tooling-degradation.md`——降级到 L1/L2/L3 对应层级，手动在当前 cwd 下创建 `artifacts/tasks/<task-id>/` 结构后继续。

**所有手动创建的路径必须以 cwd 为根**，不得向上跳到 SKILL 目录或其他外部位置。

## 续跑任务

如果 history data files 已存在，默认走续跑，不得再开第二个 task-local；只有明确使用 `--force-new-task` 时才允许新开。
恢复真源顺序：

1. `task.json`
2. `state/route-state.json`
3. `state/route-plan.md`
4. `state/clues.md`
5. `state/progress.md`
6. `report.md`

然后执行 `node $TOOL_DIR/task-sync.mjs <task-id> ; node $TOOL_DIR/task-advance.mjs <task-id>`。
如果 `task-advance` 已给出 `execution.status / nextExecutableAction`，先执行它，再考虑对用户回复。

## 用户协作恢复协议

如果上一轮因为 `pauseCategory=user` 暂停，而用户本轮已经回复"已加载 / 已登录 / 继续 / 好了 / 完成了"这类协作完成信号：

1. 先执行 `node $TOOL_DIR/task-sync.mjs <task-id>`
2. 再执行 `node $TOOL_DIR/task-advance.mjs <task-id> --resume-from-user`（L1/L2 降级时 task-advance 不可用，改为手动更新 `route-state.json`：将 `pauseCategory` 设为 `none`、`execution.status` 设为 `ready-to-continue`，然后立即执行 `nextExecutableAction`）
3. 若状态变为 `ready-to-continue`，立即执行 `nextExecutableAction`
4. 若仍是 `blocked-on-user`，明确说明新的 `requiredUserAction / resumeCondition`

用户已完成协作动作后，继续保留旧 `blocked-on-user` 并回复"阶段进展"，视为错误恢复。

## 路径纪律

- **workspaceRoot 固定为当前 cwd**。触发 skill 时的当前目录即为唯一工作根，所有路径相对于此目录解析。
- 真实任务 artifact 以 `workspaceRoot/artifacts/tasks/<task-id>/` 为真源，**必须**创建在当前目录下。
- **绝对禁止**在 SKILL 包目录（含其任何子目录）中创建任务目录或写入交付物。
- 不要把正式交付物直接写到 workspace 根目录。
