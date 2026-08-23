# 浏览器 MCP 能力映射（工具无关执行层）

本 skill 面向众多用户，大家用的浏览器 MCP 不同（`chrome-devtools` / `js-reverse` / `stealth-browser` / 其它 CDP 系）。
**方法论（钩哪一层、为什么）与工具无关；本表把"方法论需要的能力"映射到你手上工具的具体 API。**
任何工具的用户读同一套方法论，再按本表把正确动作落到自己的工具上。**skill 不替你选工具**——只保证"无论用哪个，都知道正确的下一步动作"。

## Step 0 · 先做工具探测

开工前先确认你**实际拥有**哪个浏览器 MCP（看可用工具里的 `mcp__<server>__*` 前缀）：

- `mcp__chrome-devtools__*` → 走 **chrome-devtools** 列
- `mcp__js-reverse__*` → 走 **js-reverse** 列
- `mcp__stealth-browser-mcp__*` → 走 **stealth-browser** 列
- 都没有但能发 CDP → 走 **通用 CDP fallback**

**反检测优先级**：强风控目标（验证码 / akamai / datadome / 易盾 / 瑞数等）优先用过检测最强的工具（一般是 stealth-browser）。**反检测强弱以目标实测为准**——没有工具对所有风控都"绝对最强"，CDP 痕迹（如 `Runtime.enable` 泄漏）需对具体目标单独验证，别迷信单一工具。若它缺某高层调试能力（如原生断点），用该列的 **fallback** 补，而不是为了一个能力换到会被风控识破的工具——**被识破 → 拿到的是假挑战/假响应，整条逆向被污染**。

## Step 0.5 · 锁定优先（防工具漂移）

**一旦确定了用哪个浏览器 MCP（用户显式指定，或你按反检测优先级选定），就只认这一列，整条任务不换。** 把它锁进任务契约：
`node $TOOL_DIR/task-init.mjs <task-id> --browser-mcp=<stealth-browser|js-reverse|chrome-devtools>`（已建任务可在 task-input 里给 `browserMcp`）。锁定后 `task-advance` 每轮打印 `execution.discipline.rule=pinned-browser-mcp=<name>`。

> **本表读法（关键，违反即目标漂移）**：先认你被锁定的那一列；该列里 ⚙️ / ❌ 的能力，**一律走本列「无原生时的 fallback」**，**不要因为另一列对同一能力是 ✅ 就切过去**。表里的 ✅/⚙️/❌ 只描述"这个能力在这个工具上原生与否"，**不是让你挑工具的评分**——跨轮回头看这张表时，最容易犯的错就是"js-reverse 断点是 ✅、我手上的 stealth 是 ⚙️，那换 js-reverse 吧"。换 MCP = 换浏览器实例 = 风控指纹变化，**轻则丢登录态/会话，重则拿到假挑战污染整条逆向**。确需换工具：先向用户确认，再 `task-init --browser-mcp` 重锁，绝不静默切换。

## 能力映射表

> 列含义：✅ 原生支持 ／ ⚙️ 经 `execute_cdp_command` 等间接支持 ／ ❌ 无原生（用 fallback）。
> **再次强调**：这些标记描述"能力在该工具上是否原生"，**不是工具优劣评分**。只读你被锁定的那一列，⚙️/❌ 走本列 fallback，别跨列换工具（见 Step 0.5）。

