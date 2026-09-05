# Signature Playbook

适用场景：

- 请求链路包含 `sign / signature / x-sign / x-t / nonce / timestamp`
- 需要还原 canonical string、参数排序、session 混入、动态输入来源与本地请求验收
- 需要从浏览器证据迁移出可重复的参数生成实现
- signer 结果依赖 `cookie / storage / memory` 中的静默状态，而不是只靠显式参数

工作顺序：

1. 先定位签名字段、签名函数入口和真实请求绑定点
2. 再拆输入边界：参数归一化、拼串顺序、时钟窗口、session / storage 采样
3. 明确动态输入来源：`timestamp / nonce / random seed / runtime state / worker / frame`
4. 先做一次最小 swap matrix：区分 baseline signer、local signer、baseline session、local session 各自的影响面
5. 再确认算法家族：摘要、HMAC、验签或多段组合
6. 最后做最小本地请求脚本，验证参数生成链路正确且服务端接受；只有用户明确要求时，才追求更高保真的 replay 还原

## 工具驱动配方（能力语言 · 工具无关）

下面用**能力语言**写动作，不绑定具体工具。每个能力对应你手上浏览器 MCP 的哪个 API，查 `browser-mcp-capability-map.md`（先做 Step 0 工具探测）。**关键纪律：sign-call 取证用「钩函数·抓入参/返回」能力，不要用反复盲注 `evaluate_script`/`execute_script` 代替——那是缺工具的退化打法。**

1. **抢定义 / 压制反调试**：用「页面 JS 执行前注入」能力，在页面脚本运行前埋好 hook（否则 signer 定义、anti-debug 早已执行完，错过取证窗口）。
2. **定位请求发起点**：对目标请求（如 check / 提交接口）用「定位请求发起点」能力，从请求直接跳到调它的 JS 调用栈——把你从"满网络面板找"直接送到 sign 调用现场。
3. **钩 signer 抓入参 / 返回 / 调用栈**：用「钩函数·抓入参/返回」能力钩住签名函数，一次触发拿到：① 入参（canonical 串、nonce/timestamp）② 返回（签名值）③ 调用栈（谁、在哪、读了什么 state）。比盲注稳、快、不易触发反调试。
4. **必要时断点单步**：算法在 VM/混淆里看不清时，用「断点 + 调用栈 + 单步」能力停在 signer 内部逐步看变换；或用「XHR/fetch 断点」在请求触发瞬间暂停回溯。
5. **全量源码定位**：signer 入口未知时，用「全量源码搜索 / 读脚本源」能力按字段名 / 字面量（`sign`、自定义 base64 表、provider 关键字）搜定位再读源。
6. **网络验收**：用「网络捕获 + 响应读取」能力对比 `original cURL` 与 `local signed request`（见下文对比验证）。

> chrome-devtools 用户：上面 1/3/4/5 多数无原生支持，走 `evaluate_script` 猴补丁 fallback（见能力表）；2/6 有原生支持。

## 关键参数载体检查（硬约束）

1. 关键参数必须逐项检查载体，不得默认只在 URL：
   - `header`
   - `query`
   - `cookie`
   - `runtime state`（内存 signer state / worker / frame cache）
2. 任一关键参数如果在 `header` 出现（例如 `x-ms-token` 这类 header-only 参数），必须在 `signature-input-map` 与 `signature-fixtures` 中显式记录
3. 若参数存在镜像关系（如 `header <-> runtime signer state`），必须记录同步方向与时机；只改 query/cookie 不算完成
4. 命中 stateful signer 时，本轮必须补 `carrier matrix`（参数名 -> 载体）与 `sync checks`（签名前同步校验）

## 对比验证（默认建议）

- 同一轮同时验证：
  - `original cURL`（原始样本）
  - `local signed request`（本地签名样本）
- 目的：区分“样本本身失效”与“本地算法/状态偏差”，避免把样本退化误判为算法问题

## 外部搜索纠偏（重点增强）

当出现以下症状时，建议至少做一轮结构化全网搜索（用你环境内可用的 web 搜索能力执行，具体工具见 `docs/reference/tooling-degradation.md` 降级表；如有 `mcp__web-search__search_bing` 则用它，执行细则统一以 `references/web-search-tool.md` 为准）：

- `baseline_ok_generated_rejected`
- `200 + 空体`
- `silent reject`
- `x-bogus / x-gnarly / msToken / x-ms-token` 长度看起来正常但仍被拒
- 命中公开 provider / SDK / signer family 高信号

### 搜索目标

- 识别签名字段是否属于已知家族
- 识别 header / runtime state / query 三者是否存在镜像关系
- 判断当前问题更像“算法主体错误”还是“静默状态 / carrier 错误”
- 修正 entrypoint 与 probe 选择

### 搜索要求

- 搜索关键词优先来自当前任务输入（字段名、错误症状、函数名、provider 线索）
- 优先高质量来源：官方文档、GitHub、issue、公开 SDK、逆向分析
- 搜索结果只能作为**路线启发**，不能代替浏览器证据与请求验收
- 若采用外部线索，必须回写 `state/external-research.md` 与 `state/external-research.json`

## 最低交付

- `run/verify-once.mjs`
- `run/signature-input-map.md`
- `run/signature-fixtures.json`

按需补充：

- `run/web-replay.js`
- 如果用户显式要求“本地复现”，再补 `run/local-repro-example.js`
- 如果本地复现目标就是 API 请求，`run/web-replay.js` 必须作为 API 调用示例实际打印响应数据摘要

命中 stateful signer 时，额外补充：

- `run/signer-state-map.md`

`run/signer-state-map.md` 至少记录：

- 签名字段与对应 signer state 键位
- carrier：`cookie / localStorage / sessionStorage / memory / worker / frame`
- writer：谁把 carrier 同步到 signer state
- reader：签名前哪段逻辑读取该状态
- request-use：最终影响哪个 header / query / body 字段
- refresh / rotate / invalidate 条件
- carrier matrix：关键参数在 `header / query / cookie / runtime` 的分布
- sync checks：签名前已执行的同步检查项（例如 `runtime.msToken` 与 header/query 的一致性）

## 注意事项

- 不要只抓最终签名值，不追踪输入来源
- 不要忽略 `nonce / timestamp / session / storage` 的混入路径
- 默认成功条件是“参数生成边界已复现 + 本地请求成功 / 服务端接受”，不是最终签名字节逐字一致
- 含 `timestamp / nonce / random seed / RSA / OAEP / random iv / salt / padding` 的场景，要先说明非确定性来源，再决定如何验收
- 请求失败时先回看输入边界、动态输入和静默状态，不要直接怀疑算法本体
- 不要把“X-Gnarly 长度看起来正确”当作验收通过；仍需看请求是否被服务端接受
- 不要假设 `msToken` 只在 query 或 cookie；关键参数可能是 header-only 并与 runtime state 同步
- 若 swap matrix 已证明“只换本地 signer 就失败”，优先追 `signer state` 写入链，不要继续泛补环境
