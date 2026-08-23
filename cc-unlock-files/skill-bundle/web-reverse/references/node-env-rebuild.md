# Node 补环境执行清单

承接 `closure-extraction-playbook.md` 抽出的最小闭包（或整段 bundle），目标是让它在 Node 跑出与浏览器一致的结果。补哪里、补到什么程度、何时停，**判定全部以 `env-drift-decision-tree.md` 为准**——本页只给执行骨架与起步路线，不另立 drift 口径。

## 核心循环（每轮一个最小因果单元）

1. 跑 `env/entry.js`（或 `run/extracted-closure.js`）
2. 记录当前错误 / first divergence
3. 读代理日志，定位 `first divergence`
4. 按 `env-drift-decision-tree.md` 的 drift taxonomy 归类该 divergence
5. **只补一个最小因果单元**（值/函数/存在性/descriptor/返回壳/调度/异常形态 —— 定义见 decision-tree §3）
6. 复跑
7. 记录是否前移（`Rerun shift`）
8. 写入 `timeline.jsonl` 和 `report.md`

> 「补到什么程度 / 何时停」：first divergence 已前移或消失、drift matrix 高优先级项已对齐、剩余项已记录、结果不再依赖临时 patch 噪音 —— 满足即达 `PureExtraction 准入`（decision-tree §6）。不要追求"把所有未知全局都补上"。

## 两条起步路线（择一铺底，再按 drift 精修）

### 路线 A：Proxy 自动探测（先测「算法到底读了什么」，再精确回填）

**关键语义切分**：Proxy 在这里是**探测器**（记录访问轨迹，正确高效），不是最终壳。`../docs/reference/env-patching.md` 禁止的是"把所有未知全局补成 Proxy 无脑填充壳当交付"；用 Proxy 跑一轮收集"真实被访问的环境量清单"再据此**手工回填**，正是推荐做法，别因禁令不敢用探测。

```javascript
// 递归 Proxy 包 window/document/navigator，get trap 记录被访问的属性路径与调用栈
function makeProbe(name, target = {}) {
  const hits = [];
  const wrap = (obj, path) => new Proxy(obj, {
    get(t, k) {
      if (typeof k === 'symbol') return Reflect.get(t, k);
      const p = path + '.' + String(k);
      hits.push({ path: p, stack: new Error().stack.split('\n')[2]?.trim() });
      const v = Reflect.get(t, k);
      // 未知属性返回子 Proxy 继续探测；已知值原样返回
      if (v === undefined) return wrap({}, p);
      return (typeof v === 'object' && v) ? wrap(v, p) : v;
    }
  });
  globalThis[name] = wrap(target, name);
  return hits;
}
const navHits = makeProbe('navigator');
const winHits = makeProbe('window');
// 跑一轮目标算法后，落盘 hits → run/env-access-trace.json
// 据此清单精确手工回填真实值（不把 Proxy 当最终交付壳）
```

跑出 `run/env-access-trace.json` 后，逐条按真实浏览器快照值回填，再切到 decision-tree 精修。注意 `presence-misclassified`：本该 `undefined/absent` 的符号被 Proxy 错补成 present，会把执行流带进错误分支（decision-tree §5）。

### 路线 B：jsdom / linkedom 铺底（先铺最小宿主，再补差异面）

依赖较重 DOM/window 时，先用现成 DOM 实现铺底，再按 drift matrix 补 jsdom 不覆盖的面：

```javascript
const { JSDOM } = require('jsdom');           // 或 linkedom（更轻）/ happy-dom
const dom = new JSDOM('<!DOCTYPE html>', { url: 'https://target.example/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
// jsdom 不覆盖/不一致的面按 env-drift-decision-tree.md 的 taxonomy 补：
//   canvas/webgl(→fingerprint)、crypto.subtle(→crypto)、performance(→scheduler) 等
```

jsdom 起步快但 `navigator.userAgent`、canvas 指纹、`crypto.subtle` 与真实浏览器有差，凡进入算法的环境值仍要用真实快照对齐（见 `env-as-algorithm-input-playbook.md`）。

