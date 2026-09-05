<!-- publish: framework -->
# Reverse Workflow

这是新方案下的执行协议。

## 阶段总览

0. `RouteSync`
1. `Observe`
2. `Capture`
3. `Rebuild`
4. `Patch`
5. `PureExtraction`
6. `Port`
7. `Close`

> **开机口径（与 SKILL.md 红线1 对齐）**：`RouteSync` 这一步在 L0 由 `task-boot` 一次完成——boot 内部已串起 task-init/resume → task-sync → task-advance，**不要逐个手调**。下文及 `Entrypoint Loop` 出现的 task-start/task-sync/task-advance 是 boot 的内部子步骤，仅在 L1/L2 降级（工具部分缺失、需手动维护 state）时才单独拆开调用。续跑时不重复 boot，直接执行 `task-advance` 输出的 `nextExecutableAction`。

## 总控制规则

- 每一轮都以**是否更接近最终验收**为判断标准
- 每个阶段结束先回写 `route-state / route-plan / clues / progress / report`
- 若本轮做过外部搜索，再回写 `state/external-research.md/json`
- 若本轮做过 knowledge 检索，再回写 `state/knowledge-refs.json`
- 若本轮做过 retrospective，再回写 `run/retrospective.md`
- 然后刷新 `execution.status`
- 若 `execution.status=ready-to-continue` 且 `pauseCategory=none`，就在同一轮继续执行
- 不要把"本轮总结"当作暂停点

## 每轮最小控制包

每轮结束前，至少要能回指出：
- 本轮相对上一轮，是否更接近验收边界
- 当前主假说及其保留/降级状态
- 当前最贵的未知项
- `activeEntrypoints / entrypoint status / execution.nextEntrypointId / execution.nextExecutableAction`
- `acceptanceGap / nextEvidenceGate`
- 如果下一轮仍不收敛，准备停掉哪条路线
- 当前处于 foundation / probe / deep-dive 哪一层

没有这组控制包，就说明本轮没有形成可复用闭环。

## 进入 Observe 前先完成的分类动作

- 选定 `taskMode`
- 选定 `deliverableTier`
- 选定 `primaryTopic / secondaryTopics`
- 定义当前 `activeEntrypoint`
- 明确最小 probe 与成功判据

如果这些分类明显不稳，允许先做一次低成本 triage、knowledge 检索或全网搜索纠偏（用环境内可用的 web 搜索能力执行，如有 `mcp__web-search__search_bing` 则用它，见降级表），但不要在分类未定时直接扩建大量脚本。

## 回复纪律

- 不得用"我会继续 / 下一步继续 / 我将自动推进"代替动作
- 不得把“我会继续 / 我将自动推进 / 下一步继续”当作阶段收尾
- 在 `ready-to-continue` 时，不得给出仅状态型回复
- 回复前先运行 `node tools/task/assert-can-reply.mjs <task-id>`（L1/L2 降级时，执行 SKILL.md "回复与完成门禁" 中定义的 6 条硬检查，必须逐条核对不得跳过）
- 最终收尾前运行 `assert-can-reply --require-validated-deliverable`（L1/L2 降级时，执行硬检查第 6 条：验证脚本成功运行 + fixtures 存在 + acceptanceGap 为空）
- 如果本轮允许暂停，必须把 `replyGateDecision / blockingAction / requiredUserAction / resumeCondition` 写成精确动作，而不是抽象地说"需要协作"
- 任何“已落盘 / 已更新 / 已打通 / 已成功”的表述，都必须先经过文件存在性或验证结果自检

## 路由推进控制

### Entrypoint Loop

默认使用：`Hypothesis -> Probe -> Evaluate -> Pivot -> Retry`

最小纪律：
1. 先列 2~5 个候选 entrypoints
2. 同时只保留 1~2 个活跃 entrypoints
3. 单轮先做最便宜 probe（Foundation 阶段除外：Foundation 优先信息增益最高的入口）
4. 有效就扩展；无效就 `PARKED / EXHAUSTED`
5. 全部失效后先做 retrospective，再生成新 entrypoints

每轮至少把 `activeEntrypoints / entrypoint status / execution.nextEntrypointId / execution.nextExecutableAction` 写回 route-state 或报告；否则 entrypoint loop 只存在于脑内。

### Topic / Reference Budget

- 默认 `1` 个主专题 + `0~2` 个辅助专题
- 参考文档按当前主模式按需加载，不要一次性读完整个 `references/`
- 如果主专题不再直接服务活跃 entrypoint，应先重选专题，再决定是否继续当前脚本族
- 如果当前 `deliverableTier` 已被证明过高，应先降级到更贴近验收的梯度，再决定是否继续当前深拆路线
- 选专题时优先回答：**哪个专题最直接缩短到当前活跃 entrypoint 的验收证据**

