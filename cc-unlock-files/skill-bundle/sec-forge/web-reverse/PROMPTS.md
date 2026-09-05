# web-reverse 提示词模板

这些模板用于把 `web-reverse` 推入正确执行状态。

详细组合策略与长模板变体见：`docs/reference/prompt-composition-guide.md`

使用原则：
- 先写清任务目标、验收标准、已知难点、现有样本
- 先显式锁定任务契约：目标 / 不可退让约束 / 当前交付层级 / 完成判据 / 禁止冒充完成的替代态
- 默认目标是持续推进到阻塞或交付
- 不要要求模型中途做阶段性汇报
- 除非需要用户协作、高风险确认、目标偏差说明、或已完成可验证交付，否则不应停下来等用户再说“继续”
- 如果 workspace 里没有 history data files，优先用 `node tools/task/task-start.mjs <task-id>` 或 `node tools/task/task-init.mjs <task-id>` 初始化
- 如果 history data files 已存在，默认走续跑；只有明确需要第二个 task-local 时才使用 `--force-new-task`
- 如果上一轮是 `pauseCategory=user`，而本轮用户已经回复“已加载 / 已登录 / 继续 / 好了”，先 `task-sync -> task-advance --resume-from-user`，不要沿用旧的 blocked-on-user

<!-- topics: anti-debug, anti-tamper, ast-deobfuscation, dynamic-code, instrumentation-hooking, source-map, bundle-loader, framework-runtime, microfrontend-runtime, module-federation -->
<!-- topics: signature, session, storage, subtlecrypto, userland-crypto, protocol, binary-codec, compression-stream, graphql-rpc, grpc-web -->
<!-- topics: frame, worker, cross-context-coordination, wasm, jsvmp, media-drm, streaming-runtime -->
<!-- topics: fingerprint, challenge-orchestration, behavior-telemetry, beacon-reporting, env, webauthn-passkey, webrtc-datachannel -->

---

## 新任务通用

```text
这是一个新的 Web 前端逆向任务，请使用 web-reverse 执行。

要求：
- 先走 Startup Gate：task-start/task-init -> task-sync -> task-advance
- 初始化后立即补齐任务契约：taskContract / executionModel / acceptanceModel
- 进入正式执行后，不要停在阶段汇报
- 除非出现用户协作阻塞、高风险副作用、路线级目标偏差、或已完成可验证交付，否则不要等待我再输入“继续”
- 优先逼近最终验收，不要长期停留在内部机理解释

任务目标：
<填写目标>

验收标准：
<填写验收>

已知难点：
<填写难点>

目标页面 / 接口 / 样本：
<填写页面、接口、样本>
```

```text
这是一个新的 Web 前端逆向任务。

在正式执行前，先把任务契约写清：
- 目标（用户最终想要什么）
- 不可退让约束（用户明确禁止什么）
- 当前交付层级（当前先做到 accepted request / browser harness / local reproduction / pure extraction 中哪一层）
- 完成判据（什么才算 delivered）
- 禁止冒充完成的替代态（哪些现象只能算中间证据）

然后把这些状态写入：
- taskContract
- executionModel
- acceptanceModel

没有补齐这三块前，不要进入大量 probe / patch / 试参。
```

```text
这是一个新的 Web 前端逆向任务，当前给你的是外部空目录 workspace。
请直接使用当前 web-reverse skill 仓库的 tools/task/task-start.mjs 初始化该 workspace，不要再向我要“包含 tools/task/ 的仓库路径”。

要求：
- 初始化后继续 task-sync -> task-advance
- 进入正式执行后持续推进，不要停在状态汇报
- 所有正式交付物写入 artifacts/tasks/<task-id>/
```

---

## 续跑任务

```text
这是续跑任务，不要从零开始分析。

请先恢复：
- task.json
- state/route-state.json
- state/route-plan.md
- state/clues.md
- state/progress.md
- report.md

然后执行：
- task-sync
- task-advance

要求：
- 恢复后不要停在“已恢复 / 当前阶段 / 下一步计划”
- 恢复后先检查任务契约有没有失效或缺项；若用户上一轮新增了硬约束，先回写 taskContract / acceptanceModel
- 如果 execution.status=ready-to-continue 且 pauseCategory=none，就继续执行 nextExecutableAction
- 除非出现用户协作阻塞、高风险副作用、路线级目标偏差、或已完成可验证交付，否则不要等我再输入“继续”
- 若用户已完成上一轮协作动作（如“已加载 / 已登录 / 继续”），必须先清除旧暂停：`task-advance --resume-from-user` 或 `task-advance --pause-category=none`
```

