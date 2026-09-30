# 浏览器 MCP 能力映射（以当前宿主为准）

方法论描述“需要观察什么”，工具文档决定“实际上能调用什么”。`chrome-devtools`、`js-reverse`、`stealth-browser` 与 `mcp__cua_repl` 都只是可能存在的表面；旧名称、旧版本能力表和网页里的调用示例不能证明本机 API 存在。

## Step 0 · 一次能力确认，不盲调

1. 看宿主已暴露的工具名称、schema 和描述；工具可延迟发现时，用宿主提供的工具目录/发现机制查需要的能力，不猜工具名。没有任何浏览器工具就保留本地样本分析路径，不用不存在的 CDP 补洞。
2. 对当前任务真正需要的能力读取该工具的现有文档；确认参数、返回值、会话身份及限制。只有文档声明且宿主允许的 API 才可调用。某工具能浏览页面，不等于它能执行任意 JS、开 CDP、取响应正文或设原生断点。
3. 把实际确认结果简短记在既有任务记录：`tool / browser / tabId / capability / available-or-unavailable / evidence`。无需每轮列全部工具或重做试探；工具集合、会话或 API 错误改变时只更新对应项。

### 当前表面：`mcp__cua_repl`

- 按该工具当前文档的初始化规则执行；**首次调用或 reset 后恰好一个入口 API**，不能拼接其他调用、等待或 snapshot。只有需要 inventory 时才用 `await cua.getState()`；已知用户指定的 tab/URL/browser 时，使用文档给出的对应入口。
- 读取初始化返回的文档与 UI 状态之后再继续。上下文恢复时按该工具要求恢复文档；持久 REPL 变量失效则重新绑定，不猜旧 tab handle。
- 只使用返回文档列出的 tab/browser 能力。DOM、网络、源码、JS 运行和调试能力若未提供，标注 `unavailable`，走本地样本或用户已给出的捕获数据；不能凭 `cua_repl` 名称自创 `tab.evaluate`、`execute_cdp_command`、`Network.enable` 等调用。
- 工具允许的页面脚本权限不由本 skill 扩大。不要用 fetch、注入或隐藏浏览器替代一项被宿主明确禁止的操作。

## Step 0.5 · 保留浏览器与标签页身份

沿用用户指定工具及表面。首次 `task-boot` 可带 `--browser-mcp=<actual-server-name>`（如 `cua-repl`）；已有任务复用 `browserSession.pinnedMcp` 及 tab/session 记录，不为重新登记而重复 boot/init。

保持同一浏览器实例、标签页和登录态，避免为一个缺失能力静默换 MCP 或新建目标。一个工具缺调试能力不代表必须换浏览器；先看当前工具文档是否有等价手段。确需改用户指定表面、改变登录态或增加外部动作时，只问具体范围问题。反检测效果以本任务实测为准，没有通用“最强”工具；未观察到的挑战污染或假响应仅是待验证假设。

## 从需求到能力（不是固定 API 表）

| 需要的证据 | 先确认的实际能力 | 当前表面无此能力时 |
|---|---|---|
| 全量源码搜索 / 读脚本 | 源码枚举、source 查询或已加载文本导出 | 分析已授权取得的本地 bundle/source map；DOM 只列出的脚本 URL 不等于全量源码 |
| 请求发起点 | 网络记录中的 initiator / 调用栈 | 使用已有 HAR/trace；仅在工具文档允许页面脚本及作用域时做最小观测 hook |
| 页面运行前观测 | 文档明确的新文档脚本或 preload 能力 | 加载后观测只覆盖此后执行，明确漏掉早期事件；没有 preload 不宣称抢到定义 |
| 函数入参 / 返回 / 栈 | 原生 trace/hook 或获准的脚本执行能力 | 本地最小 harness 对同一函数采样；不要连续盲注猜对象 |
| 断点 / 单步 / XHR 暂停 | 文档确认的 debugger / breakpoint 能力 | 允许范围内用日志观测；注入 `debugger;` 没有可读 debugger 时不等于取得暂停栈 |
| 请求 / 响应正文 | 网络监听、响应读取及数据权限 | 已有 HAR/代理捕获；DOM 或 performance 条目不能冒充完整网络取证 |
| 跨 frame / worker 状态 | frame/worker context 选择与关联 | 分别分析已取得样本并标注关联缺口，不自创 context 参数 |

CDP 只是**已暴露、已允许**时的可选通道；必须先读取其文档及当前 session 可用域。`Page.addScriptToEvaluateOnNewDocument`、`Debugger.setBreakpointByUrl` 等协议名是能力线索，不代表某 MCP 存在同名调用。

## 旧 MCP 示例如何使用

若宿主实际暴露相关工具，再查其 schema：`search_in_sources` / `get_script_source` 可作为源码能力关键词，`get_request_initiator` 可作为发起点关键词，`trace_function` / `create_dynamic_hook` 可作为函数观测关键词，`inject_before_load` 可作为 preload 关键词，`list_network_requests` 可作为网络能力关键词。**这些名称不组成可直接执行的调用清单**；版本不同可能改名、删除或有不同参数。

## Hook 语义与验收

优先级沿用主 SKILL：`request-use → sign/decrypt-call → payload/clear-boundary → dispatch → reader → writer → bridge → 低层`。先说明一次观测要区分的假设，再选当前工具允许的最小动作；同一疑点无新证据最多三次，随后换语义层或转本地复现。

采集入参、返回、调用栈与控制变量，不把“工具调用成功”当算法正确；验收仍按用户要求的本地输出或服务边界。此映射不增加目标、扫描、请求或网络权限。
