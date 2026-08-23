---
name: web-reverse
description: Web 前端逆向：还原签名/协议/加解密、请求参数与 cookie 加密、反爬虫/风控字段；处理混淆/反调试/反篡改与反混淆还原；分析 Worker/WASM/JSVMP 运行链；扣代码/最小闭包提取、补环境（Node/Python 复现）、浏览器内复用或纯算法迁移；指纹检测、DevTools hook、source map 还原；或继续已有 Web 逆向任务。不用于普通前端开发、漏洞利用、Android 逆向。
---
# Web Reverse

这是一个**任务契约驱动的总控 + 路由系统**，不是知识清单。本文件只做三件事：锁定验收目标、约束执行节奏、把任务路由到正确的 reference / workflow。细则一律按需读 `references/` 与 `docs/reference/`（见末尾路由表）。

约束力来自**机制**而非文字篇幅，要优先消灭三种失效模式：

- **目标漂移**：用户要 A，执行中偷偷降成 B，还把 B 说成完成。
- **虚假完成**：没过最终验证就说"已完成 / 已交付"。局部样本、单点成功、容器可读、浏览器偶发成功都不算验收。
- **线索不落盘**：发现了线索只放在脑子里 → 任务一中断就得重新分析，白烧 token。

## 何时使用

还原签名/认证参数/挑战链/风控字段；分析混淆 JS、动态代码、source map、反调试、反篡改；分析 Worker/iframe/多上下文、JSVMP/自定义 VM/WASM/媒体解密；基于浏览器证据做 Node/Python 复现、纯算法迁移、浏览器内可控复用；或继续已有 task-local 任务。

不适用：普通前端开发、密码学教学、漏洞利用 / 渗透或其它非 Web 前端逆向。

## 北极星：以验收为唯一目标

目标不是持续汇报新发现，而是**在任务契约下尽快逼近用户验收目标**。每个动作前先自问：① 用户最终交付是什么；② 这个动作是否直接缩短到该交付；③ 当前路线是否还值得再走一轮。研究型收敛 ≠ 交付型推进。

逆向中你通常不知道哪条路最短，直到走通。所以**发现线索的第一反应是「记录」而不是「立刻写脚本验证」**——验证可能失败、可能被打断，只有落盘的线索能跨轮复用（见下文「记录与搜索」）。

## 三条红线（其余都是指引，唯这三条不可退让）

1. **先初始化再动手**：任何分析 / 浏览器操作 / 写文件前，先在**当前项目目录**执行
   `node $TOOL_DIR/task-boot.mjs <task-id>`（幂等：有任务则续跑，无则新建）。
   `$TOOL_DIR` = 本 skill 包内 `tools/task/` 的绝对路径，**首次操作前先解析一次**（解析细则见 `docs/reference/tooling-degradation.md` Step 0），本文件后续所有 `node $TOOL_DIR/...` 调用都复用此次解析结果。`task-boot.mjs` 是唯一开机入口，内部已串起 `task-init`（新建）/ resume → `task-sync` → `task-advance`，无需再逐个手调。
   **每个 workspace 只在首个动作前 boot 一次**：续跑时直接按 task-advance 输出的 `nextExecutableAction` 执行，不要每轮重复 boot。boot 的 `ready` 输出会打印**产物写入锚点的绝对路径**（`run/` / `state/` / `report.md`），照它写。
   跳过它产物会散落根目录、状态无法跨轮恢复。Windows 路径用正斜杠。细则见 `docs/reference/startup-gate-procedures.md`。
