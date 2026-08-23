# Anti-Debug Playbook

Version: 1

适用场景：页面打开即暂停、DevTools 打开后异常、定时器反复触发 `debugger`、动态构造 `debugger`、hook 后被 `toString` 检测。

## 总原则

- 先枚举模式，再决定绕过
- 首屏触发优先 `preload`
- 优先最小改写，不先大面积篡改 runtime
- 绕过要落证据，不只看“页面不再暂停”

## 常见模式

### 1. Timer 型

- `setInterval(function(){debugger})`
- `setTimeout("debugger", ...)`
- **绕过层**：preload 拦截 timer 注册（见 snippets #1）

### 2. Timing 型

- `Date.now()` / `performance.now()` delta 检测
- 单步或暂停导致时间差异常
- `Performance` API 测量操作间隔（更隐蔽，不直接用 debugger）
- **绕过层**：preload **量化/夹紧** timing 函数压制 delta（见 snippets #2）。注意恒等包装无效，必须返回平滑递增的虚拟时钟才能掩盖暂停期间的墙钟跳变；量化过猛会影响依赖真实时序的业务，按 snippets #2 两档取舍

### 3. Size / Position 型

- `outerWidth / outerHeight` 差值（DevTools 停靠时 outer > inner）
- `window.screenX` / `window.screenY` 窗口位置
- **绕过层**：preload defineProperty（见 snippets #3）

### 4. Dynamic Code 型

- `Function("debugger")`
- `eval("debugger")`
- `new Function(...)` 动态拼接
- `with` 语句 + `eval` 组合
- **绕过层**：preload Proxy 拦截 Function 构造（见 snippets #4）

### 5. Integrity 型

- `Function.prototype.toString` 对比原生函数源码
- 原生函数 `toString()` 返回值校验（检测 hook 痕迹）
- console 对象属性篡改检测（删除 `console.log` 后检查是否恢复）
- **绕过层**：runtime toString 伪装 + console 固定（见 snippets #5, #6）

### 6. 隐蔽型（现代变体）

- **WebSocket 帧间隔**：DevTools Network 面板开启时 WebSocket 帧时间戳变化
- **`console.log` timing**：DevTools 关闭时 `console.log` 几乎零耗时；打开后有明显延迟
- **`Error().stack` 检测**：构造 Error 对象检查调用栈深度或帧格式，判断是否在调试器中
- **`document.createElement` 监听**：DevTools Elements 面板可能触发额外 DOM 操作
- **Proxy/Reflect 检测**：通过 `Proxy` 构造器自身被 hook 的痕迹反推
- **绕过层**：需根据具体检测手段逐一定制，preload 阶段通常无法覆盖（因为这些检测在页面逻辑中运行），需要 runtime 阶段针对性 hook

### 7. 组合保护

- Timer + Integrity 双重检测：timer 反复触发 debugger，同时 timer 回调函数被 toString 校验
- JSVMP 内嵌反调试：VM bytecode 中直接包含 debugger opcode，不在 JS 源码中可见
- **策略**：遇到组合保护时，优先识别触发时序（首屏前 vs 用户交互后），再选择对应层级绕过

## 建议流程

1. 先判断是否首屏触发（刷新后立即暂停 → 首屏型）
2. 首屏触发优先 preload 注入
3. 用最小 patch 屏蔽对应模式
4. 记录哪些模式已被触发、已被拦截、仍未解决
5. 绕过后立即回到目标链路取证

## 分层绕过策略

选择策略的核心依据是**触发时序**而非检测类型：

| 时序 | 策略 | 原因 |
|------|------|------|
| 页面加载前 / 首屏 JS 执行前 | preload | 页面 JS 还没运行，你的 hook 先注册，页面代码看到的已是替换后的 API |
| 首屏渲染中（DOMContentLoaded 前） | preload | 同上，但需确保 preload 脚本覆盖了所有目标 API |
| 页面已稳定、用户操作触发 | runtime | 页面状态已建立，preload 太早且无法恢复现场；直接在当前上下文打补丁 |
| 检测逻辑在 JSVMP bytecode 中 | 浏览器可控复用 | bytecode 级检测无法通过 JS 层 hook 完整绕过，退回到浏览器自动化 |
| 检测逻辑在 WASM 中 | 浏览器可控复用 | 同上，WASM 内部检测无法被 JS 层拦截 |

### preload vs runtime 选择决策

```
首屏触发？
├── 是 → preload
│   ├── 只需拦截 timer/debugger → snippets #1, #4
│   ├── 需要 timing 量化/夹紧（压 delta） → + snippets #2
│   └── 需要尺寸伪装 → + snippets #3
└── 否 → runtime
    ├── toString 检测 → snippets #5
    ├── console 篡改检测 → snippets #6
    └── 隐蔽型（timing/console.log/stack）→ 需逐一定制 hook
```

### 关键注意事项

- **preload 脚本执行时序**：`@run-at document-start`（Chrome 扩展）或 CDP `Page.addScriptToEvaluateOnNewDocument` 在任何页面脚本之前注入。确保使用正确的注入 API
- **runtime hook 后的完整性**：hook 原生函数后，`toString()` 可能暴露篡改痕迹。必须同时伪装 toString（snippets #5）
- **多层检测组合**：实际站点很少只用一种检测。遇到"绕过 A 后又触发 B"的情况，不要逐个绕过——先枚举所有检测模式，再用一次 preload 批量覆盖

## 注入策略

- `preload`: 首屏前、首屏初始化、动态构造 `debugger`
- `runtime`: 页面已稳定，针对 `toString / console / bridge` 做局部绕过
- `breakpoint`: 只为确认最小触发点，不作为默认主路径

参考：

- `references/anti-debug-injection-guide.md`
- `artifacts/tasks/_TEMPLATE/run/anti-debug-preload.js`
- `artifacts/tasks/_TEMPLATE/run/anti-debug-runtime.js`

## 最低交付

- 触发模式清单
- 注入时机
- 实际绕过的模式
- 未解决模式
- 关键证据和截图 / 日志位置

## 禁止事项

- 没确认模式就一次性改写大量宿主
- 因为页面不再暂停就认定所有反调试已解决
- 没记录注入时机就只留下零散片段