### Knowledge 检索

在开启新 probe 或做外部搜索前，先检索本地经验：
- task-local 历史（route-plan / clues / progress / retrospective）
- knowledge cards（`artifacts/knowledge/cards/` 中匹配 feature bundle 的卡）
- 命中则提取 entrypoint hints / probe drafts / known pitfalls
- 未命中标记 `knowledgeGap=true`，不阻塞推进

### 全网搜索升级

满足以下任一条件时，立即用环境内可用的 web 搜索能力（如有 `mcp__web-search__search_bing` 则用它，具体见降级表）进行全网搜索：
- 同一路线在 probe 阶段连续 2 轮没有逼近验收；若当前为已开启 `deepDivePermit` 的 VM / WASM / 混淆微路线，则改为"当前 microRoute 连续 2 轮没有新增高价值证据"
- 命中 provider / SDK / protocol 家族高信号
- 出现 `baseline_ok_generated_rejected`、`silent reject`、`200 + 空体`
- 需要借助公开资料纠正 entrypoint / provider / protocol 判断
- 本地 knowledge 检索未命中且 `knowledgeGap=true`

搜索后立即：记录命中的 provider/family、修正 topic/entrypoint 排序、形成新 probe，然后回到 entrypoint loop 继续执行。不得搜索后维持原假说却不说明理由。

### Retrospective Trigger

满足以下任一条件时，必须先做 retrospective：
- 同一 entrypoint 或同一主假说在 probe 阶段连续 2 轮没有新增验收证据；foundation 阶段放宽为连续 2 轮没有新增基础 mapping/infrastructure
- 同一 entrypoint 在 foundation 阶段连续 4 轮（VM/WASM：8 轮）仍无法升级到 probe
- 活跃 entrypoints 全部 `PARKED / EXHAUSTED`
- 同一假说衍生出多份脚本 / 样本，但没有拉近交付
- 当前 `taskMode / deliverableTier` 明显选错
- 触发阶段回退且回退原因涉及 entrypoint 选择错误（仅阶段级调整不需要 retrospective）

Retrospective 最少要产出：
- 已废弃假说
- 保留证据
- 新主模式 / 新主专题 / 新 entrypoint 排序
- 下一轮最便宜 probe
- 是否切到全网搜索（用环境内可用的 web 搜索能力，如有 `mcp__web-search__search_bing` 则用它，见降级表）或 browser-controlled reuse
- 若问题发生在某条 `microRoute`，必须写清停掉的是哪条微路线
- 若当前处于 `deepDivePermit`，还必须写清 `maxRounds / expectedHighValueEvidence / permit 是否续期`
- 若当前跳过过 `完整边界确认 / 标准家族识别 / direct-call / 搜索纠偏 / knowledge检索`，要补记跳过原因
- 若触发原因是阶段回退，写清回退路径、保留内容、回退后第一条 probe

### 停损规则：区分阶段

停损参数以 `docs/reference/stop-loss-parameters.md` 为单一致源。以下为速查摘要，完整定义、硬性标准、冷却期、降级缓冲、回退协议见该文件。

| 阶段 | 停损轮次 | 有效推进的定义 | 例外 |
|------|---------|--------------|------|
| **Foundation（通用）** | 连续 2 轮无新增基础 mapping / infrastructure / carrier 追踪 → pivot | 新增 hook 面、carrier 追踪、entrypoint mapping | 连续 4 轮仍无法进入 probe → 强制 retrospective |
| **Foundation（VM/WASM）** | 连续 2 轮无新增基础 mapping → pivot | 同上 + WASM export/memory/table 枚举 + VM dispatcher 定位 | 连续 8 轮仍无法进入 probe → 强制 retrospective |
| **Probe** | 连续 2 轮无新增验收证据 → pivot（第 0 轮观察轮不计入） | 新请求验收证据、新本地复现能力、靠近纯算法边界的证据、直接服务交付的新脚本/样本 | — |
| **Deep-Dive** | 连续 2 轮无新增高价值证据 → 结束 permit | 新语义边界、新 import/export/thunk mapping、新 direct-call、新 clear-boundary/request-use | 按 permit 的 `maxRounds / exitCondition` 管理 |

以下默认不算有效推进（无论哪个阶段）：
- 更细的 slot / selector / patch family 解释
- 更多同层低价值 hook
- 只是在 Browser / Node 差异上继续细化，但没有逼近交付

#### Foundation 硬性完成标准