2. **产物落 task 目录**：本任务产生的**每个**文件（脚本/样本/中间数据/报告）都落在 cwd 下
   `artifacts/tasks/<task-id>/`（脚本与样本进 `run/`，状态进 `state/`，报告就是 `report.md`）。
   cwd 根只允许项目元文件（`SKILL.md` / `README.md` / `.gitignore` / `package.json` / `package-lock.json` 等，以及 `tsconfig.json` / `vite.config.*` / `requirements.txt` 等常见构建配置；完整白名单真源 = `tools/task/common.mjs` 的 `WORKSPACE_ROOT_ALLOWLIST`，门禁与本表共用），其余逆向脚本/数据一律进 `artifacts/tasks/`。
   **这条红线有机械门禁**：`task-close` / `verify-once` 会扫描 workspace 根目录，凡是本任务 boot 之后新增的非白名单 `.js/.mjs/.cjs/.ts/.py/.json/.jsonl` 文件一律 BLOCK（`rule=move-stray-artifacts-into-task-run-dir`）；`task-close` 还会自动把它们 `[relocate]` 进 `run/`。不要靠"我觉得放根目录也行"——门禁不认。
3. **完成必须可验证**："已完成 / 已成功 / 已交付"只能在 `run/verify-once.mjs` 真跑通、
   `run/fixtures.json` 存在、`acceptanceGap` 为空后才能说。交付物 = 验证脚本跑通的副产品，不是口头宣称。
   **`assert-can-reply` 返回 BLOCKED（exit≠0）就等于「未完成」**：此时**禁止任何用户可见的交付性回复**（包括"已完成/已闭环/已实现"的总结、表头标"已验证"、贴成功结论），只能继续执行它打印的 `nextExecutableAction`；复述 BLOCKED 原因、或把 BLOCKED 包装成"基本完成/已基本跑通"都不算交付，仍属违规。
   **挑战链 / 验证码 / 滑块类任务（模式 A）的验收 = 端到端服务端返回成功**（如求解器实际通过、`error==0` 且业务校验通过），**不是「格式被接受 / JSON 字段齐全 / `validate-fixture` 通过」**——`validate-fixture.mjs` 只校验 JSON 字段存在，绝不能冒充验收；这类成功必须由 `run/verify-once.mjs` 复现，未复现前 claimLevel 最高只能停在 `provisional`。

## 执行循环（按轮迭代，每轮产出明确）

`Observe → Capture → Note → Rebuild → Extract → Verify`。每轮必须产出**可写进 clues.md 的东西**，否则不算有效推进。

| 阶段 | 产出要求 | 不可跳过 |
|---|---|---|
| **Observe** | 识别目标、feature bundle、候选 entrypoints、初始 family/boundary | — |
| **Capture** | 采集服务验收边界的输入/输出/中间值/状态链 | — |
| **Note** | **当轮立即**写进 `state/clues.md`：`- [置信度] 发现内容 {EP-00N}` | **不可跳过** |
| **Rebuild** | 把证据转成最小可运行骨架（Node/Python/浏览器 harness） | — |
| **Extract** | 扣代码路线产出 `run/extracted-closure.js` + 依赖清单 + 入出口契约（导出函数签名）。判定/阈值/handoff 见 `references/closure-extraction-playbook.md` §0 与 `references/composite-triage-playbook.md`「Rebuild 路线三岔决策」。 | 扣代码路线不可跳过 |
| **Verify** | 围绕**最终交付**直接验证，不是局部成功 | — |

**纪律**：Note 是 Capture 和 Rebuild 之间的**强制步骤**。带着未落盘的线索往下走 = 重复劳动。retrospective 见 `docs/reference/reverse-workflow.md`。

**还原即落叙事**：一旦在 Rebuild/Verify 还原出算法或产出 `run/` 下成品脚本，就**立即**把「逆向分析过程 / 主要算法说明 / 难点与对抗 / 调用示例」四段写进 `state/narrative.md` 对应小节——这与「写 clues.md」同级强制，不是收尾才补。`run/` 有成品脚本而四段空时，`task-close` 会按 error 拦下、`task-snapshot --round` 会告警。报告四段由 `task-close` 从 `state/narrative.md` 渲染，不要手工往 `report.md` 贴叙述。**成品脚本命名须以 `pure-` 或 `pure_` 开头**（如 `run/pure-signer.js`），门禁与四段强制项均以此命名约定检测。

