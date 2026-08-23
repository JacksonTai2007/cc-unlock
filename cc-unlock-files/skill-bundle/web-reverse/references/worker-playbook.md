# Worker Playbook

Version: 3

适用场景：目标逻辑下沉到 `Worker`、`SharedWorker`、`Service Worker`、`Worklet`，通过 `postMessage` 与主线程交互，或由 `Service Worker / Workbox` 接管 fetch、缓存与导航预加载。

## 目标

- 确认 worker 类型、脚本 URL / Blob 来源、创建者与创建时机
- 确认哪些请求参数 / 解密结果 / 指纹值由 worker 异步产出
- 确认主线程与 worker 的消息格式、方向、关键字段和依赖关系
- 确认 `Service Worker` 是否拦截请求、接管缓存、控制升级或承担导航预加载
- 确认 worker 是否承担签名、加密、风控、反调试、协议封装或媒体处理职责
- 在条件允许时，把 worker 的输入输出边界提纯成可复现骨架

## 高价值信号

优先注意以下信号，它们通常说明关键逻辑不在主线程：

- 某个请求参数只在点击 / 挑战提交 / 二次交互后出现，而初始化阶段没有
- 主线程只看到 `btoa` / `JSON.stringify` / `encodeURIComponent` / `payload` 拼装，却看不到真正运算
- 出现 `new Worker(...)`、`new SharedWorker(...)`、`navigator.serviceWorker.register(...)`
- 出现 `Blob([...]) + URL.createObjectURL(...)` 动态创建 worker
- 出现 `postMessage`、`onmessage`、`MessageChannel`、`BroadcastChannel`
- worker 内再加载 `importScripts(...)`、动态 `fetch(...)`、WASM、VM、独立 crypto

## 核心原则

- **先按请求参数分层，再决定 worker 是否是主专题**：先区分初始化值、环境值、点击后值、异步返回值
- **编码出口不是算法入口**：`btoa` / base64 / JSON 往往只是出参包装点，不要把出口误当核心算法
- **先抓创建点，再抓消息面，再看算法体**：先回答“谁创建了它、什么时候创建、传了什么、回了什么”
- **Blob Worker 必须追源码生成链**：不仅要知道 blob URL，还要知道 blob 文本从哪里拼出来
- **能复现输入输出，就尽早做最小重建**：不要长时间停留在“知道有 worker”阶段

## 建议流程

1. **从网络请求倒推参数分层**
   - 标出哪些字段是初始化即有、哪些是交互后新增、哪些明显晚于主线程收集
   - 对“点击后才出现”的字段优先怀疑：异步 worker、延迟指纹、挑战编排、二次编码

2. **记录所有 worker 构造与注册点**
   - 搜 `new Worker` / `SharedWorker` / `serviceWorker.register`
   - 同时搜 `Blob(`、`URL.createObjectURL(`、`importScripts(`、`postMessage(`
   - 若命中动态构造，记录“创建函数 -> blob 文本拼装点 -> blob URL -> worker 实例”

3. **抓主线程到 worker 的双向消息**
   - 抓 `postMessage`、`onmessage`、`addEventListener("message", ...)`
   - 记录每条消息的方向、触发时机、关键字段、字段是否与请求参数同名或可映射
   - 建立 `request field -> main thread field -> worker message -> worker output -> final payload` 映射

4. **区分“出口函数”和“真实运算函数”**
   - 如果先命中 `btoa`、base64、json 拼装，只把它记为 `output sink`
   - 继续向上追：谁给了它输入、输入是否来自 worker 回包、输入在哪一拍变成最终字段

5. **如果是 Blob Worker，恢复其真实脚本文本**
   - 优先抓 `Blob` 构造参数与 `URL.createObjectURL` 入参
   - 记录脚本拼装前的片段来源：字符串常量、数组 join、解码器、动态模板、解包函数
   - 不要只保留 blob URL；blob URL 对复现价值很低，源码生成链才有复用价值

