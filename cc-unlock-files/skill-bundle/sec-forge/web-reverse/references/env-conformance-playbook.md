# Environment Conformance Playbook

Version: 1

适用场景：

- 浏览器里正常，Node rebuild 里跑偏
- 不是单个缺失 API，而是宿主行为不一致
- 目标依赖属性描述符、原型链、`toStringTag`、代理、微任务、编码器、`crypto`、typed array、storage 语义

本专题解决的不是“补一个对象壳”，而是确认：

1. 真实宿主行为是什么
2. 当前 rebuild 偏差出在哪一层
3. 最小修补是值、函数、描述符还是调度顺序
4. 哪些行为仍未对齐，不能进入 pure extraction

## 1. 典型失真面

> drift 分类（taxonomy）的**单一致源是 `env-drift-decision-tree.md` §1**（`api-missing` / `presence-misclassified` / `descriptor` / `scheduler` / `typed-array` / `crypto` / `storage` / `fingerprint` / `return-shape` / `error-surface`）。下表是这些类别在具体 API 上的展开，分类口径以 decision-tree 为准，不要在此另立新类别。

- `Object.getOwnPropertyDescriptor`
- `hasOwnProperty` / `in`
- `Object.prototype.toString.call(...)`
- `Symbol.toStringTag`
- `Proxy` / `Reflect`
- `queueMicrotask` / `Promise.then` / `MessageChannel`
- `setTimeout` / `performance.now`
- `TextEncoder` / `TextDecoder`
- `crypto.getRandomValues` / `crypto.subtle`
- `Uint8Array` / `DataView` / `ArrayBuffer` 切片行为
- `localStorage` / `sessionStorage` 返回值和异常语义

## 2. 取证顺序

1. 先确认 `first divergence`
2. 再确认是：
   - 缺对象
   - 缺函数
   - 存在性判断错误（本该 `undefined/absent` 却被补成 present）
   - 描述符不一致
   - 返回值结构不一致
   - 调度时序不一致
3. 只对当前因果单元做补丁
4. 立即复跑验证，确认分叉是否前移
5. 如果 swap matrix 已证明“baseline 请求可过、只换本地 signer 就失败”，立即退出 env 主线，转去追 signer state 写入链

## 3. 不允许的误判

- 仅因为代码继续跑了就认为环境已对齐
- 用静态常量替代真实宿主行为却不记录偏差
- 未说明 scheduler 差异就把异步路径当成功
- 未说明 descriptor 差异就直接进入 pure extraction
- 把所有未知全局或未知属性统一补成 stub / Proxy 壳，导致浏览器里本该 `undefined` 的分支被误导成 present

## 4. 存在性一致性

补环境前，先回答“这个符号在浏览器里到底该不该存在”，不要只回答“补了以后能不能继续跑”。

优先检查：

- `typeof symbol`
- `symbol in globalThis`
- `Object.getOwnPropertyDescriptor(globalThis, symbol)`
- 真实页面里该符号是否被 bundler/runtime 显式注入
- 条件分支是否依赖该符号的 `undefined / absent` 状态

高风险符号：

- `process`
- `Buffer`
- `global`
- `require`
- `module`
- `exports`
- `define`

这些 `Node/CommonJS/AMD` 符号在浏览器里经常本来就不存在。若无页面证据，不要把它们自动补成 stub；否则很容易把 loader、UMD、导出分支或 anti-tamper 探测带进错误路径。

## 5. 建议记录维度

至少记录：

- 缺失面：`api / descriptor / scheduler / typed-array / crypto / storage`
- 存在性判定：`present / undefined / absent / pending`
- 证据来源：页面日志、hook、控制台、调用样本
- 最小补丁策略
- 补丁后状态
- 仍未对齐项

## 6. Scheduler 对齐

如果目标依赖异步顺序，必须区分：

- 微任务：`queueMicrotask` / `Promise.then`
- 宏任务：`setTimeout`
- 消息任务：`postMessage` / `MessageChannel`

“能跑”不等于时序正确。

## 7. Descriptor 对齐

如果目标读：

- getter / setter
- enumerable / configurable / writable
- `name` / `length`
- `toString`

就必须记录 descriptor 级补丁，而不是只造一个同名函数。

## 7.5 Node 侧反检测对齐（补环境复现专用）

补环境复现跑在 **Node 侧**，自造的 `window`/`navigator`/补丁函数默认通不过浏览器原生检测；凡算法或自校验读这些就会走错分支。三个必须对齐的可操作面：