> **主循环 ↔ workflow 阶段映射**（消歧，canonical 阶段定义在 `docs/reference/reverse-workflow.md`）：
>
> - **Note/Verify 映射**：本表 `Note` 是**贯穿全程的强制落盘步骤**、`Verify` 是收尾验证，二者在 workflow 不单列命名小节。
> - **Rebuild 细分**：本表的 `Rebuild/Verify` 在 workflow 中细分为 `Rebuild → Patch → PureExtraction → Port`，其中 `Rebuild` 在 workflow 内含**条件子阶段 `Extract`（仅 D/E 扣代码路线时走，是 Rebuild→Patch 之间的子小节，非顶层命名阶段）**。
> - **补环境粒度**：**补环境**在本表并进 `Extract` 后的 handoff（见上文 Extract 段），在 workflow 是**独立的 `Patch` 阶段**——是同一件事的粗/细两种粒度，不存在「补环境到底算 Extract 子步骤还是独立阶段」的歧义。

## 任务模式与交付梯度

先选 1 个主模式，每轮**只保留 1 个主模式 + 最多 1 个备用模式**，不要为"更完整"提前升级：

- **A 请求验收**：请求成功、字段被接受、挑战链闭环。
- **B 内容/明文边界恢复**：clear boundary、内容层验证、可验证明文。
- **C 浏览器内可控复用**：把浏览器当 harness（Playwright/Puppeteer/DevTools）完成验收。
- **D 本地复现 / Port**：交付 Node / Python 最小可运行骨架。
- **E 纯算法提取**：仅当 A~D 都不足时才升级。

若当前梯度连续 2 轮无法推进，主动降级而非硬顶。用户明确要"纯 Python/Node、不依赖浏览器"时，浏览器 harness 只能算中间证据。详见 `docs/reference/deliverable-ladder.md`。

## 专题路由与按需加载

先做**早路由**：从 feature bundle 选 **1 个主专题 + 0~2 个辅助专题**，不要先读一堆细则再决定。`references/`、`docs/reference/`、`topics/*/topic.json` 一律**按需加载**，默认只读与当前主模式直接相关的 playbook。命中组合保护 / 跨上下文 / 混合运行时才扩到 3 个以上专题。判定见 `docs/reference/topic-selection-policy.md`、`docs/reference/capability-matrix.md`。

## Entrypoint / Hook 纪律

1. 先列 2~5 个候选 entrypoints，按成本 / 信息增益 / 复用价值排序；**同时只保留 1~2 个活跃 entrypoints**。
2. 每个 entrypoint 激活时定义 `minimalProbe / successCriteria / failureCriteria / maxRounds`（probe/foundation/VM-WASM 各档轮次见下文「停损」表，VM/WASM 探索偏多属正常）。
3. Foundation 阶段优先**信息增益最高**的入口；Probe 阶段优先**最便宜**的 probe。
4. 有效就扩展，无效就 `PARKED/EXHAUSTED`；活跃路线全失效先 retrospective 再生成新入口。

Hook 语义优先级（高 → 低）：`request-use` → `sign/decrypt-call` → `payload/clear boundary` → `dispatch` → `reader` → `writer` → `bridge/carrier` → 低层 DOM/storage/append/script surface。优先命中**高语义 hook 面**；在 `cookie setter → cookieStore → script.src → appendChild` 这类低层 surface 间切换**不算真正 pivot**。每次 hook 都自问：这条 hook 如何直接缩短到**请求验收边界**。同一家族 hook 连续 2 轮没拿到新可执行证据就换语义层或换 entrypoint。

**工具无关落地**：以上是「钩哪一层」的方法论，与具体浏览器 MCP 无关。把语义层落到你手上工具（chrome-devtools / js-reverse / stealth-browser / 其它 CDP）的具体能力，先做工具探测、再查能力映射表 `references/browser-mcp-capability-map.md`。**纪律：sign-call 取证用「钩函数抓入参/返回」能力，不要用反复盲注 `evaluate_script` 代替**——后者是缺工具时的退化打法。

