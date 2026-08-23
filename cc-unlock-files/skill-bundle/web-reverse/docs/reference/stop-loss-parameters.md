<!-- publish: framework -->
# Stop-Loss Parameters

所有停损参数的单一致源。其他文件引用此文件中的数值，不得自行定义。

## 停损轮次（按阶段）

| 阶段 | 任务特征 | 停损轮次 | 说明 |
|------|---------|---------|------|
| **Foundation（通用）** | hook 基础设施、carrier 追踪、entrypoint mapping | 连续 2 轮无新增基础 mapping/infrastructure → pivot；连续 4 轮无法进入 probe → 强制 retrospective | 不产生直接验收证据，但缺少则后续无法推进 |
| **Foundation（VM/WASM）** | WASM export/import/memory 枚举、VM dispatcher/handler table 定位、动态 import/Blob URL 追踪 | 连续 2 轮无新增基础 mapping → pivot；连续 8 轮无法进入 probe → 强制 retrospective | VM/WASM 的 export 枚举、内存布局探索、dispatcher 定位本身消耗 6~8 轮是正常的 |
| **Probe** | 已有 hook/carrier/entrypoint，做具体假设验证 | 连续 2 轮无新增验收证据 → pivot 或 retrospective | — |
| **Deep-Dive** | 已开启 `deepDivePermit` 的微路线 | 按 permit 的 `maxRounds`（默认 4~6）和 `exitCondition` 管理；连续 2 轮无新增高价值证据 → 结束 permit | 只作用于当前微路线 |

## Foundation 硬性完成标准

以下 3 项**全部满足**才能从 Foundation 升级到 Probe（不能只满足其中 1~2 项）：

1. **Hook 触发验证**：至少 1 条 hook 已在真实页面中触发，输出包含目标字段或目标调用参数（非 mock 环境、非空转、非 console.log 占位）
2. **Carrier 链路追踪**：已从触发点追踪到至少 1 个下游关键调用点（`request-use / sign-call / decrypt-call / payload / dispatch`），且满足以下最低标准：
   - 记录了触发点的输入参数（或参数类型/形状，如参数被混淆）
   - 记录了至少一个中间跳转点（如果触发点与目标调用点之间经过其他函数/模块）
   - 记录了下游关键调用点的调用参数（至少包含目标字段或目标数据的传递证据）
   - 仅记录"触发点→XHR 发送"一跳、且中间过程完全未知的，不算满足此标准
3. **Entrypoint 覆盖**：已对至少 2 个候选 entrypoints 完成初步评估（含成本、信息增益、复用价值排序），且当前活跃 entrypoint 不是"唯一猜测"

VM/WASM 任务额外要求：
4. **WASM export/import/memory 已枚举**（如涉及 WASM）
5. **VM dispatcher/handler table 已定位**（如涉及 JSVMP）

未满足以上任一标准前，不得宣称"已进入 Probe"，继续按 Foundation 停损规则管理。

## Probe 冷却期

从 Foundation 升级到 Probe 后的**第一轮**为"Probe 第 0 轮"（观察轮）：

- 观察轮不计入 Probe 的 2 轮停损计数
- 观察轮的目标：确认 foundation 建立的 hook/carrier 在 probe 场景下仍然有效、验证 entrypoint 排序在实际 probe 中成立
- 观察轮结束后，下一轮正式开始 Probe 计数（Probe 第 1 轮）
- 如果观察轮中发现 foundation 不完整（hook 空转、carrier 链路断裂、entrypoint 排序被推翻），允许**降回 Foundation** 补充，不计入降级次数

此冷却期防止"刚升级就因为观察不充分而触发 2 轮停损→误 pivot"。

**循环上限**：Foundation → Probe（观察轮）→ 降回 Foundation → 再次 Foundation → Probe（观察轮）的循环最多执行 **2 次**。第 2 次从观察轮降回 Foundation 后，不得再次宣称"Foundation 完成并进入 Probe"——必须切换 entrypoint 或触发 retrospective。此上限防止在 Foundation/Probe 边界无限循环消耗轮次。

## 降级缓冲

