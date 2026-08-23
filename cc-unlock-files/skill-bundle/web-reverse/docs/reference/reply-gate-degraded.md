# L1/L2 降级回复门禁手检清单

> 当 `assert-can-reply.mjs` 等脚本门禁不可用（L1/L2 降级）时，以下**硬检查**逐条代替脚本门禁，必须逐条核对、不得跳过。SKILL.md「回复与完成门禁」段只保留 L0 流程与禁语红线，完整手检在此。

> **铁律（合规 P0-1）**：只要 `assert-can-reply` 返回 BLOCKED（exit≠0），或下述任一硬检查判定"禁止回复"，就**等于任务未完成**。此时禁止输出任何用户可见的交付性回复（"已完成/已成功/已闭环/已实现"的总结、把表头标成"已验证"、贴成功结论），只能继续执行 `nextExecutableAction`。复述 BLOCKED 原因、或把它软化成"基本完成/已基本跑通"同样违规。

准备发送任何用户可见回复前，按顺序核对：

1. `execution.status` 是否为 `ready-to-continue`？是 → 检查 `pauseCategory`
2. `pauseCategory` 是否为 `none`？是 → **禁止回复**，必须继续执行
3. `pauseCategory` 是否为 `user`？是 → 用户是否已完成协作动作？未完成 → 允许回复（请求协作）；已完成 → **禁止回复**，必须先执行 `node $TOOL_DIR/task-advance.mjs <task-id> --resume-from-user`（task-advance 不可用时手动更新 `route-state.json`：`pauseCategory` 设为 `none`、`execution.status` 设为 `ready-to-continue`，然后立即执行 `nextExecutableAction`）
   - **铁律（反伪装）**：`pauseCategory=user` 只能用于**真实存在、待用户完成的协作动作**（如等用户登录/输短信验证码/授权）。**不得借 `pauseCategory=user` 伪装协作请求来绕过 provider 搜索门禁（#7b/#8/#9/#10）或验收门禁（#6/#7）**；若并无真实待用户动作，必须按 `nonUser`（即 `none`）处理，照常施加搜索/验证门禁。
4. `pauseCategory` 是否为 `risk`？是 → 允许回复（确认风险）
5. `execution.status` 是否为 `completed`？是 → 允许回复
6. 是否准备声明"已完成/已交付"？是 → 必须提供以下 3 项硬证据：`verify-once.mjs` 成功运行记录 + `fixtures.json` 存在 + `acceptanceGap` 为空。**挑战链/验证码/滑块类任务（模式 A）额外要求**：验收 = 端到端服务端返回成功（求解器实际通过、`error==0` 且业务校验通过），**不是"格式被接受 / `validate-fixture` 通过 / JSON 字段齐全"**；该端到端成功必须由 `verify-once.mjs` 复现，否则 claimLevel 最高停在 `provisional`，**禁止**声明完成。
7. `completionCriteria` 是否非空且每条 ≥10 字符且无 "done/完成/ok/pass" 等模糊条目？`intermediateStatesNotDelivery` 是否非空？`acceptanceGapDefined` 是否为 true？任一为否 → **禁止回复**"已完成/已交付"，先补齐契约字段
7b. 任务目标 / `state/clues.md` / 防护特征里是否出现**已知商业保护或验证码 provider**（易盾/dun163、瑞数、数美、极验 geetest、顶象、akamai、perimeterx、datadome、cloudflare turnstile、recaptcha 等）且 `searchRounds==0`？是 → **禁止回复**，**首轮即搜**（不等"连续两轮无进展"）：用 provider 名 + host + 错误码/字段名执行一轮 `mcp__web-search__search_bing`（GitHub→全网两级），结果落 `state/external-research.md/json` 并更新 `externalRefs.lastSearchRound/searchRounds`。这类 provider 有大量现成公开逆向资料，零搜索硬啃是已记录的事故成因。
8. `searchRounds` 是否为 0 且 `roundsConsumed >= 3` 且存在 wasm/jsvmp/商业保护信号？是 → **禁止回复**，立即通过 `mcp__web-search__search_bing` 执行搜索：从当前 task 的 host/字段名/函数名/错误信息中提取 2~3 个关键词作为 `query`，`context="保护识别"`，按 `references/web-search-tool.md` 定义的两级流程执行（GitHub → 全网搜索）。**搜索"落盘"才算搜过**：`searchRounds+1` 但 `external-research.md` 无实质内容、`matchedRefs/resultDigest` 全空 = 假搜索，门禁仍判 BLOCK。
9. `knowledgeGap` 是否为 true 且 `roundsConsumed - lastSearchRound >= 1`？是 → **禁止回复**，立即通过 `mcp__web-search__search_bing` 执行搜索：`query` 为当前 feature bundle 中的字段名/函数名/症状关键词，`context="知识缺口填补"`，按两级流程执行
10. `searchMode` 是否为 `auto` 且 `searchRounds` 是否为 0 且 `roundsConsumed >= 5`？是 → **禁止回复**，立即通过 `mcp__web-search__search_bing` 执行搜索：`query` 为 host + 核心症状关键词，`context="方向确认"`，按两级流程执行

## 搜索 query 参数填充优先级

当门禁触发但缺少具体字段名/函数名时，按以下顺序填充，禁止传空 query：

1. 有具体字段名/函数名/错误码 → 直接使用
2. 无字段名但有 host 域名 → 使用 host 域名
3. 无 host 但知道目标站点名称 → 使用站点名
4. 以上全无 → 使用用户原始描述的前 5 个关键词

## 门禁记录

每次执行硬检查后，必须在 `report.md` 的 `## 门禁记录` 段落追加一行：`[门禁] YYYY-MM-DDTHH:mmZ | 检查项 #N (含契约健康 #7/搜索就绪 #8#9#10) | 结果: 继续执行/允许回复/禁止回复 | 依据: <具体状态值>`。此记录是硬检查被执行过的唯一可审计证据——无记录视为未执行门禁。

若准备输出"已完成 / 已成功 / 已交付 / 已闭环"，L0 下再运行 `assert-can-reply --require-validated-deliverable`；L1/L2 下执行上述第 6~7 条。