**浏览器 MCP 锁定（防工具漂移，机械约束）**：用户显式指定某浏览器 MCP（或你按反检测优先级选定）后，**整条任务只用这一个**。初始化时锁定：`node $TOOL_DIR/task-init.mjs <task-id> --browser-mcp=<stealth-browser|js-reverse|chrome-devtools>`。锁定后 `task-advance` 每轮打印 `execution.discipline.rule=pinned-browser-mcp=<name>`。某能力当前工具无原生时**走能力表该列的 fallback（如经 `execute_cdp_command`），禁止为单个能力切到别的浏览器 MCP**——换 MCP=换浏览器实例=风控指纹变化，会丢会话或拿到假挑战污染整条逆向。确需换工具先向用户确认并经 `task-init --browser-mcp` 重锁，绝不静默切换。判读能力表见 `references/browser-mcp-capability-map.md` Step 0.5。

**假设先行 + 同疑点 3 次上限（LLM 高发失败模式硬规则）**：Hook/打印是为了**理解算法**，不是"撞答案"。每次 Hook 前先写下**假设**（"我预期看到 X，它能区分 A/B 两种可能"）；**同一疑点尝试上限 3 次**，3 次未推进认知就停下、回退重判保护类型/换语义层，而非继续刷 dump。把成百上千次 Hook 当进度 = 失败。这条与下文「停损」的轮次趋势规则互补：一个管**单疑点次数上限**，一个管**跨轮无新证据趋势**。"我 Hook 到了输出值"不是成功，唯一成功判据是验收闸门跑通（见「算法自检与服务端验收」）。

## 速查：加密类型快速判断 / 定位参数 6 手段

高频低成本入口，看特征即定路线，不必先读一堆 playbook。详细处理仍按路由表进对应 reference。

**A · 加密类型快速判断**（拿到生成函数代码后）：

| 特征 | 类型 | 进哪条路线 / reference |
|------|------|------------------------|
| `CryptoJS`/`AES`/`DES`/`pkcs1` | 标准加密库 | Hook 库函数拿 key/iv/明文 → 纯算复现（`userland-crypto-playbook.md` / `subtlecrypto-playbook.md`） |
| 超长 base64/hex + `while(true)+switch` | JSVMP/VMP | `vmp-playbook.md` + `scripts/vm/jsvmp-instrument.cjs` |
| `_0x` 变量 + 大数组 + 自执行函数 / 多个 `push/shift` | OB 混淆 | `scripts/deob/deob-ob.cjs` → 失败转 `string-array-deobfuscation-playbook.md` |
| `atob`+`%s`+`.wasm` | WASM | `wasm-jsvmp-bridge-playbook.md` / `wasm-binary-analysis-playbook.md` |
| `eval(`/`new Function(` 动态执行 | 动态执行混淆 | Hook eval/Function（`dynamic-code-playbook.md`） |
| `n(moduleId)` 模块加载 | webpack 打包 | 扣代码（`closure-extraction-playbook.md` / `bundle-loader-playbook.md`） |
| 出现 `gettype`/`w` 参数/滑块图 | 验证码 | `captcha-slider-playbook.md` |

**B · 定位参数的 6 个手段**（已知参数名）：

1. 抓包建图谱，确认密文参数名、字符集/长度（hex? base64? 定长?）
2. XHR/Fetch 断点；或 Hook `XMLHttpRequest.prototype.open`/`fetch`/`setRequestHeader`
3. `get_request_initiator`（MCP）或调用栈面板拿生成调用链
4. 全局搜参数名/`encrypt`/`sign`/`CryptoJS`/特征常量
5. 断在 `send` 逐帧上溯到赋值行（混淆先 AST 还原再断点）
6. 用日志断点（`console.log(arg)`）代替普通断点，避免影响执行流 + 规避计时型反调试

## 算法自检与服务端验收（双闸门）

D/E 模式（本地复现 / 纯算法提取）的验证拆成两道**独立**闸门，把"算法错"与"补环境错"解耦：

1. **算法自检**（先）：`python scripts/verify/verify-algo.py --impl run/pure-xxx.py --fixtures run/fixtures.json`——钉死随机源后纯算输出与浏览器输出**逐字节相等**，验算法对不对。
2. **服务端验收**（后）：`run/verify-once.mjs` 或 `python scripts/verify/verify-offline.py`——脱机纯算生成参数被服务器**稳定接受**，对随机天然免疫，是 claimLevel 升 `delivered` 的唯一依据。