- **`Function.prototype.toString` native code 伪装**：补出的"原生函数"被 `fn.toString()` 一查就露馅（不是 `[native code]`）。**一般自校验**用 Proxy 劫持实例 `toString` 即可；**强 anti-bot / creepjs 类**会用 `Function.prototype.toString.call(fn)` 绕实例方法、`fn.toString.toString()` 二次检测、读 `fn.name`/`fn.length`，Proxy 方案会被穿透且 name/length 失真——此时必须改 hook `Function.prototype.toString` 原型方法（一处全覆盖，toString 自身也 native 化、name/length 保真）。
- **`Object.prototype.toString.call(window/navigator)` tag**：自造对象默认返回 `[object Object]`，真实应为 `[object Window]` / `[object Navigator]`，靠 `Symbol.toStringTag` 对齐。
- **`navigator.webdriver`**：浏览器真实为 `false`/`undefined`，按目标期望显式定义 getter。

可直接套用的补丁骨架见 `node-env-rebuild.md`「Node 侧反检测对齐补丁」（markNative + toStringTag + webdriver）。命中后挂进 `env-drift-decision-tree.md` 的 `descriptor` / `fingerprint` 分支处理。

> 注意区分：这些是 **Node 侧补环境**的反检测对齐，与浏览器复用语境下的 `navigator.webdriver`/原型链反检测是同类问题但不同战场——补环境复现（Node 侧）才是扣代码/补环境路线的重点。

## 7.6 第三方识别/解码库的能力·版本探测（投入主流程前）

引入第三方识别/解码库（`ddddocr`、OCR、滑块缺口检测、音频识别等）时，**不要直接在主流程里 import 就开跑**——这类库的 API/导入方式在版本间经常不兼容（典型坑：`ddddocr` 1.6.0 改了 import 路径 / 依赖，需降到已知可用版本），在主流程里踩坑会连环试错、空烧多轮。投入前先做一次独立的能力探测：

1. **import 探测**：单独跑 `import ddddocr`（或对应库）确认能加载、无依赖缺失/ABI 不兼容报错。
2. **关键 API 存在性**：确认你要用的 API 真的存在且签名符合预期（如 `ddddocr.DdddOcr().classification(img)` / `slide_match(...)`），而不是版本变更后被改名/移除。
3. **最小样例跑通**：喂一个最小真实样本（一张验证码图 / 一个缺口图）跑出**非异常的合理输出**，确认链路通。
4. **固定版本**：把已验证可用的版本写死（`requirements.txt` 钉版本 / `package.json` 锁版本），探测结论与版本号记进 `run/env-conformance-notes.md`，避免后续无意升级又踩回坑。

探测脚本与样例落 `run/`（如 `run/lib-probe.py`），探测**没通过前不把该库接进求解主流程**。这与本页"先取证再补环境""一次只做一个补丁决策"同源：先确认依赖本身可用，再谈用它。

## 8. 交付要求

命中本专题时，至少补充：

- `task.json.envConformance`
- `run/env-conformance-template.js`
- `run/env-conformance-notes.md`
- `run/env-drift-matrix.md`
- `run/browser-env-snapshot.json` —— 在真实浏览器里采集，作为 Node 侧补环境的对齐基准。最小采集片段（DevTools/preload 里跑，结果落盘）：
  ```javascript
  // 在目标页面真实环境执行，抓算法可能读取的环境量快照
  const snap = {
    navigator: Object.fromEntries(['userAgent','platform','language','languages','hardwareConcurrency',
      'deviceMemory','maxTouchPoints','vendor','productSub','webdriver'].map(k => [k, navigator[k]])),
    screen: Object.fromEntries(['width','height','availWidth','availHeight','colorDepth','pixelDepth'].map(k => [k, screen[k]])),
    window: { innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio },
    location: Object.fromEntries(['href','protocol','host','hostname','pathname'].map(k => [k, location[k]])),
    tags: { window: Object.prototype.toString.call(window), navigator: Object.prototype.toString.call(navigator) }
  };
  // 复制 JSON.stringify(snap) 落到 run/browser-env-snapshot.json
  ```
  与 `env-as-algorithm-input-playbook.md` 的环境读取点清单配合，按真值回填 Node 侧。
- `report.md` 中的 `补环境一致性状态`

报告至少写清：

- 当前分叉点
- 失真面
- 存在性判定
- 最小补丁策略
- 补丁后状态
- 仍未对齐项

## 9. 何时退出 env 主线

出现以下任一证据时，不应继续把 `env` 当主线：

- 显式 `descriptor / scheduler / navigator / prototype` 报错已经基本消失，但请求仍稳定 `200 + 空体`
- swap matrix 证明 baseline signer 可用，而本地 signer 单独替换后失败
- bridge 一个 cookie / storage 值到 signer state 后，请求立刻恢复

这类场景的下一步应转向：

- `references/signature-playbook.md`
- `references/session-lifecycle-playbook.md`
- `references/storage-playbook.md`
- `references/instrumentation.md`

复杂 drift 继续补读：

- `references/env-drift-decision-tree.md`
- `scripts/cases/web-node-env-patching-workflow.mjs`