```text
继续这个已有 task-local。

要求你默认连续推进：
- 每轮结束先回写 route-state / report / progress
- 然后继续下一步
- 不要用“我会继续 / 下一步继续 / 本轮新增证据如下”作为收尾
- 如果当前路线默认连续两轮没有逼近最终验收，必须 pivot；但若命中 VM / WASM / 混淆且当前 microRoute 已开启 `deepDivePermit`，则改按 `highValueEvidence + maxRounds + exitCondition` 判断，不要机械 pivot
```

---

## 明确不是本 skill 的场景

```text
如果用户要的是普通 Playwright / Puppeteer UI 自动化、冒烟测试、页面元素断言、菜单/头像检查，不要把它包装成 web-reverse 任务。
只有当浏览器自动化承担的是受保护运行时复用、会话态维持、签名/解密链取证或逆向交付职责时，才继续按 web-reverse 主线推进。
```

---

## 验收导向

```text
这次请严格以最终验收为北极星。

要求：
- 每一轮都先判断当前动作是否直接缩短到最终交付
- 如果默认两轮内没有更接近请求成功 / 本地复现 / 解密成功 / 纯算法迁移，就必须 pivot；但 VM / WASM / 混淆的深层 microRoute 若仍在持续产出高价值证据，可继续在 permit 预算内推进
- 不要把更多 slot / patch / selector / dispatcher 内部解释当作主要进展
- 只有更接近最终交付，才算有效推进
- 如果用户目标明确要求纯 Python / 纯 Node / 不依赖浏览器框架，则 Playwright / Puppeteer / browser harness 只能算中间 PoC，不能直接按最终交付收尾
- 如果当前现象只属于局部样本、容器可读、浏览器 PoC、单点成功、局部 diff，对外只能写 provisional / route-ready，不能写 delivered
```

```text
最终目标是 Python 交付，不是内部机理研究。

要求：
- 优先找可迁移边界
- 优先找明文边界 / request-use / clear buffer / 黑盒复用
- 不要过早陷入 VM / WASM / dispatcher / slot 深拆
- 只有在黑盒复用失败、明文边界不可直接复用、且必须纯提取时，才进入深拆
- 如果暂时只能做到浏览器黑盒复用，必须明确写“原目标尚未完成 / 当前只到哪个 tier / 下一步迁移边界”
```

---

## 输出约束

```text
请按 web-reverse 的交付要求工作：
- 所有说明和报告用中文
- 关键证据必须落入 task artifact
- 不要在未验证前宣称“已成功 / 已完成”
- 如果还没完成可验证交付，不要停在阶段性汇报
```

---

## 用户协作阻塞

```text
如果执行过程中必须由我配合，请只在以下情况回复我：
- 需要我登录
- 需要我过验证码
- 需要我补缺失样本
- 继续执行有高风险副作用
- 需要我确认是否接受目标偏差

除此之外，请持续推进，不要让我反复输入“继续”。
```

## 精确暂停 / 回复门禁

```text
如果必须暂停并回复我，不要只说“需要协作”或“请确认”。
请明确写出：
- replyGateDecision: blocked-on-user / blocked-on-risk / delivered / route-pivot
- blockingAction: 当前卡住的具体动作
- requiredUserAction: 我现在必须立刻做什么
- resumeCondition: 你拿到什么后会立刻恢复执行
```

```text
准备输出“已完成 / 已交付 / 已打通 / 可交付状态”前，先自检：
- taskContract 是否仍与用户目标一致
- acceptanceGap 是否为空
- acceptancePath 是否可验证
- completionBlockedBy 是否为空
- claimLevel 是否可升级为 delivered

其中任一项不满足，都不要输出完成结论。
```

---

## 专项附加句

### VM / WASM / JSVMP

```text
如果命中 VM / WASM / JSVMP：
- 优先黑盒复用
- 优先找明文边界 / clear boundary
- 若黑盒复用失败且目标强依赖会话态、动态令牌或复杂环境状态，优先尝试浏览器内可控复用（Puppeteer/Playwright 精细化操控）
- 优先复用原始 worker / wasm
- 只有这些都不行时才深拆 dispatcher / opcode / slot
- 若已证明当前 VM / WASM / 混淆 microRoute 正在持续产出高价值证据，可开启 `deepDivePermit`，并显式写出 `microRoute / subgoal / milestone / maxRounds / expectedHighValueEvidence / exitCondition`
- `两轮停损` 默认只停当前 microRoute，不直接停掉整个 VM / WASM / 混淆专题
```

### Stateful signer

```text
如果表现为浏览器 baseline 成功、本地 signer 失败：
- 停止泛补 DOM / navigator / prototype
- 直接切回 Capture，优先追 carrier -> writer -> signer state -> reader -> request-use
```

### 媒体解密 / DRM

```text
如果目标是媒体解密：
- 以“解密后可验证的音视频结果”作为主验收
- 不要把容器可识别、ffprobe 可读、或部分通路正常误判为整体已解密
- 优先找解密后 appendBuffer / clear frame / 可迁移明文边界
```

