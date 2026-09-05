# 成熟度模型

本仓库使用四级成熟度来表达专题能力，不再把 `guided` 当成“未发布 synthetic 的默认桶”。

## 等级定义

### `synthetic-e2e`

满足：

- 有 `taskSemantics`
- 有 `formalValidation`
- 有 `taskPackDir`
- 有 `caseFiles`
- 有 `synthetic`
- `requiredChecks` 中包含 `check:synthetic-e2e`

语义：专题已经具备闭环执行契约，并有 synthetic 回归保护。

### `closed-loop`

满足：

- 有 `taskSemantics`
- 有 `formalValidation`
- 有 `taskModelFile`
- 有 `taskPackDir`
- 有 `caseFiles`
- 已进入常规 QA，但尚未发布 synthetic

语义：专题已经能以结构化方式闭环执行，但 synthetic 回归仍未建立。

### `guided`

满足：

- 已能通过 `signals / protocol / routeTrack` 提供 registry-backed 指导
- 但执行契约尚未达到 `closed-loop`

常见情形：

- 只有基础路由，没有完整 `formalValidation`
- 还没有稳定 task pack / case workflow
- 还不适合承诺闭环交付

### `reference-only`

满足：

- 有资料与 playbook
- 但没有 registry-backed 执行契约

语义：只能做参考，不进入闭环执行承诺。

## 升级路径

推荐升级顺序：

`reference-only -> guided -> closed-loop -> synthetic-e2e`

### 从 `guided` 升到 `closed-loop`

至少补齐：

- `taskSemantics`
- `formalValidation`
- `taskModelFile`
- `taskPackDir`
- `caseFiles`

### 从 `closed-loop` 升到 `synthetic-e2e`

至少补齐：

- `synthetic`
- `check:synthetic-e2e`
- 对应的 synthetic seed / artifact seed / regression 覆盖

## 降级规则

以下情况应考虑降级：

- manifest 仍在，但关键 task contract 已失效
- topic 只能提供资料，无法继续承诺闭环执行
- synthetic 回归被移除但未补替代保障

## QA 约束

仓库现在通过 `check:maturity` 校验：

- `synthetic-e2e` 必须真的带 synthetic
- `closed-loop` 必须带闭环契约
- `guided` 不能伪装成其实已满足 closed-loop 的专题
- `reference-only` 不能继续携带闭环执行契约

## 当前使用策略

当前仓库建议：

- 有 formal validation 且有 case workflow，但未做 synthetic 的专题，统一归入 `closed-loop`
- `guided` 只保留给”有路由、有资料、但还未闭环”的专题

## closed-loop → synthetic-e2e 迁移路线图

当前 13 个 `closed-loop` 专题需逐步升级到 `synthetic-e2e`。优先级按”用户需求频率 × 实现复杂度”排序。

### Phase 1：高需求 + 低复杂度（优先启动）

| 专题 | 说明 | 关键补齐项 | 预计工作量 |
|------|------|-----------|-----------|
| `session` | 签名/stateful signer 核心依赖 | synthetic seed: session-seed + carrier chain fixtures | 中 |
| `storage` | Carrier chain 追踪基础 | synthetic seed: cookie/localStorage/sessionStorage fixtures | 中 |
| `source-map` | 分析早期高频入口 | synthetic seed: source map + deobfuscated bundle pairs | 低 |

### Phase 2：中高需求 + 中等复杂度

| 专题 | 说明 | 关键补齐项 | 预计工作量 |
|------|------|-----------|-----------|
| `anti-tamper` | 常与 anti-debug 组合出现 | synthetic seed: integrity check + tamper detection fixtures | 中 |
| `ast-deobfuscation` | 混淆还原核心能力 | synthetic seed: obfuscated + deobfuscated code pairs | 中 |
| `bundle-loader` | Webpack/chunk loading 场景普遍 | synthetic seed: bundle-loader fixtures + chunk map | 中 |
| `frame` | iframe/跨域场景增多 | synthetic seed: frame bridge + decryption chain fixtures | 中 |

### Phase 3：中等需求 + 中高复杂度

| 专题 | 说明 | 关键补齐项 | 预计工作量 |
|------|------|-----------|-----------|
| `cross-context-coordination` | 复合场景需多专题协同 | synthetic seed: message graph + context map fixtures | 高 |
| `grpc-web` | 增长中的协议类型 | synthetic seed: grpc schema + frame samples | 中 |
| `microfrontend-runtime` | 企业级应用 | synthetic seed: remote entry map + runtime fixtures | 高 |

### Phase 4：专业场景（按需推进）

| 专题 | 说明 | 关键补齐项 | 预计工作量 |
|------|------|-----------|-----------|
| `beacon-reporting` | 专项场景 | synthetic seed: reporting map + beacon fixtures | 低 |
| `webauthn-passkey` | 高度专业化 | synthetic seed: credential flow + request-response samples | 高 |
| `webrtc-datachannel` | 高度专业化 | synthetic seed: signaling map + datachannel fixtures | 高 |

### 升级 checklist（每个专题）

从 `closed-loop` 升到 `synthetic-e2e` 必须逐项完成：

- [ ] `synthetic.id`：唯一 synthetic 标识符
- [ ] `synthetic.extensions`：对应的 CLI extension flags
- [ ] `synthetic.taskSeed`：完整的 task.json 种子数组（覆盖关键语义路径）
- [ ] `synthetic.artifactSeeds`：完整的 artifact 种子（fixtures + notes + maps）
- [ ] `requiredChecks` 中加入 `check:synthetic-e2e`
- [ ] 通过 `check:maturity` 一致性校验
- [ ] 通过 `check:synthetic-e2e` 回归验证
