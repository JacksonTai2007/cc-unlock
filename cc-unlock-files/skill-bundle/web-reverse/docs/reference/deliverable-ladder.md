<!-- publish: framework -->
# Deliverable Ladder

先确定要交什么，再决定要不要继续深挖。

| 主模式 | 默认目标 | 最小交付 | 不要过度建设 | 何时升级 |
|---|---|---|---|---|
| 请求验收 | 请求 / 字段被接受 | `report.md` + `verify-once.mjs` + 样本/输入映射 | 不要默认强做纯算法迁移 | 只有浏览器链稳定但宿主迁移是硬要求时 |
| 内容 / 明文边界 | clear boundary / 内容层验证 | 边界说明 + 验证样本 + 验证脚本 | 不要把容器层验证误当内容层成功 | 只有需要脱离浏览器或解密交付时 |
| 浏览器内可控复用 | 用浏览器 harness 稳定完成验收 | `browser-controlled-repro.md` + `browser-repro-script.js` | 不要一上来强制 `pure-sign.py` / 纯算法 | 只有用户明确要求离线生成或浏览器复用不可维护 |
| 本地复现 / Port | Node/Python 最小骨架可跑 | 最小调用链、fixtures、verify 脚本 | 不要为了"完整"无边界扩 rebuild | 当黑盒骨架仍无法满足交付 |
| 纯算法提取 | 脱离浏览器稳定运行 | `pure_*.py/js` + fixtures + 校验 | 不要在前 4 层还没尝尽时就直接深拆 | 用户明确要求、宿主迁移必须、或前 4 层都不足 |

## 报告详实度轴（reportDepth，与交付梯度正交）

`deliverableTier` 决定「交什么成品」，`reportDepth` 决定「报告写多详细」，两者正交，落在 `task.json.deliveryRequirements.reportDepth`：

| reportDepth | 适用 | 对四类叙事段的要求 |
|---|---|---|
| `brief` | 纯请求验收、用户只要结果 | 逆向分析过程 / 主要算法说明 / 难点与对抗 / 调用示例 可省（仅软告警） |
| `standard`（默认） | 常规任务 | 软门槛：四段为空记 warning，不阻断 closeout |
| `deep` | 研究型 / 用户明确要详细报告 | **硬门槛**：四类叙事段必须非空，否则阻断 `task-close` |

`reportDepth` 触发方式：

- 显式：`task-input` 的 `requirements.reportDepth`
- NL 兜底：objective / title 命中「详细报告 / 调用示例 / 怎么实现 / 算法原理 / 难点 / 还原过程」等关键词时，自动置位 `reportDepth=deep`（见 `tools/task/common.mjs` 的 `inferReportDepthDeepFromSemantics`）
- 无论 `reportDepth` 取值，`## 主要算法说明` 都**无条件渲染**；`claimLevel ≥ route-ready` 时建议必填非空

## 用户目标强约束

如果用户明确要求：

- `纯 Python`
- `纯 Node / NodeJS`
- `不依赖 Playwright / Puppeteer / 浏览器框架`
- `本地请求获取 m3u8 + 下载 ts + 完成解密`

那么：

- 浏览器 harness / Playwright PoC 不能直接当最终 closeout
- 最多只能作为 `浏览器内可控复用` 或 `本地复现` 的中间证据
- 若本轮只能交付浏览器方案，必须显式写：`原目标尚未完成 + 当前 tier + 下一步迁移边界`

## 选择规则

- 每轮保留 1 个主模式 + 最多 1 个备用模式
- 默认先满足当前最小交付，再决定是否升级
- 如果用户只要浏览器内请求成功，不要把任务偷偷升级成"纯算法论文式交付"
- 如果后续证据表明当前梯度选高了，允许主动降级：例如从 `纯算法提取` 降回 `浏览器内可控复用` 或 `请求验收`

## 何时应该主动降级交付梯度

满足以下任一情况时，优先考虑降级，而不是继续硬顶高梯度：

- 浏览器 harness 已能稳定逼近验收，但纯算法路线在 probe 阶段连续两轮无新增验收证据
- 同一个 entrypoint 在 foundation 阶段连续 4 轮仍无法进入 probe（VM/WASM 任务：连续 8 轮）
- 当前最关键的未知项仍在会话态 / 生命周期 / request-use，而不是算法边界
- 用户真正要的是 accepted request / clear boundary，而不是脱离浏览器的长期运行件
- 当前深拆路线的成本已经明显高于它对最终交付的增益

## 降级不影响核心交付

降级意味着换一条更便宜、更贴近验收的路线，不意味着放弃用户需求。
降级时必须声明：
- 原梯度是什么
- 为什么当前梯度太高
- 降级后的新梯度是什么
- 哪些高成本路线被暂停（不是永久放弃，而是等更便宜的路线打通后再评估）

### 降级缓冲

降级后在新梯度至少执行 **3 轮**才能再次降级，防止降级螺旋（刚降级 → 1 轮不适应 → 再降级 → 最终降到请求验收以下）。降级后的前 3 轮为"梯度适应期"：不触发停损 pivot 但每轮仍需有效推进记录，连续 3 轮零推进仍触发 retrospective。第 4 轮起正常计轮。提前降级需满足 3 条件（核心路径被证明不可行 + 具体证据 + 非主观判断），连续两次提前降级触发强制 retrospective。完整规则见 `stop-loss-parameters.md`。

停损参数以 `docs/reference/stop-loss-parameters.md` 为单一致源。

## 本地经验在梯度决策中的作用

在决定升级或降级前，先检索本地经验（task-local 历史 + knowledge cards）：
- 同类任务历史上哪个交付梯度最终完成了验收？
- 是否有 known pitfalls 警告不要过早升级？
- 如果本地经验提示"同类场景中 pure extraction 成功率极低"，优先保持当前低梯度

本地经验不能替代当前任务的验证，但可以作为梯度决策的参考权重。