**canvas / webgl 是 jsdom 的硬坑（指纹类目标必看）**：jsdom 默认**不实现** `HTMLCanvasElement.prototype.getContext`（调用返回 not implemented）；即便 `npm i canvas`（node-canvas）也**不会自动 patch jsdom 的 prototype**。指纹哈希进算法的目标走 jsdom 铺底会**静默**拿到错误指纹（不报错、签名错）。两条可执行路：

```javascript
// 路 1：装 node-canvas 并手动 patch jsdom 的 prototype（适合需要真实渲染的场景）
//   注意：node-canvas 有系统库依赖（cairo/pango 等）+ 需编译，且对 Node 版本/ABI 敏感，装不上别硬上，改走路 2
const { createCanvas } = require('canvas');
HTMLCanvasElement.prototype.getContext = function (type) {
  return createCanvas(this.width || 300, this.height || 150).getContext(type);
};

// 路 2（指纹类目标首选）：对 canvas/webgl 直接真值快照回填，不依赖 jsdom 渲染
//   从 browser-env-snapshot.json 取真实浏览器里采到的 toDataURL / readPixels 结果，固定返回
const snap = require('./browser-env-snapshot.json');   // 见 env-conformance §8 采集片段
HTMLCanvasElement.prototype.toDataURL = () => snap.canvas.toDataURL;
// WebGL 指纹同理：固定 getParameter(UNMASKED_RENDERER_WEBGL) / readPixels 的真值
```

canvas/webgl 指纹向量识别与「哪些进算法」见 `fingerprint-playbook.md`、`fingerprint-deep-vectors-playbook.md`；指纹值是否参与算法的判定见 `env-as-algorithm-input-playbook.md`。

## Node 侧反检测对齐补丁

补环境复现是 **Node 侧**，自造的 `window`/`navigator` 默认通不过 native code / toStringTag 检测，凡算法或自校验读这些就会分叉：

```javascript
// 1a. 一般自校验（够用）：Proxy 劫持实例 toString
//   局限：可被 Function.prototype.toString.call(fn) / fn.toString.toString() 穿透，且 Proxy 会让 fn.name/length 失真
function markNativeWeak(fn, name) {
  return new Proxy(fn, {
    get(t, k) { return k === 'toString' ? () => `function ${name}() { [native code] }` : Reflect.get(t, k); }
  });
}

// 1b. 强 anti-bot / creepjs 类（必须 hook 原型方法，一处全覆盖）：
//   hook Function.prototype.toString 本身，对登记的伪装函数返回 native 串，其余透传；
//   并把 toString 自身也 native 化（防 fn.toString.toString() 二次检测），name/length 用 defineProperty 保真。
(function installNativeToStringHook() {
  const fnToString = Function.prototype.toString;
  const fakes = new WeakMap();   // fn -> name
  const hooked = function toString() {
    if (fakes.has(this)) return `function ${fakes.get(this)}() { [native code] }`;
    return fnToString.call(this);
  };
  // toString 自身也要看起来 native（否则 hooked.toString() 露馅）
  Object.defineProperty(hooked, 'name', { value: 'toString' });
  Object.defineProperty(hooked, 'length', { value: 0 });
  fakes.set(hooked, 'toString');   // 让 Function.prototype.toString.call(Function.prototype.toString) 也返回 native
  Function.prototype.toString = hooked;
  globalThis.markNative = (fn, name) => {   // 不用 Proxy，name/length 保真
    Object.defineProperty(fn, 'name', { value: name, configurable: true });
    fakes.set(fn, name);
    return fn;
  };
})();
// 用法：const ua = markNative(function userAgent(){...}, 'get userAgent');

// 2. 让 Object.prototype.toString.call(window/navigator) 返回正确 tag
Object.defineProperty(globalThis.window, Symbol.toStringTag, { value: 'Window' });   // [object Window]
Object.defineProperty(globalThis.navigator, Symbol.toStringTag, { value: 'Navigator' });
// 3. navigator.webdriver：浏览器真实为 false/undefined，按目标期望处理
Object.defineProperty(globalThis.navigator, 'webdriver', { get: () => false });
```