两者共用实现契约 `generate(ctx, pinned=None)`（`pinned=None` 随机照常＝验收；`pinned` 给定替换随机源＝自检）。**勿用朴素字节比对当验收**——签名含随机/时间戳，只有控制变量下才该逐字节相等。细则 `references/algorithm-selfcheck-playbook.md`。

## 记录与搜索（记录是执行循环的强制步骤，不是额外记账）

**`state/clues.md` 是线索唯一真源**。Note 阶段必须执行：

1. 打开 `state/clues.md`（没有就 `task-sync` 会生成脚手架）
2. 在「## 线索」段下追加一行：`- [置信度] 发现内容 {EP-00N}`
3. 保存。完成。然后才进入 Rebuild。

落盘触发（满足任一即记录）：
- 定位到新 entrypoint / carrier / hook
- 识别出 family / algorithm / provider
- 发现 direct-call 路线或关键中间值
- 浏览器验证成功/失败出现新症状
- 用户否决某方案（用 `--kind=reject`）

主张精度（记录时标注）：
- `provisional`：局部样本、单点命中、搜索线索
- `route-ready`：已验证，足以支撑下一轮 probe
- `acceptance-ready`：已拿到贴近目标边界的直接证据
- `delivered`：已通过最终验证。`ffprobe` 可读、部分明文、单条偶发成功、浏览器 PoC **都不能**单独升此级

**搜索**：当线索里出现 provider 名 / wasm 导出名 / 错误码 / 商业保护高信号，或连续两轮未逼近验收、本地经验未命中（`knowledgeGap`）时，**立即用你环境内可用的 web 搜索能力**发起一轮结构化搜索（具体工具按降级表选择，如有 `mcp__web-search__search_bing` 则用它），结果写入 `state/external-research.md` / `.json`。**门禁判定的是"是否搜过 + 是否留下决策"，不绑定具体工具**；无任何联网能力时走降级（手动检索，不阻断主流程），降级链路见 `docs/reference/tooling-degradation.md`。query 直接用观察到的具体值，不知道确切名就用 host 域名。细则 `references/web-search-tool.md`、`docs/reference/search-decision-policy.md`。

## 停损（量化自检，每轮必做）

以下不是建议，是**每轮结束时的强制自检**。不满足就 pivot/retrospective，不要硬顶：

核心三条阈值（高频自检用，完整阈值表 + 阶段回退协议见 `docs/reference/stop-loss-parameters.md`）：

| 阶段 | 停损条件 | 动作 |
|---|---|---|
| Foundation | 连续 **2** 轮无新增 hook/carrier/entrypoint mapping | 必须 pivot |
| Foundation | **4** 轮（VM/WASM **8** 轮）进不了 Probe | 必须 retrospective |
| Deep-Dive | 连续 **2** 轮无高价值证据 | 结束 permit，回退上一可验收层并触发 retrospective |

**不算有效推进**（所有阶段统一）：更细的 slot/selector 解释、更多同层低价值 hook、只在 Browser/Node 差异上细化但不逼近交付。

**自检方式**：每轮结束前检查 clues.md——本轮有无新增线索？无 → 触发停损。

## VM / WASM / DRM

命中 Worker/WASM/JSVMP/媒体解密时优先级：浏览器黑盒复用 → 明文/解密后边界/appendBuffer/request-use → 浏览器内可控复用 → Node 侧复用原始 worker/wasm/bundle → 纯算法提取 → 最后才 dispatcher/bytecode 深拆。前 1~4 任一足以验收就别深拆；深拆需开 `deep-dive permit`（五字段 + 回退协议见 `docs/reference/stop-loss-parameters.md`）。permit 结束后回退到上一可验收层（黑盒复用 / 浏览器内可控复用 / Node 侧复用）并触发 retrospective，不要在原微路线硬顶。专题入口见 `references/vmp-playbook.md`、`references/wasm-jsvmp-bridge-playbook.md`、`references/media-drm-playbook.md`、`references/vm-wasm.md`。

## 状态真源与用户约束