降级后在新梯度至少执行 **3 轮**才能再次降级：

- 降级后的前 3 轮为"梯度适应期"
- 适应期内**不触发**该梯度的停损 pivot（即连续无证据不导致强制 pivot），但每轮仍需产出有效推进记录（至少：本轮做了什么 probe、观察到了什么、是否更接近验收）
- 适应期内**不豁免**该梯度的有效推进要求——连续 3 轮零推进记录仍然触发 retrospective
- 第 4 轮起正常计轮，停损规则全面恢复
- 适应期内发现"当前梯度仍然太高"，允许提前降级——但必须满足：(a) 当前梯度的核心交付路径已被证明不可行（非"还没试过"）、(b) 有具体证据（如 hook 输出显示关键数据在浏览器侧生成且无法本地复现）、(c) 降级理由不是"感觉不对"或"进度慢"
- 连续两次"提前降级"（在适应期结束前就降级）触发强制 retrospective——防止通过连续提前降级绕过缓冲
- 此规则防止降级螺旋：刚降级 → 1 轮不适应 → 再降级 → 最终降到请求验收以下

降级时必须声明：
- 原梯度 → 新梯度
- 为什么当前梯度太高（具体证据，非主观判断）
- 哪些高成本路线被暂停（不是永久放弃）
- 降级后的最小交付目标

## 阶段回退协议

允许从高阶段主动回退到低阶段，保留已建立的 infrastructure：

| 回退触发条件 | 回退路径 | 保留内容 |
|-------------|---------|---------|
| Foundation 不完整（hook 空转、carrier 链路断裂） | Probe → Foundation | 已建立的 hook 脚本、carrier 追踪日志、entrypoint 评估记录 |
| 关键未知项仍在会话态/生命周期/request-use，不是算法边界 | PureExtraction → 浏览器可控复用 | 已提纯的算法片段、已建立的边界映射 |
| 连续 2 轮 probe 无证据 + 交付梯度与验收目标不匹配 | 当前梯度 → 下一低梯度 | 所有已验证的 hook/carrier/entrypoint 链路 |
| 当前深拆路线的成本超过对最终交付增益的 2 倍估算 | Deep-Dive → Probe | 已建立的 microRoute mapping、highValueEvidence 记录 |

回退纪律：
- 回退不是"放弃"，是"换一条更便宜的路"
- 回退时必须写出：回退原因、保留内容清单、回退后的第一条 probe
- 回退到 Foundation 后，按 Foundation 停损规则重新计数
- 回退到 Probe 后，第一轮为"回退观察轮"，不计入 Probe 的 2 轮停损——确认回退后的 probe 方向有效后再开始计数
- 回退不需要 retrospective，**除非**回退原因是当前 entrypoint 被证明完全不可行（非"暂时不完整"）——判断标准：同一个 entrypoint 在回退后再次尝试仍无进展，此时应切换 entrypoint 并触发 retrospective
- 仅 foundation 不完整导致的 Probe→Foundation 回退：不需要 retrospective，补充 foundation 后继续
- entrypoint 选择错误导致的回退（如 hook 面完全不匹配目标语义层）：需要 retrospective，重新评估 entrypoint 排序

## Deep-Dive Permit（深拆许可）

深拆（dispatcher/bytecode 等微路线）属于高成本路线，必须先开 `deepDivePermit` 才能进入，permit 只作用于**当前微路线**。开 permit 时写明以下五字段：

| 字段 | 含义 |
|------|------|
| `subgoal` | 本次深拆要解决的具体子目标（不是泛泛"看懂 VM"） |
| `milestone` | 可观测的里程碑（拿到什么证据算阶段达成） |
| `maxRounds` | 本微路线轮次上限（默认 4~6，见参数汇总） |
| `exitCondition` | 退出条件（达成 / 超轮 / 连续 2 轮无高价值证据） |
| `expectedHighValueEvidence` | 预期的高价值证据形态（dispatcher 映射、handler 语义、可复用产物等） |