以下 3 项**全部满足**才能从 Foundation 升级到 Probe：
1. **Hook 触发验证**：至少 1 条 hook 在真实页面中触发，输出包含目标字段/参数
2. **Carrier 链路追踪**：已从触发点追到至少 1 个下游关键调用点，且记录了入参→中间跳转→下游参数的传递证据（仅一跳且中间未知不算满足）
3. **Entrypoint 覆盖**：已对 ≥2 个候选 entrypoints 完成初步评估

VM/WASM 额外要求：WASM export/import/memory 已枚举、VM dispatcher/handler table 已定位。

#### Probe 冷却期

Foundation → Probe 升级后的第一轮为"Probe 第 0 轮"（观察轮），不计入 Probe 的 2 轮停损。观察轮中如发现 foundation 不完整，允许降回 Foundation 补充，不计入降级次数。

#### 降级缓冲与阶段回退

降级后在新梯度至少执行 3 轮才能再次降级。允许从高阶段主动回退到低阶段（保留已建立的 infrastructure），回退不等于放弃。详见 `docs/reference/stop-loss-parameters.md`。

### 高价值证据与微路线

典型 `microRoute` 包括：
- `dispatcher naming`
- `handler clustering`
- `wasm export -> thunk -> table mapping`
- `init side-effect recovery`
- `string decoder chain`
- `control-flow flattening recovery`
- `offset / slot / sample statistics`

以下任一项通常可视为高价值证据：
- 新的语义边界
- 新的 import / export / thunk / table / internal mapping
- 新的 direct-call 命中
- 新的 first divergence
- 新的 side-effect / init state 闭环
- 新的可复现输入输出对
- 新的最小可运行骨架
- 新的可直接服务最终验收的 clear boundary / request-use / business action 证据

以下内容默认不算高价值证据：
- 更多 offset / slot / case label 命名
- 更多相似样本
- 更整齐的去混淆结果，但没有连到业务边界
- 更多 wasm 函数列表，但没有 mapping / direct-call
- 更多 handler 数量，但没有聚类、调用关系或语义提升

### 语义优先级

默认按离验收边界的距离选择切入点：
1. `request-use`
2. `sign-call / decrypt-call`
3. `payload / clear boundary`
4. `dispatch / action`
5. `reader`
6. `writer`
7. `bridge / carrier`
8. 低层 DOM / storage / script surface

同层 surface 间切换不算真正 pivot，只算同类低层 hook 重试。
同一家族低层 hook 默认最大 2 轮。

## 各阶段要求

### RouteSync
- 恢复 task-local 真源
- 同步 Markdown 视图
- 刷新 `nextExecutableAction`
- 恢复 `taskMode / deliverableTier / primaryTopic`
- 检查 `userRejectedApproaches / disallowedFallbacks`，排除被否决方案

### Observe
- 识别目标与症状
- 提取 feature bundle
- 建立候选 entrypoints
- 明确最小 probe 与成功判据
- 检索本地 knowledge（task-local 历史 + knowledge cards）
- 若路线明显模糊，可发起一轮全网搜索纠偏（用环境内可用的 web 搜索能力，如有 `mcp__web-search__search_bing` 则用它，见降级表）
- Observe 阶段的目标不是"多看一点"，而是尽快形成正确工作面
- 如果当前证据只来自局部切片（如前 256 字节、单个 offset diff、单个 NAL type），所有规律都只能标记为 `provisional`
- 在完成完整边界确认前，不得把局部规律升级为全局算法结论

### Capture
- 优先高语义 hook
- 优先命中**高语义 hook 面**
- 优先采样直接服务验收的输入、输出、中间值
- 对 stateful signer / decryptor 优先恢复 `carrier -> writer -> state -> reader -> request-use`
- 默认捕获完整输入输出；若 Hook 自动截断（如只记录前 256 字节），必须明确标注"样本已截断，完整范围未确认"
- 至少保留 3 对可交叉验证样本
- 对视频 / 音频 / 分片流，尽量保留 `manifest -> segment -> PES/NAL/frame` 三层映射
- 在样本存在截断标注的情况下，不得基于截断样本建立"算法只改了 N 字节"的全局假说
- 若准备编写第 2 个同类样本分析脚本 / 统计脚本，必须先更新假说台账并重新评估 `familyShortlist / directCallDecision / searchDecision`

### Rebuild
- 把浏览器证据导出成最小本地骨架
- 只重建当前验收真正需要的最小链路；若涉及加密 / 解密 / 签名 / WASM，先确认算法族、完整样本、外部搜索与公开分析适用性
- 不要为了"更完整"而无限扩 rebuild 范围
- 若当前主模式仍是浏览器可控复用，不要提前把任务升级成纯算法深拆
- 目标是复现最小调用链、关键输入输出、以及第一处有效分歧

