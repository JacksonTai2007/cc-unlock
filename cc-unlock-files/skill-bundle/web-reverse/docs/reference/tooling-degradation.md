# 工具降级与自举

> SKILL.md「工具降级与自举」段的完整操作手册。主文件只保留降级铁律摘要；具体分级标准、自诊断步骤、路径纪律在此。

本 skill 依赖 `tools/task/*.mjs`、`tools/qa/*.mjs`、`npm run check` 等工具链执行契约。
当工具不可用、Node 版本不足、或路径解析失败时，执行契约不应直接崩溃，而是降级运行。

## 降级层级

| 层级                | 条件                                   | 行为                                                                                                                                                                    |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0 全量**   | Node >= 20 且 `tools/task/` 完整可用 | 开机统一走 `task-boot`（内部已串起 task-init/resume → task-sync → task-advance，见 SKILL.md 红线1）；task-start / task-sync / task-advance 是其内部子步骤，**仅 L1/L2 降级手动拆解时才单独调用**；assert-can-reply 照常用于回复门禁 |
| **L1 基础**   | Node 可用但部分 task 工具缺失或报错    | 跳过 task-sync / task-advance / assert-can-reply；手动从 `artifacts/tasks/<task-id>/task.json` 和 `state/route-state.json` 读取状态；继续执行但声明当前处于降级模式 |
| **L2 最小**   | Node 不可用或工具全部不可用            | 以 SKILL.md 文本规则为真源；从 task-local 文件手动恢复状态；明确告知用户当前缺少工具链支持，并在 `report.md` 中标注 `toolingLevel=L2`                               |
| **L3 纯契约** | 全新任务且无工具链                     | 先确认用户目标与交付梯度，手动创建 `artifacts/tasks/<task-id>/` 结构；不阻塞在工具链上；任务完成后提醒用户在有工具链的环境中运行 `task-close`                       |

## 工具降级纪律

- 不得因为工具不可用而拒绝执行任务
- 降级后必须在 `report.md` 中显式标注当前 `toolingLevel` 和缺失的工具
- L1/L2 降级时，`reply gate` 和 `auto-advance` 纪律仍然通过文本规则生效——不能因为 `assert-can-reply.mjs` 不可用就跳过回复门禁
- L2/L3 降级时，"已完成 / 已交付"声明仍然需要通过验证门禁：至少要有 `verify-once.mjs` 或等效的验收脚本成功运行

### 搜索能力降级（web-search MCP 为可选加速面，非硬依赖）

`web-search` MCP（`mcp__web-search__search_bing` / `mcp__web_reader__webReader`）是**搜索的首选加速面，不是硬依赖**。标准环境缺该 MCP 时不得死锁：

- 当 `web-search` MCP 不可用 / 未连接，或 `check-search-gate.mjs` 本身不可用（L1/L2/L3）时，**明确允许用 `WebSearch` 或任意可用联网工具**（含 `web_fetch` 等）满足搜索门禁的"已搜索"判据——门禁判定的是"是否搜过 + 是否留下决策"，不绑定具体由哪个 MCP 执行
- 用替代工具搜索后，仍按 `references/web-search-tool.md` 的落盘要求写 `state/external-research.md` / `state/external-research.json`，并更新 `route-state.json` 的 `searchRounds` / `lastSearchRound` / `searchDecision`（`check-search-gate.mjs` 校验的是这些状态字段，与搜索工具来源无关）
- 仅当**完全无任何联网能力**时，才在 `report.md` 标注 `searchToolReady=false` 并把"缺搜索能力"作为一行可读诊断，而不是反复换关键词空转或拒绝推进
- 不要把"`web-search` MCP 没起来"当成"搜了但没结果"，也不要因此触发硬门禁死锁——这是环境能力降级，按本节用替代工具补齐即可

## 工具链自诊断

每轮开始或恢复任务时，执行以下诊断步骤确定当前 toolingLevel（不是凭感觉判断"工具不可用"）：

**Step 0 — 发现工具目录**：工具链与任务目录分离，先定位工具链所在目录：

1. **检查 cwd 下是否有工具链**：`ls tools/task/task-start.mjs`（相对 cwd）
   - 如果存在 → `TOOL_DIR=./tools/task/`
2. **如果 cwd 下没有**：向上递归查找包含 `SKILL.md` 的目录作为 `SKILL_ROOT`
   - `SKILL_ROOT` 存在且包含 `SKILL_ROOT/tools/task/` → `TOOL_DIR=$SKILL_ROOT/tools/task/`
3. **如果都找不到** → 工具链不可用，跳到 Step 4 定级为 L2/L3

**Step 1 — 检查 Node 版本**：`node --version`，确认是否 >= 20

**Step 2 — 检查 task 工具完整性**：`ls $TOOL_DIR/task-start.mjs $TOOL_DIR/task-sync.mjs $TOOL_DIR/task-advance.mjs $TOOL_DIR/assert-can-reply.mjs`，4 个核心工具是否全部存在

**Step 3 — 试运行 task-sync**：若有 task-id，运行 `node $TOOL_DIR/task-sync.mjs <task-id>` 是否正常退出（exit code 0）；若无 task-id（全新任务），跳过此步

**Step 4 — 根据结果定级**：

- 步骤 0~3 全部通过 → L0
- Node >= 20 但部分工具缺失/报错 → L1
- Node 不可用或工具全部不可用 → L2
- 无 task-id 且 Node 可用但无工具链 → L3（全新任务，手动创建 task-local 结构）

**Step 5 — 将诊断结果写入 `report.md`**：`toolingLevel: L0/L1/L2/L3` + `toolDir: $TOOL_DIR` + 缺失项清单（如有）

诊断步骤本身不需要工具链支持——只用 `node --version` 和 `ls` 即可完成。禁止在未执行以上步骤的情况下宣称"工具不可用，降级到 L2"。

## 工具调用路径纪律

- **任务数据目录** = `$(pwd)/artifacts/tasks/<task-id>/`（始终在 cwd 下）
- **工具链目录** = `$TOOL_DIR`（通过 Step 0 发现，可能在 SKILL 包目录）
- **所有工具调用**必须使用完整路径：`node $TOOL_DIR/<tool>.mjs <task-id>`
- 工具接收 `<task-id>` 字符串参数，在 cwd 下自动解析 `artifacts/tasks/<task-id>/`
- **禁止**在工具调用时依赖相对路径解析工具位置
- 工具目录发现后，用 Bash 的 `realpath` 获取绝对路径，写入 cwd 根目录的 `.web-reverse-tool-dir`。写入命令：`realpath "$TOOL_DIR" > .web-reverse-tool-dir`（Windows 用 `cd "$TOOL_DIR" && echo %cd% > .web-reverse-tool-dir`）。此文件是运行时元数据，不是任务交付物。后续调用工具前优先读取该文件，若存在则直接使用其中的路径，跳过 Step 0。