> 护栏：**一般自校验用 Proxy（1a）够用**；只有强 anti-bot / creepjs 类（会用 `Function.prototype.toString.call(fn)` 绕实例方法、`fn.toString.toString()` 二次检测、读 `fn.name`/`fn.length`）才升级到 hook 原型方法（1b）。1b 改全局 `Function.prototype.toString`，影响面大，确认目标确有此类检测再用。

这些补丁挂进 `env-drift-decision-tree.md` 的 `descriptor` / `fingerprint` 分支处理；descriptor（name/length/toStringTag）对齐口径见 `env-conformance-playbook.md`。

## 确定性回放骨架（时间 / 随机数 / 时区固定化）

签名常吃 `Date.now` / `performance.now` / `Math.random` / `crypto.getRandomValues` / `getTimezoneOffset`——这些每次跑都变，**Node 侧不固定就和浏览器侧那次取证用的值永远对不上，且静默对不上（不报错、签名错）**。复现的前提是把这几个量**钉死成浏览器取证那一刻的同一序列**。归 `env-drift-decision-tree.md` 的 `crypto` / `scheduler` / `fingerprint` 分支。

落盘格式：取证时在浏览器侧把这些量采进 `run/browser-env-snapshot.json`（`forensicTime` 取证时刻、`randomSeq` 采集到的随机序列、`tz`），Node 侧 entry 顶部最先安装下面这块桩，再 `require` 闭包：

```javascript
// run/replay-determinism.js —— 必须在 require 目标闭包之前 install
const snap = require('./browser-env-snapshot.json');
// snap = { forensicTime: 1733400000000, perfOrigin: 1733400000000, randomBytes: [/* 浏览器侧采的字节序列 */], mathRandom: [/* Math.random() 采的序列 */], tz: 'Asia/Shanghai' }

// 1. 时间：Date.now / new Date() / performance.now 全部锚到取证时刻（消除时间漂移）
const T0 = snap.forensicTime;
const _Date = Date;
globalThis.Date = class extends _Date {
  constructor(...a) { return a.length ? new _Date(...a) : new _Date(T0); }
  static now() { return T0; }
};
globalThis.performance = globalThis.performance || {};
globalThis.performance.now = () => 0;          // 或回放浏览器侧 perf 序列，按算法是否吃增量决定

// 2. Math.random：回放浏览器侧采集的同一序列（耗尽后兜底回退首值，避免越界 NaN）
let mi = 0;
Math.random = () => snap.mathRandom[mi++] ?? snap.mathRandom[snap.mathRandom.length - 1];

// 3. crypto.getRandomValues：注入浏览器侧采集的同一字节序列（而不是真随机）
let ci = 0;
const _bytes = Uint8Array.from(snap.randomBytes);
globalThis.crypto = globalThis.crypto || {};
globalThis.crypto.getRandomValues = (arr) => {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  for (let i = 0; i < u8.length; i++) u8[i] = _bytes[ci++ % _bytes.length];
  return arr;
};

// 4. 时区：显式对齐 process.env.TZ，让 getTimezoneOffset / 本地时间格式化与浏览器一致
process.env.TZ = snap.tz;   // 必须在任何 Date 实例化前设置才生效
```

> 护栏：这是**确定性回放**（钉死取证那一刻的值做复现对账），不是生成新签名的生产逻辑。序列耗尽要么说明算法消费量超过采集量（回采更长序列），要么说明走错分支。`performance.now` 是否需要回放真实序列取决于算法吃的是绝对值还是增量——只吃增量时返回 0/单调桩即可，吃绝对值才回放。

## 交叉引用

- 决策/停止口径：`env-drift-decision-tree.md`（drift taxonomy、最小补丁单元、PureExtraction 准入）
- 补丁规范 canonical：`../docs/reference/env-patching.md`
- 环境值是否参与算法：`env-as-algorithm-input-playbook.md`
- descriptor / 反检测对齐：`env-conformance-playbook.md`
- 闭包来源（扣代码上游）：`closure-extraction-playbook.md`