真源：`taskContract / executionModel / acceptanceModel` + `state/clues.md`。报告与字段冲突时以字段为准。

用户否决一条方案 → 当轮 `task-note --kind=reject` 落盘。`userRejectedApproaches` 只增不减，每轮恢复时先对照排除冲突方案。

## 回复与完成门禁

只要 `execution.status=ready-to-continue` 且 `pauseCategory=none` 就继续执行，不要把"我会继续 / 下一步继续 / 自动推进"当作输出，也不要出现"如果你同意继续"这类假暂停。只有四种情况才停下回复：① 需要用户协作（登录/验证码/硬件/样本）；② 高风险副作用需确认；③ 已完成可验证交付；④ 必须声明目标偏差或路线级 pivot（声明后继续执行）。纯过程性进度播报不构成暂停理由。

回复前先 `node $TOOL_DIR/assert-can-reply.mjs <task-id>`；要宣称完成再加 `--require-validated-deliverable`。未核实文件存在前不说"已落盘/已写入"，未拿到最新验收证据前不说"已成功/已请求成功"。停下回复前先 `node $TOOL_DIR/task-snapshot.mjs <task-id> --round` 刷新 `report.md`（checkpoint，非验收）。`--round` 把本次当作一个回复轮边界：推进全局轮次，并按「本轮 clues.md 有无新增线索」判定有效推进——连续无新增会自动逼近停损/搜索闸（见「停损」）。降级/门禁细则见 `docs/reference/reply-gate-degraded.md`。

## 产物纪律与 Close

所有产物落 `artifacts/tasks/<task-id>/`（红线 2，有机械门禁）。`report.md` 由 `task-snapshot` / `task-close` 渲染，**严禁**在根另建 `REPORT.md` 或平行报告。

**Close 最小要求（硬约束）**：`report.md` + `run/verify-once.mjs` + `run/fixtures.json` 三件套齐全，且 `report.md` 顶部必暴露 `workspaceRoot / taskLocalRoot / artifactTruthRoot / taskMode / primaryTopic / claimLevel / acceptanceGap / nextEvidenceGate`，并保留「切入点循环」段。

收尾必须跑 `task-close`（`task-snapshot` 只是中止快照、不跑门禁、不标记完成）。`task-close` 的硬校验项（`taskMode`/`primaryTopic` 非占位、四段叙事非空、散落产物 `[relocate]` 行为、snapshot 与 close 的分工）与四段真源 `state/narrative.md` 写法，见 `docs/reference/closeout-checklist.md`。所有报告用中文，代码/字段名保留原样。另见 `docs/reference/output-contract.md`。

## 路由表（按需读）

