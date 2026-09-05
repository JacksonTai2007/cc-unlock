# Reverse Report Template

`report.md` 保持文件名不变，但内容必须使用中文标题、中文正文和中文项目符号说明。
只有代码、文件名、命令名、协议字段名、接口字段名可保留原文；不要输出英文版或中英双语版报告。

推荐结构：
1. 任务摘要
2. 路径真源与任务根
3. 任务模式与交付梯度
4. 当前阶段
5. 浏览器会话
6. 证据状态与结论级别
7. 验收缺口与下一证据门
8. 逆向分析过程（还原链路叙事）
9. 主要算法说明（算法还原说明）
10. 难点与对抗
11. 调用示例（自包含本地复现交付）
12. 切入点循环
9. 算法边界状态
10. 动态输入来源
11. 请求验收状态
12. 非确定性说明
13. 本地复现交付
14. 目标上下文
15. 防护等级
16. 事实
17. 推断
18. 未决问题
19. 首个分叉点
20. 补环境一致性状态
21. 验证结果
22. 交付采纳与真实使用路径
23. 产物路径
24. retrospective / pivot（如发生）
25. 下一步

推荐标题：
- `## 任务摘要`
- `## 路径真源与任务根`
- `## 任务模式与交付梯度`
- `## 当前阶段`
- `## 浏览器会话`
- `## 证据状态与结论级别`
- `## 验收缺口与下一证据门`
- `## 逆向分析过程`
- `## 主要算法说明`
- `## 难点与对抗`
- `## 调用示例`
- `## 切入点循环`
- `## 算法边界状态`
- `## 动态输入来源`
- `## 请求验收状态`
- `## 非确定性说明`
- `## 本地复现交付`
- `## 补环境一致性状态`
- `## 存在性判定`
- `## 会话生命周期状态`
- `## 目标上下文`
- `## 防护等级`
- `## 源映射状态`
- `## 虚拟机状态`
- `## WASM 状态`
- `## 反调试状态`
- `## 注入策略`
- `## 工作线程状态`
- `## 协议状态`
- `## 浏览器可控复用状态`
- `## 页面框架状态`
- `## 存储状态`
- `## 指纹状态`
- `## 包加载器状态`
- `## 动态代码状态`
- `## 事实`
- `## 推断`
- `## 未决问题`
- `## 首个分叉点`
- `## 验证`
- `## 交付采纳与真实使用路径`
- `## 产物路径`
- `## Retrospective / Pivot`
- `## 下一步`

关于 `## 下一步`：

- 若当前 `claimLevel=delivered` 且已完成 `task-close`，可以明确写“无额外执行动作”
- 若尚未 `delivered`，`## 下一步` 必须写成可执行动作，而不是“继续分析”

最低建议在报告顶部写清：

- `workspaceRoot / taskLocalRoot / artifactTruthRoot / workspaceKind`
- `taskMode`
- `deliverableTier`
- `primaryTopic / secondaryTopics`
- `claimLevel`
- `evidenceStatus`
- `acceptanceGap / nextEvidenceGate`

推荐直接使用一个顶部摘要块：

```text
- workspaceRoot:
- taskLocalRoot:
- artifactTruthRoot:
- workspaceKind:
- taskMode:
- deliverableTier:
- primaryTopic:
- secondaryTopics:
- claimLevel:
- evidenceStatus:
- whyNotDeliveredYet:
- acceptanceGap:
- nextEvidenceGate:
```

如果本轮发生路线级停损，还应补：

- 已降级或废弃的假说 / entrypoint
- 保留证据
- 新主模式 / 新 entrypoint
- `run/retrospective.md`

无论单路线还是复合路线，`## 切入点循环` 都建议至少写出：

- `activeEntrypoints`
- 每个 entrypoint 的 `status`
- 当前 `execution.nextEntrypointId`
- 当前 `execution.nextExecutableAction`

如果当前主模式是浏览器内可控复用，建议额外写：

- 当前 harness 是否已经拿到 accepted request / clear boundary / 稳定重放
- 为什么当前不继续升到 pure extraction
- 浏览器版本、关键启动参数、拦截面

推荐在 `## Retrospective / Pivot` 中至少写出：

- 触发原因
- 已降级假说
- 冻结清单
- 新 entrypoint 排序

如果当前已进入 Close，建议把以下内容紧贴报告尾部：

- 已执行的验证命令
- 验证摘要
- `usedArtifacts / unusedArtifacts / acceptancePath`
- 是否已执行 `task-close`
- 若尚未 `task-close`，说明为什么还不能收尾

如果当前允许暂停，`## 下一步` 不要只写“等待用户配合”，而应写成 `requiredUserAction / resumeCondition`。

## 报告详实度四段的结构化骨架与填充要点

这四段由 `tools/task/task-close.mjs` 白名单 upsert 渲染，真源为 `state/narrative.md`。正文负责「知识浓缩」，`run/*.md` 负责「原始取证存档」——只有路径指针不算交付完成。

`## 逆向分析过程`（还原链路叙事，即便无 pivot 也写 3~6 个关键节点）：
- 入口怎么定位（XHR 面板 / 调用栈回溯 / 关键字搜索 / hook）
- 为什么先看这个函数（取舍理由）
- 关键取证点（断点 / 日志 / fixtures 命中）
- 逐步还原的关键决策与试错（哪条假说被推翻、为什么换路）

`## 主要算法说明`（结构化；`claimLevel ≥ route-ready` 起强烈建议非空，`reportDepth=deep` 时为硬门槛（closeout/verify 阻断））：
- 算法家族与判定依据：`HMAC-SHA256 / AES-CBC / 魔改 MD5 / JSVMP 内联` 等 + 判定证据
- 输入清单：每个输入字段 + 来源（请求参数 / 时间戳 / nonce / 设备指纹 / 会话态）
- 归一化规则：canonical string 的字段排序、分隔符、编码、大小写
- 密钥材料：`key / iv / salt / nonce` 来源与派生链（硬编码 / 动态下发 / 指纹派生）
- 输出与 carrier：放进哪个 header / body 字段、编码方式
- 一组真实「输入 → 输出」样例（脱敏）
- 最小伪代码（5~15 行可复现）
- 数据流图（文本版，如 `ts+nonce+body → sort → canonical → HMAC(key) → base64 → X-Sign`）

`## 难点与对抗`：
- 保护清单（反调试 / anti-tamper / 补环境 drift / 复合保护层 命中项）
- 每个卡点的突破手法 + 验证（卡点 → 突破方法 → 如何验证已突破）
- 残余风险（仍未对抗 / 仅部分绕过 / 可能失效的点）

`## 调用示例`（凡 `deliverableTier ∈ {本地复现, 纯算法提取}` 或 `run/` 下有可执行成品脚本则强制非空且自包含）：
- 依赖与安装命令
- 完整运行命令
- 样例输入（脱敏）
- 预期输出片段（脱敏）——须贴脱敏后的真实输出文本（如签名值前后缀、响应关键字段），不接受仅填 `run/xxx` 路径指针
- API 任务：完整请求（method / url / headers / body）与响应样本片段
