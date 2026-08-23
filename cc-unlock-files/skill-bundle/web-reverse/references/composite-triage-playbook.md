# Composite Scene Triage Playbook

Version: 1

适用场景：目标同时命中多个防护层（反调试 + 混淆 + VMP + WASM + 指纹 + 会话耦合等），需要系统性地选择切入点顺序。

## 核心原则

- 先绕过、后分析；先取证、后深拆
- 切入点排序不是"哪个技术更酷"，而是"哪个阻碍必须先移除"
- 默认只保留 1-2 个活跃切入点

## 默认排序启发式

当复合场景同时包含以下专题时，按此优先级排序：

### T0（必须先处理）

1. **anti-debug** — 如果页面打开即暂停或 DevTools 触发异常
   - 原因：无法稳定观察后续任何链路
   - 成功后立即回到目标链路取证

### T1（第二优先）

2. **anti-tamper** — 如果存在 integrity / toString / Trusted Types 检测
   - 原因：后续 hook 可能被检测并导致行为漂移
   - 与 anti-debug 可并行评估，取成本较低者先试

### T2（第三优先）

3. **fingerprint** — 如果请求被拒绝或挑战路由异常
   - 原因：确认是"值差异"还是"自动化泄漏"，避免盲目补环境
   - 优先分离 generic fingerprint 与 automation leaks

4. **session / storage** — 如果存在 token / cookie / seed 依赖
   - 原因：stateful signer 的静默状态常是本地复现失败的主因
   - 优先追 carrier -> writer -> signer state -> reader 链
   - **决策提示（与上面 fingerprint 的次序）**：若已有 baseline cURL 能复现成功、仅"本地生成被拒"，先走 session / signer-state（carrier→writer→reader，重点查 msToken / device_id 等静默轮转态）**再**查 fingerprint——"请求被拒"更高频的根因是 stateful signer 静默状态而非指纹差异，先泛补环境/指纹常是浪费。只有 baseline cURL 本身也复现不了（换机/换 IP/换 TLS 栈即变）时，才把 fingerprint 提到 session 之前。

### T3（第四优先）

5. **bundle-loader / framework-runtime** — 如果目标函数分散在异步 chunk 中
   - 原因：需要先定位入口，才能有效 hook

6. **signature / protocol** — 当上述阻碍已移除
   - 原因：直接逼近验收边界

### T4（最后处理）

7. **jsvmp / wasm** — 仅当黑盒复用失败且明文边界不可复用时
   - 原因：深拆成本最高，验收回报率最低
   - 必须满足分流条件：黑盒失败 + 明文边界不可用 + 必须纯提取

## Rebuild 路线三岔决策（唯一决策源）

拿到（混淆）bundle、要决定怎么复现时，**先在这里做唯一一次 fork**，再进对应 playbook。`browser-controlled-reuse-playbook.md` 的对照表、`deliverable-ladder.md` 的 A~E 梯度、`SKILL.md` VM/WASM 优先级链都是本决策的下游展开，不要各自再造一套口径。

输入信号 → 三选一：

| 主导信号 | 路线 | 入口 |
|---|---|---|
| 纯算法可分离（依赖闭包 ≤ N、不深绑 DOM/网络/会话态；阈值 N 细则见 `closure-extraction-playbook.md` §0，默认 ~30） | **扣代码本地复现**（D/E） | `closure-extraction-playbook.md` |
| 强环境绑定 / 闭包爆炸 / 算法读大量环境值，但能整段跑 | **补环境跑原始 bundle**（D） | 起步骨架 `node-env-rebuild.md`（整段 bundle 起步路线 A/B）→ 判定/停止 `env-drift-decision-tree.md` → 补丁规范 `../docs/reference/env-patching.md` |
| 强会话态 / anti-bot 强 / 环境深度参与且难补 | **浏览器可控复用**（C） | `browser-controlled-reuse-playbook.md` |

回退条件：
- 选「扣代码」但 Extract 阶段 `externalSymbolCount > N`（N 见 `closure-extraction-playbook.md` §0，默认 ~30）或闭包爆炸 → 退回「补环境跑原始 bundle」。
- 选「补环境」但连续 2 轮 first divergence 不前移、疑似 anti-bot 行为面 → 退回「浏览器可控复用」。
- 选「浏览器可控复用」但用户明确要纯 Node/Python → 浏览器仅作中间证据，回到扣代码 / 补环境（见 `deliverable-ladder.md`）。

## 切入点评分公式

对每个候选切入点，评估三个维度：

| 维度 | 权重 | 评估标准 |
|---|---|---|
| 移除阻碍价值 | 40% | 不解決它，后续是否无法推进 |
| 执行成本 | 30% | 预计轮次、工具依赖、人工介入 |
| 复用价值 | 30% | 成功后对当前验收的直接贡献 |

得分最高且成本可控的优先试；默认最大轮次为 **2**。若命中 VM / WASM / 混淆主控制面并满足 permit 条件，可把当前 microRoute 升级到 `deepDivePermit` 预算。

## 默认两轮停损规则（复合场景强化版）

同一专题内：
- 若 anti-debug 两轮未解决，优先尝试 preload -> runtime -> breakpoint 三种注入时机切换
- 若 fingerprint 两轮未拿到 probe order，停止扩展向量面，直接记录已知泄漏
- 若 jsvmp/wasm 默认两轮未新增 decode/dispatcher/bridge/request-use 证据，先判断当前停掉的是不是低价值 microRoute；只有在未开启 `deepDivePermit` 或 permit 已到 `maxRounds / exitCondition` 时，才标记为 `PARKED` 并切换到 T3 层

补充规则：
- 复合场景同一时刻只允许 **1 条** VM / WASM / 混淆 microRoute 持有 `deepDivePermit`
- 其他专题先保持 probe-only 深度，直到拿到更高价值 entrypoint

跨专题时：
- T0 未解决前，不要默认深入 T3/T4
- T0 解决后，若 T3 已 PARKED，可重新评估 T2

## 禁止事项

- 不确认 anti-debug 状态就大面积 hook
- 不确认 fingerprint 探测顺序就开始泛补环境
- 不确认 signer state 链就开始怀疑算法本体
- 把"又多了解了一个内部 slot"当作跨专题推进

## 最低交付

- 候选切入点列表（含评分）
- 活跃切入点状态（CANDIDATE / PROBING / EXPANDED / PARKED / EXHAUSTED）
- 各专题阻碍清除状态
- 当前最接近验收的链路