**回退协议**：permit 结束（达成、超 `maxRounds`，或连续 2 轮无高价值证据）后，**回退到上一可验收层**——黑盒复用 / 浏览器内可控复用 / Node 侧复用，并触发 retrospective 重选入口，**不要在原微路线硬顶**。详细回退路径见上文「阶段回退协议」表（Deep-Dive → Probe 行）。

## 「有效推进」判定（区分新线索 vs 同一失败的新变体）

停损计数的关键是判定每轮是否**有效推进**——不是"这轮有没有产出动作 / 新脚本 / 新数字"，而是"是否真的逼近验收"。以下统一归入**不算有效推进**：

- 更细的 slot/selector 解释、更多同层低价值 hook、只在 Browser/Node 差异上细化但不逼近交付（见「停损」高频自检）。
- **更换图像识别算法/参数（或换识别库、调阈值、改预处理）但端到端通过率仍为 0**——同一识别/求解路线连续多轮产出"新脚本 + 新数字"却始终未通过服务端验收，属于**同一失败的新变体**，不是新线索。判据：成品脚本内容变了，但端到端结果仍为失败（`claimLevel` 未达 `acceptance-ready` 且 `acceptanceModel.acceptanceGap` / `completionBlockedBy` 非空）。
- 同理，任何"换实现但验收边界未移动"的迭代（换签名实现、换补环境壳、换求解器但请求/校验仍失败）都按同一失败变体计，不解除停损。

> **机械门禁落点**：上述第 2/3 条不只靠文档自觉——`tools/task/task-snapshot.mjs --round` 在判定 `madeProgress` 时已落地此规则：当 run/ 下成品脚本（pure-*/求解器）内容指纹变化、但端到端仍失败时，**该轮不计入有效推进（不推进 `lastProgressRound`）**，`roundsSinceProgress` 照常累加并逼近停损/搜索闸。换言之"每轮换算法刷出新脚本"无法再绕过停损。

## 参数汇总

| 参数 | 值 | 适用范围 |
|------|----|---------|
| Foundation 通用 maxRounds | 4 | 通用任务 |
| Foundation VM/WASM maxRounds | 8 | VM/WASM/混淆任务 |
| Foundation 连续无新增 pivot 阈值 | 2 轮 | 所有 Foundation |
| Probe stop-loss 阈值 | 2 轮 | 所有 Probe |
| Deep-Dive 默认 maxRounds | 4~6（per permit） | 所有 Deep-Dive |
| Deep-Dive 连续无高价值证据阈值 | 2 轮 | 所有 Deep-Dive |
| Probe 冷却期 | 1 轮 | Foundation→Probe 升级后 |
| 降级缓冲 | 3 轮 | 任何降级后 |
| Foundation→Probe 循环上限 | 2 次 | Foundation/Probe 边界 |
| 连续提前降级触发 retrospective 阈值 | 2 次 | 任何降级后 |
| roundsInCurrentGradient（计数器） | 梯度变更时重置为 0 | executionModel |
| roundsInCurrentTier（计数器） | 层级变更时重置为 0 | executionModel |
| Entrypoint 活跃上限 | 2 | 所有阶段 |
| Entrypoint maxRounds（Foundation 通用） | 4 | 通用 Foundation |
| Entrypoint maxRounds（Foundation VM/WASM） | 8 | VM/WASM/混淆 Foundation |
| Entrypoint maxRounds（Probe） | 2 | 所有 Probe |
| 候选 entrypoints 最小数 | 2 | Observe/Foundation |
| 同类脚本/样本衍生上限 | 3 | 所有阶段 |

## 引用纪律

- SKILL.md、reverse-workflow.md、retrospective-protocol.md、deliverable-ladder.md、task-contract-system.md 中的停损数值**必须**与此文件一致
- 修改停损参数时，只改此文件；其他文件通过引用保持同步
- 如果某文件出现与此文件不一致的数值，以此文件为准
- 其他文件中的速查表内联数值属于**便利拷贝**，不具权威性——每次引用速查表数值前，必须交叉验证此文件
- 速查表中的数值与此文件冲突时，以此文件为准，且速查表视为过期需更新
- 新增停损相关规则时，先更新此文件，再同步到其他文件
