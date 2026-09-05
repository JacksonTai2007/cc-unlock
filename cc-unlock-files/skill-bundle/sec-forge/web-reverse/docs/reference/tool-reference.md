# Tool Reference

`web-reverse` 默认不捆绑新的 MCP server，实现层优先依赖现有工具。

在任务推进上，仓库内置 CLI 工具是第一层协议面，浏览器 / web-search MCP 全网搜索只是执行面。

## 仓库内置任务工具

生命周期工具：

- `task-start` / `npm run task:start --`
- `task-init` / `npm run task:init --`
- `task-sync` / `npm run task:sync --`
- `task-advance` / `npm run task:advance --`
- `task-close` / `npm run task:close --`

校验与构建工具：

- `npm run check`
- `npm run check:doc-facts`
- `npm run build:doc-facts`
- `npm run build:topics`
- `npm run check:websearch-contract`

## 浏览器与页面

- `chrome-devtools-mcp`
- 或等价的 DevTools / Playwright / Puppeteer 接管能力

## 外部搜索

- 使用 `web-search` MCP Server（`mcp__web-search__search_bing` 搜索，`mcp__web_reader__webReader` 获取页面内容）
- 优先官方文档、GitHub、issue、标准、供应商文档
- 外部搜索只用于：
  - provider / SDK / protocol 家族识别
  - entrypoint 纠偏
  - probe 成本下降
- 外部搜索不能替代运行时 capture 与最终验证

## 搜索与浏览器 harness 的位阶

- 如果浏览器运行时已经是可靠真源，优先把它变成可控 harness
- 只有当 harness 路线仍不足以解释 provider / family / 协议归类时，再让搜索介入纠偏

## 分阶段工具优先级

### RouteSync / Observe
- 先用 `task-sync` / `task-advance` 恢复状态和下一步
- 再决定 `taskMode / deliverableTier / primaryTopic`
- 浏览器侧优先做脚本 / 请求 / initiator / source triage

### Capture / Patch
- 浏览器调试、hook、trace、network、console 是主工具面
- 先做高语义 capture，再考虑低层 hook
- 显式 env error 消失但验收仍失败时，先回到 Capture，不要盲目继续补环境

### Rebuild / Port
- 以最小可运行骨架为主，不要无限扩建
- 只有当前 `deliverableTier` 明确要求离线运行时，才继续纯算法实现

### Close
- Close 不是“写完报告就结束”，而是验证、补齐 closeout artifact、再执行 `task-close`
- 若还没通过 `assert-can-reply --require-validated-deliverable`，不要提前跑收尾结论
- Close 阶段仍要检查 `report / fixtures / verify / retrospective / external-research` 是否齐备

### Retrospective / Pivot
- 优先复用已有 task artifact、样本、route-state
- 必要时进行全网搜索（`mcp__web-search__search_bing`）或 browser-controlled reuse
- retrospective 结果必须落入 `run/retrospective.md`

## 主要工具动作

- Startup Gate：检查 history data files，决定是 `task-start -> task-init` 还是直接续跑
- 若 external workspace 是空目录，仍然直接用当前 skill repo 的 `tools/task/*.mjs` 初始化；不要要求外部 workspace 自带 `tools/task/`
- task pack 初始化：用 `--topic=`、`--topics=` 或 topic alias flag 预挂对应专题模板
- 状态恢复：`task-sync` 恢复 `route-state.json`、回写 Markdown，并刷新首轮 `execution`
- 续跑决策：`task-advance` 重新评估 `execution.status / nextExecutableAction`
- 页面观察：列脚本、搜源码、列请求、看 initiator
- 运行时采样：hook、preload hook、trace、console
- 本地复现：导出脚本、固化样本、跑 Node rebuild
- env conformance：检查 descriptor、scheduler、typed-array、crypto 与 storage 行为偏差
- 深挖：AST 去混淆、VM dispatcher 追踪、WASM 反汇编
- 全网搜索：通过 `mcp__web-search__search_bing` 必要时做 provider / protocol / SDK / issue 搜索，并回写 `externalRefs`
- 收尾：验证通过后执行 `task-close`，而不是把 Close 当作文档整理动作

## Workspace Bridge

- 如果 workspace 根目录已有 `run/verify-once.mjs`、`run/run-local.mjs`、`run/local-repro-example.js`、`run/web-replay.js`
- 且 task-local 中对应文件仍然是模板占位
- `task-sync` / `task-close` 会自动写入代理脚本，把 task-local 调用桥接到 workspace 现有实现
- 这类 bridge 只用于复用已有可运行脚本，不替代 task artifact 本身的落盘要求
