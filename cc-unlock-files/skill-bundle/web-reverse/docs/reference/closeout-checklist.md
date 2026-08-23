<!-- publish: framework -->
# Closeout Checklist

## task-snapshot 与 task-close 的分工（收尾机制）

SKILL.md 只保留 Close 的硬约束（三件套 + report.md 顶部必暴露字段），具体收尾机制以本节为准：

- **`task-snapshot` 只是中止快照**：随时把当前状态渲染进 `report.md`，但**不跑门禁、不标记完成**。当控制字段仍为 `pending-*`/空、或 workspace 根目录有散落产物时，它在 stderr 与 report.md 顶部打醒目告警（非阻断）。
- **散落产物的 relocate 行为**：本任务 boot 之后新增、落在 workspace 根目录的非白名单脚本/数据（红线 2），`task-close` / `verify-once` 会以 `rule=move-stray-artifacts-into-task-run-dir` BLOCK；`task-close` 还会自动把它们 `[relocate]` 进 `run/`。根目录白名单真源 = `tools/task/common.mjs` 的 `WORKSPACE_ROOT_ALLOWLIST`。
- **真正收尾必须跑 `task-close`**——除下文「硬门槛」外，它还会硬校验：`taskMode` / `primaryTopic` 非占位；`run/` 下存在成品脚本时，「逆向分析过程 / 主要算法说明 / 难点与对抗 / 调用示例」四段必须非空（不能停在 `⚠` 占位）。
- **四段叙事真源** = `state/narrative.md` 对应小节，每轮还原出新东西就往那里补，`task-close` 自动渲染进报告，不要手工往 `report.md` 贴叙述。

## 前置条件：状态完整性自检

Closeout 前必须先确认 route-state.json 不是"格式正确但内容为空/占位"：

1. `taskContract.objective` 非空且非 `TBD`
2. `executionModel` 至少包含 `currentState` 和 `primaryEntrypoint`
3. `acceptanceModel.claimLevel` 非空且与当前 `deliverableTier` 匹配：
   - `deliverableTier=A`（请求验收）→ `claimLevel` 至少为 `route-ready`，且已有至少 1 次成功请求证据
   - `deliverableTier=B`（内容/明文边界）→ `claimLevel` 至少为 `route-ready`，且已有明文边界验证证据
   - `deliverableTier=C`（浏览器内可控复用）→ `claimLevel` 至少为 `acceptance-ready`，且已有浏览器 harness 稳定复现证据
   - `deliverableTier=D`（本地复现/Port）→ `claimLevel` 至少为 `acceptance-ready`，且已有本地最小骨架运行证据
   - `deliverableTier=E`（纯算法提取）→ `claimLevel` 为 `delivered`，且已脱离浏览器验证通过
   - 不得在低交付梯度下要求高 `claimLevel`，也不得在高交付梯度下用低 `claimLevel` 蒙混
4. `route-state.json` 的 `execution.status` 非 `unknown`

**如果以上 4 项任一不满足**：先补齐 route-state.json，再进入 closeout；不得格式化一个空白 JSON 当"已同步"。
补齐时标注 `closeoutNote: "auto-repaired-from-report"` 表示字段从 report.md 逆推，置信度有限。

## 硬门槛

以下 8 项任一不满足，都必须阻断 `task-close`：

1. `task.json`、`report.md`、`run/fixtures.json` 存在且可读取
2. `taskContract.objective / deliverableTier`、`executionModel.currentState`、`acceptanceModel.claimLevel / acceptancePath` 已填写，且 `claimLevel` 满足前置条件 #3 中对应 `deliverableTier` 的等级要求（不得仅检查"非空"）
3. `report.md` 至少包含"当前阶段""任务契约""执行状态机""验收闭环""自动续跑决策""下一步"
   - **报告详实度四段**（"逆向分析过程""主要算法说明""难点与对抗""调用示例"）始终渲染（为空时显示告警占位）；当 `deliveryRequirements.reportDepth=deep` 时，这四段必须非空=硬门槛（软门槛见下）
   - 当 `run/` 下存在可执行成品脚本（`pure-*.js/py` 等）时，"调用示例"的「运行命令 + 预期输出」必须非空=硬门槛（与 `reportDepth` 无关）
4. `route-state.json` 存在，且与 `route-plan / clues / progress` 同步
5. `fixtures.json` 是合法 JSON
6. 命中专题后的必需产物已落盘，且不再是模板占位
7. `successCriteria` 至少命中一项
8. 命中特殊门槛时已满足：
   - `env` 任务已记录 `firstDivergence`
   - `vm` 深拆任务已有非零 `opcodeCoverage`
   - `vm` 黑盒任务已写明 `triageResult=blackbox`
   - `taskContract.disallowedFallbacks` 和 `acceptanceModel.userRejectedApproaches` 中的方案均未被用于最终交付

## 软门槛

以下只记为 `warnings`，不阻断 closeout：

1. `report.md` 使用了可兼容但非规范的节名变体
2. 复合任务的 `Entrypoint Loop` 叙述不完整
3. VM 黑盒路线未明确写出"黑盒复用边界"
4. 有可清理的模板占位文件或空 `.jsonl`
5. `reportDepth ∈ {brief, standard}` 时，报告详实度四段（逆向分析过程 / 主要算法说明 / 难点与对抗 / 调用示例）仍为告警占位而未填充（`reportDepth=deep` 时升为硬门槛）

## 自动修复

`task-close` 在 validation 前必须先执行：

1. 以 `route-state.json` 为真源，重写 `route-plan / clues / progress`
2. 若 `report.md` 缺失，则从核心模板补回
3. 若 workspace 根目录已有可复用脚本，而 task-local 中对应文件仍是模板占位，则先桥接 `run/*` 代理脚本
4. 补齐 `report.md` 的规范段：
   - `## 当前阶段`
   - `## 自动续跑决策`
   - `## 下一步`
   - `## 产物路径`
   - `## 逆向分析过程`（真源 `state/narrative.md`，回退 clues/retrospectives，否则告警占位）
   - `## 主要算法说明`（无条件渲染，真源 `state/narrative.md`，否则结构化骨架告警占位）
   - `## 难点与对抗`（真源 `state/narrative.md`，回退 retrospectives，否则告警占位）
   - `## 调用示例`（真源 `deliveryRequirements` + `run/` 成品脚本 + `state/narrative.md`，否则告警占位）
5. 对复合任务补齐 `## 切入点循环`
6. 对本地复现任务补齐 `## 本地复现交付`

### 自动修复的安全边界

自动修复**不得**做以下操作（防止从垃圾状态生成垃圾交付物）：

- **不得**凭空创建 route-state.json 的内容（如果 `objective` / `currentState` / `claimLevel` 为空，必须报错而非填占位值）
- **不得**在没有验收证据的情况下将 `claimLevel` 升级为 `delivered`
- **不得**删除或覆盖用户手动创建的非模板 artifact 文件
- **不得**在 `acceptanceGap` 仍非空时将任务标记为完成

如果 route-state.json 不满足前置条件，自动修复必须：
1. 输出明确的缺失字段清单
2. 要求先补全再重试 closeout
3. 不得静默跳过

## Cleanup

closeout 成功后自动执行：

- 删除 `*.tmp`
- 删除 `*.bak`
- 删除 `node_modules/`
- 删除 `__pycache__/`
- 删除 `run/` 下仍与模板完全一致的占位文件
- 删除空的 `.jsonl` 占位文件