---

## 外部搜索纠偏

```text
如果默认连续两轮没有逼近最终验收，或命中 provider / SDK / protocol 高信号，**必须立即进行全网搜索**（通过 `mcp__web-search__search_bing` 用当前 host/字段名/函数名 + reverse/github 组合搜索），**搜索完成并回写 externalRefs 与 state/external-research.md/json 前，不得继续深挖局部模式、不得新开 probe、不得进入 deep-dive**。若当前为已开启 `deepDivePermit` 的 VM / WASM / 混淆微路线，则改为”当前 microRoute 连续两轮没有新增高价值证据”。

要求：
- 先整理 feature bundle（host/path/字段名/函数名/症状）
- 优先搜索官方文档、GitHub、issue、标准、供应商文档
- 搜索结果必须回写 `externalRefs` 与 `state/external-research.md/json`
- 搜索只能用于修正 entrypoint / probe / provider 判断，不能代替运行时证据
- 搜索结束后立刻回到 entrypoint loop 继续执行
```

```text
如果表现为 baseline 成功、本地 generated-rejected，且字段名具有公开家族特征（如 x-bogus / msToken / x-sign / sensor_data / _abck），**必须立即进行全网搜索**（通过 `mcp__web-search__search_bing` 用字段名 + github/reverse 搜索）来校正 signer state、carrier 与 provider 假设，再回到 request-use / sign-call / payload boundary。**不得在未搜索的情况下继续盲调参数或扩采样。**
```

---

## 首轮压缩协议

```text
进入正式执行后，先用一个紧凑结构锁定当前工作面：
- taskMode / deliverableTier / primaryTopic / secondaryTopics
- currentStage / activeEntrypoint / minimalProbe / successCriteria
- provisionalEvidence / blockingUnknown / acceptanceGap / nextEvidenceGate
- roundKillCondition / microRoute / highValueEvidenceGoal
- deepDivePermit / deepDiveSubgoal / deepDiveMilestone / deepDiveMaxRounds / deepDiveExitCondition / expectedHighValueEvidence

如果是续跑或外部 workspace 任务，建议在这组压缩字段旁边再补：
- workspaceRoot / taskLocalRoot / artifactTruthRoot / workspaceKind
- activeEntrypoints / entrypointStatuses
- execution.nextExecutableAction

先给出这一轮的压缩工作面，再直接执行，不要展开成长篇阶段汇报。
```

## 交付梯度控制

```text
这次任务的主目标是 <填写：请求验收 / 内容边界 / 浏览器复用 / 本地复现 / 纯算法提取>。
请先按这个 deliverableTier 推进；如果当前梯度尚未满足，不要为了“更完整”提前升级到纯算法迁移。
```

## Topic 预算控制

```text
这是一个复合场景，但不要一次性把所有专题都当主线。
请先选 1 个主专题 + 最多 2 个辅助专题，并说明这些专题如何服务当前活跃 entrypoint。
不要批量通读所有 playbook。
```

## Retrospective / Pivot

```text
如果同一 entrypoint / 主假说默认连续两轮没有逼近最终验收，请先写 retrospective；若命中 VM / WASM / 混淆并已开启 `deepDivePermit`，则改检查当前 microRoute 是否连续两轮没有新增高价值证据或已到 `maxRounds / exitCondition`：
- 废弃哪个假说
- 保留哪些证据
- 停止扩张哪些脚本 / 样本
- 新的主模式 / 主专题 / entrypoint 排序
- 下一轮最便宜 probe
- 写清当前停掉的是哪个 microRoute，还是 permit 续期到下一轮
然后立刻继续执行，不要停在“准备换方向”。
```

## 浏览器可控复用优先

```text
这次优先目标是浏览器内可控复用，而不是纯算法提取。
请把浏览器当作 harness，用 Playwright / Puppeteer / DevTools 精细化控制请求链、会话态和网络拦截；在该路线尚可行时，不要提前升级到 pure extraction。
```

## 结论精度

```text
请在关键结论处明确使用：provisional / route-ready / acceptance-ready / delivered。
不要把容器可读、局部 diff、搜索命中或单点成功直接写成“已完成交付”。
如果当前只是 Playwright / browser harness PoC，而用户目标仍是纯本地 Python/Node，请把结论限制在 `provisional` 或 `route-ready`，除非你已明确声明原目标尚未完成。
```

## 收尾 / Closeout

```text
如果已经逼近交付，请不要只停在“报告已更新”。
要求：
- 先确认当前 deliverableTier 已满足
- 跑验证
- 补齐 report / fixtures / verify / retrospective / external-research（如适用）
- 明确写出 usedArtifacts / unusedArtifacts / acceptancePath，说明哪个脚本或 harness 真正参与了最终验收
- 最后再执行 task-close
```