| 逆向核心能力（方法论需要） | chrome-devtools | js-reverse | stealth-browser | 无原生时的 fallback |
|---|---|---|---|---|
| **全量源码搜索 / 读脚本源**（按字符串定位 signer） | ❌ `evaluate_script` 遍历 | ✅ `search_in_sources`/`list_scripts`/`get_script_source`/`save_script_source` | ⚙️ `execute_script` 遍历 `performance.getEntries`/全局 | 用 `evaluate_script`/`execute_script` 注入脚本收集所有 `<script>`/`importScripts` URL 再逐个拉取 |
| **定位请求发起点**（req → 哪段 JS 调的） | ✅ `get_network_request`（含 initiator 调用栈） | ✅ `get_request_initiator` | ❌ `get_request_details`（看是否带 initiator）/ ⚙️ `execute_cdp_command` Network | 猴补丁 `XMLHttpRequest.open`/`fetch`，在拦截处 `new Error().stack` 打印调用栈 |
| **页面 JS 执行前注入 hook**（抢 signer 定义、压制 anti-debug） | ❌ | ✅ `inject_before_load` | ✅ `add_script_to_evaluate_on_new_document` | ⚙️ CDP `Page.addScriptToEvaluateOnNewDocument`；都没有则导航前置脚本不可靠，改为"导航后立刻 patch + 必要时重载" |
| **钩函数·抓入参/返回**（sign-call 取证，**最高频**） | ❌ `evaluate_script` 猴补丁 | ✅ `trace_function` | ✅ `create_dynamic_hook`/`create_simple_dynamic_hook`（先看 `get_hook_examples`/`get_hook_common_patterns`） | 猴补丁：`const _o=obj.fn; obj.fn=function(...a){const r=_o.apply(this,a); /*收集 a 与 r*/ return r;}` |
| **断点 + 调用栈 + 单步** | ❌ | ✅ `set_breakpoint_on_text`+`get_paused_info`+`step`+`select_frame` | ⚙️ `execute_cdp_command`（Debugger.setBreakpointByUrl / 读 paused 帧） | 在目标函数体内注入 `debugger;`（猴补丁）+ 人工/脚本读取上下文；无调试器时退化为函数 hook |
| **XHR/fetch 断点**（请求触发即暂停） | ❌ | ✅ `break_on_xhr` | ⚙️ `execute_cdp_command`（Fetch.enable 拦截） | 猴补丁 `fetch`/`XHR.send`，命中目标 URL 时 `debugger;` 或落日志 |
| **网络捕获 + 响应读取** | ✅ `list_network_requests`/`get_network_request` | ✅ `list_network_requests` | ✅ `set_network_capture_filters`/`list_network_requests`/`get_response_content`/`search_network_requests`（强） | 猴补丁收集 + `get_response*` |
| **运行期函数/对象发现** | ❌ `evaluate_script` 反射 | ⚙️ `evaluate_script` | ✅ `discover_global_functions`/`discover_object_methods`/`inspect_function_signature` | `evaluate_script` 遍历 `window`/原型链 |

## 把"Hook 语义分层"落到能力上（与 SKILL.md 的 Hook 纪律对应）

SKILL.md 的语义优先级（`request-use → sign-call → payload → dispatch → reader → writer → bridge → 低层`）对应到能力：

1. **request-use（请求发起点）** → 用「定位请求发起点」能力，从 check/提交请求直接跳到调它的 JS。
2. **sign-call（签名/加密函数）** → 用「钩函数·抓入参/返回」能力钩住 signer，拿到**入参 + 返回 + 调用栈**——这是 sign 还原的核心一步，**不要用反复 `evaluate_script` 盲注代替它**。
3. **抢定义 / 反反调试** → 用「页面 JS 执行前注入」能力在加载前埋 hook。
4. **payload/clear-boundary** → 钩序列化/编码点。

> 经验教训：缺这层映射时，模型会退化成"用 `evaluate_script`/`execute_script` 一次次盲注试探"——慢、脆、易触发反调试。先按本表选对**能力**，再落到你工具的 **API**。

## 给三类用户的一句话（认你锁定的那一列，不跨列换工具）

- **被锁定 stealth-browser**：sign-call 取证用 `create_dynamic_hook`（先翻 `get_hook_examples`），抢定义用 `add_script_to_evaluate_on_new_document`，**需要断点/XHR 断点就经 `execute_cdp_command` 走 fallback——不要因为 js-reverse 有原生断点就切过去**。
- **被锁定 js-reverse**：直接 `set_breakpoint_on_text`/`trace_function`/`break_on_xhr`/`inject_before_load`/`search_in_sources`；遇强风控被识破再考虑（向用户确认后）重锁到 stealth-browser。
- **被锁定 chrome-devtools**：无原生断点/hook/预注入——核心能力全部走 **`evaluate_script` 猴补丁 fallback**（钩函数、拦 XHR、注入 `debugger;`）；网络与请求发起点有原生支持。**缺断点不是换工具的理由，是走 fallback 的理由。**
