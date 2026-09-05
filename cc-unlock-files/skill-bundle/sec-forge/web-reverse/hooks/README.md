# web-reverse 生命周期 hooks（可选 · Claude Code 专属适配层）

> ⚠️ **这是可选适配层，不是本技能的约束力来源。**
> 本技能设计为**通用技能**：在任何能读 SKILL.md / 调工具 / 跑脚本的 agent 上都成立。
> 它的约束力来自三处**与 harness 无关**的机制，而**不是** hook：
> 1. **report.md 只能由 `state/` 渲染**——不把线索写进 `state/clues.md` 就拿不出交付物；
> 2. **线索用通用 Edit 零摩擦追加到 `state/clues.md`**——记录成本趋近于零；
> 3. **完成=`verify-once.mjs` 跑通的副产品**——`task-close` 不通过验证不置 `delivered`。
>
> 下面这套 hook **只在 Claude Code 这类支持生命周期 hook 的 harness 上**提供额外的
> 确定性兜底。**没有它，技能也必须完整成立**——任何"反正有 hook 兜底"的设计依赖都是 bug。
> 因此本目录与 `.claude/settings.json` 属于**开发仓库自测脚手架 / CC 用户可选增强**，
> 不构成通用 skill payload 的一部分，SKILL.md 正文也不再引用它。

## 四件套（CC 可选增强）

| 事件 | 触发时机 | 动作 | 兜底的问题 |
| --- | --- | --- | --- |
| `SessionStart` | 会话开始 | 若 `cwd/artifacts/tasks/` 下有活跃任务，向上下文注入「先 `task-boot` 续跑」提醒 | 开始时漏初始化 |
| `Stop` | 模型每次停止回复前 | 对活跃任务自动 `task-snapshot`，刷新 `report.md` | 中止却没刷新 report.md |
| `PostToolUse` | 关键证据工具（js-reverse / ida-pro / radare2 / stealth-browser）调用后 | 自动 `task-snapshot` 做断点保护 | 中止后浪费 token 重分析 |
| `PreToolUse` | `Write/Edit/MultiEdit/NotebookEdit` 调用前 | 若目标文件父目录是 cwd 根且不在白名单，返回 `deny` 并提示写到 `artifacts/tasks/<task-id>/` | 产物散落 workspace 根 |

「活跃任务」= `cwd/artifacts/tasks/` 下 `task.json` 最近被修改的任务。

> 注意：这四件套都是**对通用机制的加速 / 兜底**，不是机制本身。
> 例如 `Stop`/`PostToolUse` 的 `task-snapshot` 只是**提前渲染** report.md；
> 线索的语义内容仍由模型通过编辑 `state/clues.md` 产生——hook 不会替你捕获线索。

`PreToolUse` guard 的两级执法（刻意保守，避免误伤）：

**L1 — 有标记目录（`.web-reverse-tool-dir` 或 `artifacts/tasks/` 存在）**：
- 视为「已初始化 workspace」，拦截所有非白名单的根目录写入。

**L2 — 无标记目录但已有 web-reverse 产物**：
- 视为「模型已跳过初始化并散落产物」，只拦截「看起来像 web-reverse 产物」的文件，不误伤普通文件；deny 理由附带初始化提示。

通用边界：
- 只拦「父目录正好是 cwd 根」的写入；子目录与 cwd 外路径放行；
- 解析不到 payload 时放行（不崩溃）；
- 只能拦 Write/Edit 类工具；Bash 脚本运行时写到根的输出拦不住——这部分由通用产物纪律约束。

## 部署（仅 Claude Code 用户需要）

- `.claude/settings.json` 是**项目级**配置：只在「以该目录为项目根」时生效。
- 在**本 skill 仓库**里默认生效，用于开发自测（仓库内无真实任务时三件套均为空操作）。
- 在**用户项目**里启用（可选）：把本仓库 `.claude/settings.json` 的 `hooks` 段复制进用户项目的
  `.claude/settings.json`，并把脚本路径改成 skill 包内 `hooks/web-reverse-hook.mjs` 的可达绝对路径。
- **不接 hook 完全不影响使用**：`task-note` / `task-snapshot` / `task-boot` / `task-close` 都是
  独立 CLI；通用约束力（report=state 渲染、零摩擦记录、verify 副产品）不依赖 hook。

## 给其它 harness 的通用集成点（非 hook）

如果你的 agent 不支持生命周期 hook，本技能的工具会把「下一步该做什么」打印到 **stdout**。
任何会把工具输出回灌给模型的 harness 都能据此自我驱动——这是 harness 无关的集成方式，
不需要任何特定 agent 的拦截能力。