6. **对 worker 内部再做最小定位**
   - 看 `onmessage` 入口、任务分发器、关键导出函数、WASM/VM/crypto 装载点
   - 确认输入字段、输出字段、是否依赖环境值、时间戳、随机数、DOM 代理值
   - 必要时在 worker 入口、关键分支、回包前打 `debugger` 或日志
   - 若 worker 内是 webpack 打包的 runtime（akamai/shape/瑞数/阿里系常见），要把 worker 内的模块表扣出来时，主 Realm 的 `window.webpackChunk_xxx` 拿不到——必须钻进 worker 自己的 Realm dump 它的 `__R.m`。**按 worker 脚本是否同源分两条路**：
     - **同源 worker 脚本**：用劫持 `Worker` 构造 / `importScripts` 注入探针的同源 Blob 法，dump 见 `closure-extraction-playbook.md` §2.6。
     - **跨源 worker 脚本（worker 脚本在 CDN/跨源，§2.6 同源 Blob 法的 `importScripts` 会被 CORS 静默拦截、dump 不到 `__R.m`）→ 落地手法（本节解决，不回指 §2.6 同源法）**：
       - **首选：CDP 跨 target 注入。** 先 `Target.setAutoAttach({autoAttach:true, waitForDebuggerOnStart:true, flatten:true})`（或对已知 target 用 `Target.attachToTarget({targetId, flatten:true})`），让新建/已存在的 worker target 在启动时 `waitForDebugger` 暂停、由 flatten 把 worker target 的 CDP 会话挂到同一连接。worker `Debugger.paused`（waitForDebugger 命中）时机，在该 worker 的 sessionId 上发 `Runtime.evaluate` 抢在业务脚本前于 **worker 上下文内**安装探针：hook `self.webpackChunk_xxx`（push `[[-1],{},r=>{...dump r.m...}]`）/ 包 `__webpack_require__`，把每个 `r.m[id].toString()` dump 出来回传，再 `Debugger.resume`（或 `Runtime.runIfWaitingForDebugger`）放行。跨源也能装上，因为探针是 CDP 在 worker target 内直接执行、不经 `importScripts`，绕开 CORS。
       - **次选：创建前 hook（仅当脚本可同源 fetch 到）。** 主线程劫持 `Worker` 构造函数，对原 url 先 `fetch` 拿到脚本文本（需目标允许同源/带 ACAO 的跨源 fetch），把「探针 + 原脚本」拼成**同源 Blob** 再 `Reflect.construct`。与 §2.6 同源 Blob 法的区别：§2.6 用 `importScripts(原url)` 让 worker 自己去加载（跨源被 CORS 拦），这里改为**主线程 fetch 文本后内联进 Blob**，把脚本搬到同源再执行。**适用边界**：仅当跨源脚本响应带 ACAO（fetch 拿得到文本）才可行；跨源且无 ACAO（fetch 也被拦）时退回首选 CDP 跨 target。

7. **如果是 Service Worker，补齐 fetch/cache 控制面**
   - 抓 `fetch` / `message` / `activate` / `install` / `push` / `sync`
   - 记录缓存路由、升级控制、预加载、离线命中、是否改写请求 / 响应
   - 记录是否出现 `Workbox`、`registerRoute`、`precacheAndRoute`、`navigation preload`、`clients.claim()`、`skipWaiting()`

8. **必要时纳入 local rebuild**
   - 最低目标是复现 worker 输入输出，不必一开始就完整脱浏览器
   - 若 worker 依赖浏览器环境，先做浏览器内可控复用；若边界清晰，再迁移到 Node / Python

## 优先级最高的 probe

1. 目标请求里“点击后新增”的字段是谁填的
2. 该字段进入最终 payload 前，是否来自 worker 回包
3. worker 是静态 URL 还是 `Blob + createObjectURL`
4. 主线程与 worker 的 message schema 是什么
5. worker 输出是否直接可作为本地复现的函数边界

## 常见失误

- 只看主线程，不跟进 worker
- 只知道有 worker，不知道它承担什么职责
- 看到 `btoa` / base64 就误判为算法核心
- 只记录 blob URL，不恢复 Blob 源码生成链
- 只知道某字段“像是 worker 生成”，但没有建立消息映射
- 把 `Service Worker` 的缓存命中、fetch 接管和消息通道混成一个黑盒
- 过早做纯算法迁移，忽略先用浏览器内 harness 固定输入输出边界

## 最低交付

- `run/worker-notes.md`
- worker 类型、URL / Blob 来源、创建点、创建时机、职责
- 关键消息样例与 message schema
- 至少一条 `main thread -> worker -> output -> request field` 映射
- 若命中 `Service Worker`，至少说明请求拦截、缓存策略与升级控制边界

## 加分交付

- `Blob` 动态脚本的恢复方式与源码生成链
- worker 内关键函数入口或 dispatcher 位置
- 可直接复用的 worker 输入输出样本
- 本地 / 浏览器内最小复现脚手架