### Extract（仅 D/E 模式走「扣代码」路线时）
- 触发条件：目标函数夹在打包/混淆 bundle 里，需把它**连同传递依赖从 bundle 抽出在 Node 单跑**（而非整段 bundle + 补环境）
- 先在 `references/composite-triage-playbook.md`「Rebuild 路线三岔决策」确认该不该扣（依赖闭包 ≤ N、不深绑 DOM/网络/会话态 才扣；N 见下）
- 手法：webcrack unbundle 打底 → webpack 运行时劫持 dump `__webpack_modules__`（目标在异步 chunk 时先 `__R.e(chunkId)` 加载再 dump）→ 递归抽依赖闭包 → 搭最小 require shim，详见 `references/closure-extraction-playbook.md`
- 产出契约：`run/extracted-closure.js` + `run/closure-manifest.json`（入口签名 / 闭包模块 id / **仍需补的外部符号清单** / `externalSymbolCount`）
- 阈值：`externalSymbolCount ≤ N` 且不深绑 DOM/网络 → `canPatchEnv: true`，handoff 进 Patch（补环境）；否则回退 D 模式整段 bundle + 补环境，别硬扣。**N 的 canonical 定义见 `references/closure-extraction-playbook.md` §0（默认 ~30），不在此另定数值**
- 纪律：没产出 `run/extracted-closure.js` + 契约就进 Patch/Verify = 把"扣了一半"当 Rebuild 完成，必然返工

### Patch
- 只按 `first divergence` 修补
- 显式 env error 消失但验收仍失败时，停止泛补环境，回到 Capture
- Patch 由 `first divergence` 驱动，不由"看到什么就补什么"驱动
- 先判断是"真实缺失"还是"错误 present"
- 未经浏览器证据确认的未知全局，不要默认补成 stub

### PureExtraction
- 在 local rebuild 稳定后再进入
- 目标是锁定纯算法边界
- PureExtraction 只在当前 local rebuild 已稳定、且浏览器复用 / 本地骨架已不足以满足交付时进入
- 如果浏览器 harness 已稳定逼近验收，且用户只需要请求成功，不要强行进入 PureExtraction

### Port
- 把已提纯边界迁移到 Python / Node / 其他宿主
- 关注可运行、可复现、可验证
- Port 的成功标准不是"理解了内部原理"，而是：可运行、可复现、可验证

### Close
- 先核对当前 `deliverableTier` 已满足，再补齐 `report.md`、`run/verify-once.mjs`、`run/fixtures.json`
- 若用过搜索，补齐 `state/external-research.*`
- 若做过 knowledge 检索，补齐 `state/knowledge-refs.json`
- 若做过 route-level retrospective，保留 `run/retrospective.md`
- 通过验证后再收尾
- 不要把"报告已写完"误当 Close 完成

## VM / WASM / DRM 特别规则

默认优先级：
1. 浏览器黑盒复用
2. 明文边界 / clear boundary / appendBuffer / request-use
3. 浏览器内可控复用（Puppeteer/Playwright 精细化操控）
4. Node 复用原始 worker / wasm
5. 纯算法提取
6. 最后才是 dispatcher / slot / bytecode 深拆

如果前 1~3 已足以完成验收，不要继续深拆。

VM / WASM 任务的 foundation 阶段（WASM export/memory/table 枚举、VM dispatcher 定位、carrier 识别、动态 import/Blob URL 追踪）通常需要 **6~8 轮**，按 foundation 停损规则管理，不受 probe 的 2 轮约束。不要低估 VM/WASM 的 foundation 轮次：把 6~8 轮当成"正常"而非"异常"。

深入许可只在以下场景使用：该层已直接控制 `sign / decrypt / request-use / clear-boundary`，且黑盒复用、浏览器可控复用或最小本地骨架仍不足以满足交付。开启后必须绑定 `subgoal / milestone / maxRounds / exitCondition / expectedHighValueEvidence`，并按微路线管理，而不是把整个专题无限续期。

更多阶段细则与边界处理：
- 媒体解密继续坚持"内容层验证高于容器层验证"
- 环境值继续按 `env-read / env-transform / env-consume` 追踪
- opaque 解密链优先先做层次诊断、mapping、direct-call 与全网搜索纠偏（用环境内可用的 web 搜索能力，如有 `mcp__web-search__search_bing` 则用它，见降级表），再决定是否进入统计采样或纯算法提取
