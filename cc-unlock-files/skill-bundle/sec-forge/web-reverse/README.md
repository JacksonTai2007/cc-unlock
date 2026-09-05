# web-reverse（新方案）

这是围绕 **验收优先、证据优先、默认连续推进、两轮停损 + deep-dive permit 例外、外部搜索只用于纠偏** 重构后的 `web-reverse` 项目。

它保留原项目的能力面：`topics/`、`references/`、`scripts/`、`tools/task/`、`tools/qa/`、`artifacts/tasks/`；本轮重构的重点是把运行时行为、操作模板、机器契约、参考资料与发布治理拆到各自层级，降低顶层 prompt 膨胀。

---

## 当前版本主轴

- **任务契约驱动执行**：先锁目标、不可退让约束、交付层级与完成判据，再推进
- **状态机 + 门禁**：通过 `taskContract / executionModel / acceptanceModel` 统一约束执行与宣称完成
- **通用验证 + 插件验证**：先防止“局部成功冒充整体完成”，再按专题加载额外验收插件
- **证据是否足够支撑当前结论**
- **路线是否真正逼近最终交付**
- **默认连续推进，直到真实阻塞或完成交付**
- **外部搜索是否只用于纠偏**
- **主模式 / 交付梯度控制**
- **主张精度与结论卫生**

## 这版核心变化

1. **从知识驱动到契约驱动**：从"按专题执行"转向"以验收为唯一目标"，所有规则围绕任务契约、交付梯度、门禁机制组织
2. **从扁平到分层**：执行阶段细分为 Foundation / Probe / Deep-Dive，各有独立停损参数和升降级规则
3. **从隐式到显式**：停损参数、假说治理、主张精度、门禁审计等原本散落的规则统一收归到专门文档
4. **从脆弱到健壮**：工具降级 L0~L3、工作目录铁律、用户约束记忆、门禁审计日志等机制增强了运行时鲁棒性
5. **从膨胀到分层**：SKILL.md 容量合理增长（+52%），PROMPTS.md 大幅精简（-46%），大量细节下沉到 `docs/reference/` 和 `references/` 的专门文档
6. **从宽泛到精准**：专题成熟度分层优化（guided 13 个晋升 closed-loop、5 个晋升 synthetic-e2e），参考 playbook 新增 22 个专项文档
7. **Eval 体系大幅扩展**：eval 规模增长 5 倍，新增 deep-dive 专项 eval，支撑更精细的质量验证

---

## 专题成熟度摘要

<!-- BEGIN GENERATED: topic-maturity-summary -->
- `synthetic-e2e` (`21`): `anti-debug`, `behavior-telemetry`, `binary-codec`, `challenge-orchestration`, `compression-stream`, `dynamic-code`, `env`, `fingerprint`, `framework-runtime`, `graphql-rpc`, `instrumentation-hooking`, `jsvmp`, `media-drm`, `module-federation`, `protocol`, `signature`, `streaming-runtime`, `subtlecrypto`, `userland-crypto`, `wasm`, `worker`
- `guided` (`0`): none published yet
- `closed-loop` (`13`): `anti-tamper`, `ast-deobfuscation`, `beacon-reporting`, `bundle-loader`, `cross-context-coordination`, `frame`, `grpc-web`, `microfrontend-runtime`, `session`, `source-map`, `storage`, `webauthn-passkey`, `webrtc-datachannel`
- `reference-only` (`0`): none published yet
<!-- END GENERATED: topic-maturity-summary -->

这里的成熟度表示**专题闭环能力分层**，不是历史任务计数。

---

## 默认成功标准

默认成功标准不是“浏览器逐字节一致”或“内部机理解释得更细”，而是：

- 请求更接近成功
- 本地复现更接近可运行
- 解密 / 解码结果更接近可验证
- 纯算法边界被提取并成功迁移到目标宿主
- 关键路线在 task-local 中被证据化落盘

只有当用户显式要求时，才把“浏览器端逐字节一致”升为主目标。

## 非目标边界

以下通常**不属于** `web-reverse`：
- 普通前端开发
- 普通 Playwright / Puppeteer UI 自动化
- 页面冒烟测试、菜单/头像/按钮可见性检查
- 通用密码学教学

只有当浏览器自动化被用于**复用受保护运行时、维持会话态、追踪签名/解密链、或逼近逆向交付**时，才属于本 skill 范围。

---

## 建议阅读路径

### 1. 运行时行为 / 接入层
1. `SKILL.md`
2. `PROMPTS.md`
3. `docs/reference/document-layering.md`
4. `docs/reference/reverse-bootstrap.md`
5. `docs/reference/reverse-workflow.md`

### 2. 执行策略 / 质量控制
1. `docs/reference/first-response-contract.md`
2. `docs/reference/deliverable-ladder.md`
3. `docs/reference/topic-selection-policy.md`
4. `docs/reference/retrospective-protocol.md`
5. `docs/reference/claim-hygiene.md`
6. `docs/reference/search-decision-policy.md`
7. `docs/reference/route-state-protocol.md`

### 3. 维护与发布
1. `docs/reference/maturity-model.md`
2. `docs/reference/schema-migration-policy.md`
3. `docs/guides/getting-started.md`
4. `docs/guides/minimal-usage-manual.md`
5. `docs/guides/task-lifecycle.md`
6. `docs/guides/release-workflow.md`

如果已经进入具体专题，再回到 `references/README.md` 按主专题挑 playbook，不要一上来批量扫完整个 `references/`。

---

## 最常用命令

```bash
# 新任务
npm run task:start -- <task-id>

# manifest / generated docs 同步
npm run sync:topics

# 续跑任务同步与推进
npm run task:sync -- <task-id>
npm run task:advance -- <task-id>

# 任务收尾
npm run task:close -- <task-id>

# 回复前门禁
npm run task:assert-can-reply -- <task-id>

# 最终交付门禁
node tools/task/assert-can-reply.mjs <task-id> --require-validated-deliverable

# 常规自检
npm run check:fast
npm run check:full
npm run check:maturity
npm run check:websearch-contract

# 发布前整体验证
npm run release:prep
```

推荐顺序：`sync:topics -> task:start/init -> task:sync -> task:advance -> 执行动作 -> assert-can-reply --require-validated-deliverable -> task:close`

---

## 维护分层速记

- 顶层执行宪法：`SKILL.md`
- 操作模板：`PROMPTS.md`
- 机器契约真源：`topics/*/topic.json`
- 稳定规则 / 治理：`docs/reference/*`
- 专题 playbook / 深水区：`references/*`
- 维护与发布流程：`docs/guides/*`

成熟度语义：
- `synthetic-e2e`：topic 已具备 synthetic 回归
- `closed-loop`：topic 已具备 task model + formal validation + QA，但尚未发布 synthetic
- `guided`：仅具备 registry-backed 指导能力，尚未达到闭环契约
- `reference-only`：只有资料，不进入闭环执行

## 使用时要始终记住

- 不要把“本轮新增证据”当作暂停理由
- 不要把“我会继续”当作动作
- 不要把“更细的内部解释”误当成有效推进
- 先选对 `taskMode / deliverableTier`，再决定是否要深拆
- 默认两轮没有逼近最终验收就切线；对已开启 `deepDivePermit` 的 VM / WASM / 混淆微路线，改看是否仍持续产出高价值证据
- 外部搜索只能帮助纠偏，不能代替证据
- 结论要标清 `provisional / route-ready / acceptance-ready / delivered`

> **先完成用户要的逆向交付，再决定还要不要继续研究内部机理。**