- 启动 / 续跑：`docs/reference/startup-gate-procedures.md`
- 工具降级（工具不可用时手动维护 state，不崩）：`docs/reference/tooling-degradation.md`
- 执行循环 / retrospective：`docs/reference/reverse-workflow.md`、`docs/reference/retrospective-protocol.md`
- 首轮契约扩展字段：`docs/reference/first-response-contract.md`
- 停损参数 / 假说治理：`docs/reference/stop-loss-parameters.md`、`references/hypothesis-governance-playbook.md`
- 搜索：`references/web-search-tool.md`、`references/websearch-escalation-playbook.md`、`docs/reference/search-decision-policy.md`
- 专题选择 / 能力矩阵：`docs/reference/topic-selection-policy.md`、`docs/reference/capability-matrix.md`
- 交付梯度 / 输出契约 / 收尾：`docs/reference/deliverable-ladder.md`、`docs/reference/output-contract.md`、`docs/reference/closeout-checklist.md`
- **浏览器 MCP 能力映射（工具无关执行层，任何浏览器 MCP 用户必读）**：`references/browser-mcp-capability-map.md`
- **扣代码 / 反混淆 / 最小闭包提取**（从 bundle 抽出目标函数到 Node 单跑）：`references/closure-extraction-playbook.md`（入口）、`references/deobf.md`、`references/string-array-deobfuscation-playbook.md`、`references/control-flow-flattening-playbook.md`、`references/dead-code-elimination-playbook.md`、`references/bundle-loader-playbook.md`、`references/local-rebuild.md`
- **补环境**（Node 侧复现跑通；canonical 在 docs/reference）：`docs/reference/env-patching.md`（canonical）、`references/env-conformance-playbook.md`、`references/env-drift-decision-tree.md`、`references/env-as-algorithm-input-playbook.md`、`references/node-env-rebuild.md`；补环境探测脚本 `scripts/env/proxy-env.cjs`
- **算法自检与服务端验收（双闸门）**：`references/algorithm-selfcheck-playbook.md`；脚本 `scripts/verify/verify-algo.py`（控制变量逐字节）、`scripts/verify/verify-offline.py`（服务端验收 Python 路线）
- **验证码 / 滑块 / 点选 / 旋转**（challenge-orchestration 的 visual challenge 分支）：`references/captcha-slider-playbook.md`；脚本 `scripts/captcha/slide-gap.py` / `track-gen.py` / `geetest-w.py`
- **Rebuild 路线三岔决策**（扣代码本地复现 vs 补环境跑原始 bundle vs 浏览器可控复用 的唯一决策源）：`references/composite-triage-playbook.md`「Rebuild 路线三岔决策」小节
- 浏览器可控复用 / 补环境：`references/browser-controlled-reuse-playbook.md`、`references/env-drift-decision-tree.md`
- VM/WASM/DRM 专题（**先读哪个**）：先 `references/vmp-playbook.md`（JSVMP 总入口：dispatcher/opcode→handler 基础）→ 命中 WASM 桥接再 `references/wasm-jsvmp-bridge-playbook.md` → 媒体解密走 `references/media-drm-playbook.md`；`references/vm-wasm.md` 是 **VM/WASM boundary 速查**，仅在需要快速对照 boundary/dispatcher 术语时用，深拆仍回 vmp-playbook / `references/wasm-runtime-playbook.md`。**WASM 二进制深拆**走 `references/wasm-binary-analysis-playbook.md`——其 §1.1c「WASM 分析 MCP 能力映射」把"有 `ida-pro-mcp` / `radare2` 时怎么用、皆无时退 wabt"落到具体 API，开拆前先看
- 反篡改 / 完整性自校验（self-defending bundle、toString 完整性校验、`__webpack_require__` 改写检测）：`references/anti-tamper-playbook.md`（含绕过手法）、`references/anti-debug-snippets.md`
- **降级与重放方法论**（工具不可用、路线全失效时的通用降级 / 请求重放）：`references/fallbacks.md`、`references/replay.md`、`references/hooks.md`
- **知识层总索引**（按需查全部 playbook 归类，含上面未单列的专题）：`references/README.md`；新任务首次进入先读 `docs/reference/reverse-bootstrap.md` 与 `references/automation-entry.md`（开局动作清单 + Startup Gate：task-local 初始化与 resume 判定的执行约束）
- 发布流程：`docs/guides/release-workflow.md`

## 专题成熟度摘要

<!-- BEGIN GENERATED: topic-maturity-summary -->
- `synthetic-e2e` (`21`): `anti-debug`, `behavior-telemetry`, `binary-codec`, `challenge-orchestration`, `compression-stream`, `dynamic-code`, `env`, `fingerprint`, `framework-runtime`, `graphql-rpc`, `instrumentation-hooking`, `jsvmp`, `media-drm`, `module-federation`, `protocol`, `signature`, `streaming-runtime`, `subtlecrypto`, `userland-crypto`, `wasm`, `worker`
- `guided` (`0`): none published yet
- `closed-loop` (`13`): `anti-tamper`, `ast-deobfuscation`, `beacon-reporting`, `bundle-loader`, `cross-context-coordination`, `frame`, `grpc-web`, `microfrontend-runtime`, `session`, `source-map`, `storage`, `webauthn-passkey`, `webrtc-datachannel`
- `reference-only` (`0`): none published yet
<!-- END GENERATED: topic-maturity-summary -->

记住：你不是来做漂亮的阶段汇报，也不是来做无止境的机理研究；你是来**完成用户要的逆向交付**。
