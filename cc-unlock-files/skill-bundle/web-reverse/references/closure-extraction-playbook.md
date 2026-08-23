# Closure Extraction Playbook（扣代码 / 最小闭包提取）

Version: 1

适用场景：已定位到目标函数（sign / encrypt / token 生成等），需要把它**连同传递依赖从打包后的 bundle 中抽出来，搭最小 runtime 在 Node 单跑**，再交棒补环境。

与相邻文档的边界（别用错文档）：
- `dead-code-elimination-playbook.md` 讲的是「删混淆器注入的死代码」（瘦身），**不是**这里的「为提取目标算法做依赖裁剪」；先读本页定主链，DCE 只是清理工具。
- `bundle-loader-playbook.md` 讲「识别 chunk 关系图」，回答目标在哪个 chunk；本页回答「从运行时把目标模块连同依赖抽出来单跑」。
- `deobf.md` / `string-array-deobfuscation-playbook.md` / `control-flow-flattening-playbook.md` 是把抽出来的模块还原可读的工具，按需调用。

本页是「扣代码」路线的入口；走到本页前先在 `composite-triage-playbook.md`「Rebuild 路线三岔决策」确认该不该扣（见下文阈值）。

---

## 0. 扣 vs 不扣判定阈值（先决策再动手）

| 信号 | 倾向 |
|------|------|
| 目标依赖闭包模块数 ≤ ~30 且不深绑 DOM/网络/会话态 | **扣**（本页主链 → Node 单跑） |
| 闭包爆炸（依赖数 >> 30）/ 强绑浏览器 runtime / 强会话态 | **不扣**：整段 bundle + 补环境跑（交付梯度 D 模式），见 `env-drift-decision-tree.md` |
| anti-bot 强、环境值深度参与算法 | 优先浏览器可控复用（C 模式），见 `browser-controlled-reuse-playbook.md` |

阈值落到执行循环的 **Extract** 阶段产出：闭包外仍需补的**独立语义单元数** ≤ N（默认 N≈30）才算「可补环境」，否则回退 D 模式，别硬扣。

> **计数口径：按「独立语义单元」数，不是叶子外部符号数。** 一个 `navigator` 算 **1** 个语义单元，哪怕算法读了它下面 20+ 个指纹属性（`userAgent`/`language`/`platform`/`hardwareConcurrency`…）——这些同源属性靠**一次** browser-env-snapshot 回填即可对齐，是同一个补全动作。若按叶子符号数计，指纹属性一多就会把"实际一把补完"的目标误判成"外部符号爆炸、不可补"而错误回退 D 模式。`window` / `document` / `crypto` / 某个自定义全局对象同理各算 1 个单元，按"补全这个单元需要几次独立取证/回填动作"来数。
>
> **本节 §0 是阈值 N 的 canonical 定义**（默认 ~30）。SKILL.md 执行循环表、composite-triage 三岔决策、reverse-workflow Extract 段引用本处，不要各自改数值；调整 N 只改这里。N 不是硬卡线：依赖深绑程度、单个语义单元补全成本也要一并权衡。

---

## 1. 自动化打底：webcrack unbundle（扣代码第一步）

> **本节 §1 是 webcrack 扣代码打底用法的 canonical**（unbundle 第一步 + Node 22/24 运行时要求 + vm2 禁令/CVE-2026-22709）。`deobf.md` T4、`string-array-deobfuscation-playbook.md` §0 只一行回指本节，不再各自重复正文。

现代前端 90% 是 webpack/vite/browserify 打包。**先用 `webcrack` 把 bundle 拆成独立模块文件**，再人工抽闭包，比手工逆向作用域链快一个数量级。

```bash
# webcrack 不只解混淆：直接把 webpack/browserify bundle 拆成独立模块文件
npx webcrack bundle.js -o out/
# 产出 out/ 下按模块 id 拆分的独立文件 + 还原后的 entry，便于按依赖图人工抽闭包
```

> **运行时要求**：webcrack 2.16.0（2026-04）官方支持「unpack bundled modules from webpack and browserify into individual files」，要求 **Node 22/24**。低版本 Node 会安装/运行失败，先 `node -v` 确认。
> **安全要求**：webcrack 只做静态拆分/还原，不执行目标代码；若后续要自跑抽出的 decoder/模块，仍按 `deobf.md` 的禁令用 `isolated-vm` 或一次性 Docker，**不要** `vm2` / `node:vm` 裸跑（CVE-2026-22709，CVSS 9.8）。

webcrack 拆不动（自定义 loader / 非标准 runtime）时，转下一节运行时劫持。

---

## 2. webpack 运行时劫持：dump 模块 + 抽依赖闭包

当 bundle 在浏览器里跑得通但静态拆不干净，从**运行时**把模块表和 `__webpack_require__` 劫持出来，是最稳的扣代码手法。

### 2.1 拿到 `__webpack_require__` 与模块表

```javascript
// 现代 webpack 5：全局 chunk 数组挂在 window.webpackChunk_xxx（名字看页面，常含项目名）
// push 一个伪 chunk，借 runtime 注入回调拿到 __webpack_require__（惯例参数名 r / __webpack_require__）
window.webpackChunk_xxx.push([
  [ -1 ],          // 不与任何真实 chunk id 冲突的占位 id
  {},              // 空模块表
  r => { window.__R = r; }   // r 即 __webpack_require__
]);

// 拿到后：
window.__R.m   // === __webpack_modules__：全部模块工厂函数源码（dump 这里看每个模块体）
window.__R.c   // === 模块缓存：已加载模块的 exports，看运行时实际跑过哪些
// 常用 helper（抽闭包时要一起带走）：
//   __R.d (defineExport) / __R.n (compat default) / __R.o (hasOwnProperty) / __R.r (esModule 标记)
```

webpack 4 / webpackJsonp（旧）：全局是 `window.webpackJsonp`，`push([[chunkIds],{modules},[entries]])`，同样可借入口回调或直接读 `webpackJsonp` 闭包内的 `__webpack_require__`。

### 2.1.5 异步 chunk：先加载再 dump（splitChunks 高频坑）

§2.1 拿到的 `__R.m` / `__R.c` **只含已加载的同步模块**。目标 sign/encrypt 常被 `splitChunks` 切进**按需 chunk**——此时直接 dump `__R.m` 会「找不到目标 module id」、`__R.c` 也是空。**第一刀就卡在这**，必须先把异步 chunk 加载进来再 dump。

```javascript
// 已知目标 chunkId：用 __R.e 强制加载异步 chunk，再 __R(moduleId) 取模块
window.__R.e(chunkId).then(() => {
  const mod = window.__R(moduleId);   // 此时该模块已注册进 __R.m / __R.c
});

// 不知道 chunkId：枚举所有已知 chunk 全部预加载，再统一 dump __R.m
//   __R.f = chunk 加载 handler 集合（如 __R.f.j 是 jsonp 加载器）
//   installedChunks = 运行时 chunk 安装状态表（key 即 chunkId；webpack5 在 runtime 闭包里，常需从 __R.e/__R.f.j 源码反查）
//   __R.u(id) = 由 chunkId 生成 chunk 文件名，可用来确认 id 有效 / 枚举
function dumpAllChunkIds() {
  // 优先：从 __R.f.j 或 installedChunks 源码里抠出已声明的 chunkId 集合
  const src = (window.__R.f && window.__R.f.j ? window.__R.f.j.toString() : '') + window.__R.e.toString();
  const ids = new Set();
  for (const m of src.matchAll(/["']?([\w-]+)["']?\s*:/g)) ids.add(m[1]);   // 粗筛 installedChunks 的 key
  return [...ids].filter(id => { try { return !!window.__R.u(id); } catch { return false; } });
}

const allChunkIds = dumpAllChunkIds();
Promise.all(allChunkIds.map(id => window.__R.e(id).catch(() => {})))   // 容错：某些 id 加载失败不阻断
  .then(() => {
    // 此时 __R.m 已包含异步模块，按 §2.2 统一 dump
    const dump = {};
    for (const id in window.__R.m) dump[id] = window.__R.m[id].toString();
    window.__DUMP = dump;   // 落 run/webpack-modules.json
  });
```

枚举不全时的兜底：在页面里**手动触发**会用到目标的交互（点击/提交），让 webpack 按需加载目标 chunk，加载后 `__R.m` 即出现目标 id；或在 `__R.e` 上加 hook 记录每次实际请求的 chunkId。webpack5 的 chunkId 可能是数字、hash 串或具名，别假设连续。

### 2.2 dump 全部模块源码留档

```javascript
// 把每个模块工厂函数源码落盘，供静态分析与人工抽闭包
const dump = {};
for (const id in window.__R.m) dump[id] = window.__R.m[id].toString();
// 浏览器侧复制 JSON.stringify(dump) 落到 run/webpack-modules.json
```

### 2.3 定位目标模块 id

- 在目标函数（如 sign）处下断/hook，调用栈里出现的 `__webpack_require__(<id>)` 即依赖入口；
- 或在 dump 里搜索目标特征串（魔数、字段名 `x-sign`、CryptoJS 调用）定位 module id。

### 2.4 递归收集依赖闭包

**优先动态依赖法（精确闭包）**：正则扫源码在 webpack5 下既假阳又假阴，**首选在运行时 hook `__webpack_require__`、记录每次实际传入的 module id**，跑一轮目标交互后得到的就是精确闭包。webpack5 把 require 别名压成单字母（`mangleExports`），且依赖调用形态多变——`const {a}=r(123)` 解构、`r.bind(null,id)`、`r.e(id).then(r.bind(r,id))` 异步桥接——这些**正则全抓不到**（假阴），而正则又会把任意 `foo(123)` 误当依赖（假阳）。

```javascript
// 在拿到 __R（§2.1）之后、跑目标交互之前安装：用 Proxy 包住 __webpack_require__，
// apply trap 记录每次真实传入的 id，跑完一轮目标交互（点击/提交/触发签名）后 seen 即精确传递闭包。
const __origR = window.__R;
const seen = new Set();
window.__R = new Proxy(__origR, {
  apply(target, thisArg, args) {
    seen.add(String(args[0]));        // args[0] 即被 require 的 module id
    return Reflect.apply(target, thisArg, args);
  }
});
// 边界：上面的 Proxy 只拦截**经全局 window.__R 发起**的 require；webpack 模块工厂拿的是
// 入参 __webpack_require__（闭包捕获的原始 r 引用），工厂内部 r(id)/r.bind(r,id) 走原始 r、
// **不经 Proxy**——故对已实例化模块、或已捕获原 r 的工厂的传递依赖，seen 会漏采几个深层 id，
// 直接跑 extracted-closure.js 可能报 cannot find module <id>。因此 seen 不是唯一真值，
// **必须与 __R.c 缓存键并集**：__R.c 含所有已实例化的同步传递依赖，正好补齐 Proxy 漏掉的深层 id
//（即本节后面 line 165 三方交叉「动态 seen / 正则 / __R.c」的作用，此处前置说明）。
// 异步桥接（r.e(id).then(r.bind(r,id))）：__R.e 加载 chunk、经 window.__R 发起的 require 仍会命中 trap；
// 先按 §2.1.5 预加载异步 chunk 再触发交互。（可选增强：在 __R.m[id] 工厂外再包一层、把传入 require 也换成同 Proxy，
// 可让工厂内调用也命中，但成本高，一般 __R.c 并集已够。）
// 跑完目标交互后：[...seen] 就是精确闭包模块 id 集合，落 run/closure-dynamic-ids.json。
```

**正则法降级为离线静态兜底**（拿不到运行时、或交互覆盖不全时补漏）：

```javascript
// 离线兜底：仅在无法运行时 hook 时用，结果须人工核对（webpack5 形态会漏 r.bind/r.e/解构依赖）
function collectClosureStatic(rootId, modulesSrc) {
  const seen = new Set();
  const stack = [String(rootId)];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id) || !modulesSrc[id]) continue;
    seen.add(id);
    const src = modulesSrc[id];
    // 粗筛 r(<id>) / __webpack_require__(<id>)；不覆盖 r.bind(null,id) / r.e(id).then(r.bind(r,id))
    for (const m of src.matchAll(/(?:__webpack_require__|[a-zA-Z_$][\w$]*)\(\s*(\d+|"[^"]+")\s*\)/g)) {
      const dep = m[1].replace(/"/g, '');
      if (modulesSrc[dep]) stack.push(dep);
    }
  }
  return [...seen];
}
```

口径：**动态 hook 出的 `seen` 为准**（精确），正则兜底结果与运行时 `__R.c` 缓存里实际加载过的 id 三方交叉，差集逐条人工判定（动态 id / 计算属性 / 条件分支未触发）。按 §0 阈值评估的是动态闭包的模块数，不是正则粗筛数。

### 2.5 搭最小 require shim 在 Node 跑

```javascript
// run/extracted-closure.js 的骨架：把抽出的模块表 + 自实现的 __webpack_require__ 一起带走
const modules = require('./webpack-modules-subset.js'); // { id: function(module, exports, __webpack_require__){...} }
const cache = {};
function __webpack_require__(id) {
  if (cache[id]) return cache[id].exports;
  const module = (cache[id] = { exports: {} });
  modules[id].call(module.exports, module, module.exports, __webpack_require__);
  return module.exports;
}
// 还原必要 helper（webpack runtime 提供的，模块体会用到）
__webpack_require__.d = (exports, defs) => { for (const k in defs) Object.defineProperty(exports, k, { enumerable: true, get: defs[k] }); };
__webpack_require__.n = (m) => { const g = m && m.__esModule ? () => m.default : () => m; return g; };
__webpack_require__.o = (o, p) => Object.prototype.hasOwnProperty.call(o, p);
__webpack_require__.r = (exports) => { Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' }); exports.__esModule = true; };

const target = __webpack_require__(<TARGET_ID>);
module.exports = target;   // 暴露目标函数，供 verify-once.mjs 调用
```

vite/rollup ESM 产物：模块是 `import`/`export` 而非 `__webpack_require__` 工厂；抽法同理但用 ESM 静态依赖图（`import` 语句）求闭包，shim 换成保留 `export`/`import` 直接 `node --experimental-vm-modules` 或 esbuild 打成单文件。

**vite 产物的 `import.meta` 桩值对齐（Node 侧没有 `import.meta.url`/`import.meta.env`，不对齐会缺值或走错分支）**：用 esbuild `--define` 在打包时把 `import.meta.*` 替换成浏览器侧采到的真值，动态 `import()` 改写成同步可解析的桩：

```bash
# 把 import.meta.url / import.meta.env.* 定义成浏览器快照里的真值（注意 JSON 字面量要带引号）
npx esbuild closure-entry.mjs --bundle --format=cjs --platform=node \
  --define:import.meta.url='"https://target.example/assets/index-abc.js"' \
  --define:'import.meta.env.MODE="production"' \
  --define:'import.meta.env.BASE_URL="/"' \
  --define:import.meta.env.PROD=true --define:import.meta.env.DEV=false \
  -o out.cjs
```

- `import.meta.url`：算法常用它推 base 路径 / chunk URL，桩成浏览器里该模块的真实 URL（从 source/network 取）。
- `import.meta.env.*`：vite 注入的环境常量（`MODE`/`PROD`/`DEV`/`BASE_URL`/自定义 `VITE_*`），缺了会让 `if (import.meta.env.PROD)` 走错分支。
- 动态 `import(x)`：esbuild `--bundle` 会把可静态解析的动态 import 一并打进来；解析不了的（运行时拼 URL）改成预加载好的同步 require 桩，或按 §2.1.5 思路先在浏览器触发加载再 dump 模块体抽进闭包。

**CJS↔ESM interop 陷阱（抽 vite/rollup 产物高频坑，default 错位最常见）**：
- webpack `__R.n(m)` 的 default 兼容：对 `m.__esModule` 为真的模块返回 `m.default`，否则返回 `m` 本身——抽出来在 Node 跑时，若手搓的 shim 没还原这条逻辑，会把整个 namespace 对象当成 default，目标函数变 `undefined`。
- `__esModule` 标记 ≠ 真 ESM：webpack 用 `exports.__esModule=true` 在 CJS 里模拟 ESM，而 Node 原生 ESM 的 `import` 看的是真实导出绑定。把 webpack 产物当真 ESM `import`、或把真 vite ESM 产物塞进 CJS `require`，default 都会错位。
- **二选一取舍标准**：
  - 闭包小、依赖纯、只想快速跑通 → `esbuild bundle.js --bundle --format=cjs --platform=node -o out.cjs` 先打成 CJS 再 `require`，interop 由 esbuild 统一处理，最省心。
  - 必须保留 ESM 语义（top-level await、动态 import、循环依赖按 ESM live-binding 解析）→ 保留 `.mjs` + `node --experimental-vm-modules`，但要自己盯住 default 绑定。
- 提醒：**抽 vite 产物时 `default` 导出错位是高频坑**——跑出 `xxx is not a function` 先查是不是 default/namespace 拿反了，再怀疑闭包不全。

### 2.6 Worker / iframe 内的 webpack runtime 扣代码（跨 Realm）

anti-bot（akamai / shape / 瑞数 / 阿里系）常把 sign / vmp 跑在 Worker 或 iframe 里：**主 Realm 的 `window.webpackChunk_xxx` 拿不到 Worker/iframe 内的模块表**——每个 Realm 有独立的 `__webpack_require__` 与 chunk 全局。必须钻进目标 Realm 内部 dump 它自己的 `__R.m`。worker 侧的创建点定位 / 消息面映射先走 `worker-playbook.md`，本节只解决「拿到 worker 内 webpack 模块表」这一步。

**Worker：劫持 `Worker` 构造 / `importScripts` 注入探针**

```javascript
// 主 Realm：在目标脚本创建 worker 之前，劫持 Worker 构造，给 worker 源码前置注入探针。
// 适用于 Blob Worker（改 blob 文本）与 URL Worker（用 importScripts 包一层）。
const _Worker = window.Worker;
window.Worker = new Proxy(_Worker, {
  construct(target, [url, opts]) {
    // 把探针 + 原脚本拼成新 blob：探针在 worker 内 hook __webpack_require__、dump __R.m 回主线程
    const probe = `
      self.__seen = new Set();
      self.addEventListener('message', e => {
        if (e.data && e.data.__dumpWebpack) {
          // worker 内的 chunk 全局名同样形如 webpackChunk_xxx，按需改名
          const g = Object.keys(self).find(k => k.startsWith('webpackChunk'));
          self[g].push([[-1], {}, r => {
            const dump = {}; for (const id in r.m) dump[id] = r.m[id].toString();
            self.postMessage({ __webpackDump: dump });   // 模块表回传主线程落盘
          }]);
        }
      });
      importScripts(${JSON.stringify(new URL(url, location.href).href)});  // 再加载原 worker 脚本
    `;
    const blob = new Blob([probe], { type: 'text/javascript' });
    const w = Reflect.construct(target, [URL.createObjectURL(blob), opts]);
    w.addEventListener('message', e => {
      if (e.data && e.data.__webpackDump) window.__WORKER_DUMP = e.data.__webpackDump;  // 落 run/worker-webpack-modules.json
    });
    setTimeout(() => w.postMessage({ __dumpWebpack: 1 }), 0);
    return w;
  }
});
// 触发目标交互让 worker 跑起来后，window.__WORKER_DUMP 即 worker 内 __R.m，按 §2.2~§2.4 同法抽闭包。
```

`importScripts` 加载子脚本的 worker 同理：在探针里覆盖 `self.importScripts` 记录/改写被加载的 URL，再在每段加载后 dump 该 Realm 的 `__R.m`。worker 内同样可用 §2.4 的 Proxy 包 `__webpack_require__` 得精确闭包（探针里把 `self.__R` 换成 Proxy 即可）。

> **CORS 限制告警（跨源 worker 脚本会让上面这套同源 Blob 法失效）**：上面探针靠 `importScripts(${new URL(url, location.href).href})` 把原始 worker 脚本拉进**同源 Blob worker** 再 dump。但 anti-bot 厂商常把 worker 脚本放在 **CDN / 跨源**。同源 Blob worker 内 `importScripts` 加载**跨源**脚本受 CORS 约束：目标脚本响应**没有 `Access-Control-Allow-Origin` 头**时，`importScripts` 会被**静默拦截**（不抛清晰错误、worker 内拿不到 `webpackChunk_xxx`，`__R.m` dump 不出来），极易被误判成"探针没装上"。**判定**：worker `url` 与页面 `location.origin` 不同源时，本节同源 Blob 法不适用。**改走** `worker-playbook.md` 的「跨源 worker：CDP 跨 target 注入 / 创建前 hook」一步（step 6 跨源分支）——在 worker 自己的 target 上下文里装探针 dump `__R.m`，不要再指回本节同源法。

**iframe：进子 frame 的 `contentWindow` dump**

```javascript
// 同源 iframe：直接读子 frame 的 webpackChunk_xxx（跨源 iframe 读不到，须改用 worker-playbook 的注入/CDP 跨 frame 方案）
const ifr = document.querySelector('iframe');
const fw = ifr.contentWindow;
const g = Object.keys(fw).find(k => k.startsWith('webpackChunk'));
fw[g].push([[-1], {}, r => {
  const dump = {}; for (const id in r.m) dump[id] = r.m[id].toString();
  window.__IFRAME_DUMP = dump;   // 落盘后按 §2.2~§2.4 同法抽闭包
}]);
```

**跨源 Worker**（worker 脚本在 CDN/跨源，同源 Blob 法 `importScripts` 被 CORS 静默拦截）、**跨源 iframe**（读不到 `contentWindow`）、**Service Worker** 等情形，都改走 `worker-playbook.md` 的「跨源 worker：CDP 跨 target 注入 / 创建前 hook」与注入时机方案，在目标 target 自己的上下文里 dump `__R.m`。**双向交叉引用（非环形）**：本节同源 worker / 同源 iframe 的 `__R.m` dump 在此就地完成；跨源情形单向转 `worker-playbook.md` 的具体手法、不再回指本节同源法。`worker-playbook.md`「对 worker 内部再做最小定位」一步**命中同源 worker 内 webpack runtime** 时，可回本节同源 Blob 法抽闭包。

---

## 3. 入口/出口契约（Extract 阶段交付物）

抽完必须写清契约，否则补环境会补错对象：

- **入口**：导出的目标函数名 + 参数签名（类型、顺序、是否依赖 `this`）。
- **出口**：返回值形态（字符串/对象/Promise），与浏览器侧 swap 对齐的样本。
- **依赖清单**：闭包内模块 id 列表 + 各自来源行号。
- **仍需补的外部符号清单**：闭包**外**被引用但未带进来的符号（`window` / `navigator` / `document` / `crypto` / `atob` / 自定义全局），逐条标记 → 这就是交棒补环境的输入。

落盘 `run/extracted-closure.js` + `run/closure-manifest.json`：

```json
{
  "target": "sign",
  "entrySignature": "sign(params: object, ts: number): string",
  "closureModuleIds": ["1432", "880", "77"],
  "externalSymbols": ["window.navigator.userAgent", "atob", "crypto.getRandomValues"],
  "externalSymbolCount": 3,
  "canPatchEnv": true
}
```

`externalSymbolCount` 按 §0 的**独立语义单元**口径计（同源 `navigator.*` 多个属性算 1 个单元，不是逐叶子计）；`≤ N`（默认 30）且不深绑 DOM/网络 → `canPatchEnv: true`，进入补环境；否则回退 D 模式整段 bundle。

---

## 4. Handoff 到补环境（必接）

扣出最小闭包 ≠ 跑出正确结果。`externalSymbols` 清单逐条交给补环境处理：

1. 先 `node run/extracted-closure.js`，记录 **first divergence**（首个缺失符号 / 首个错误输出）。
2. 按 `env-drift-decision-tree.md` 的 drift taxonomy 归类该 divergence，**一轮只补一个最小因果单元**。
3. 需要识别「环境值是否参与算法」时走 `env-as-algorithm-input-playbook.md`；补丁规范以 canonical `../docs/reference/env-patching.md` 为准。
4. Node 侧反检测对齐（`toString` native code 伪装、`Object.prototype.toString.call` tag）见 `env-conformance-playbook.md`。

交付前回到 `node $TOOL_DIR/...` 的 `run/verify-once.mjs` 真跑通，未跑通不得宣称完成（SKILL 红线 3）。

---

## 5. 常见误区

- **把「扣了一半」当 Rebuild 完成**：没产出 `run/extracted-closure.js` + 契约就进 Verify，必然返工。
- **不评估闭包大小就硬扣**：闭包爆炸还硬抽，不如整段 bundle 补环境（D 模式）省事。
- **正则求依赖当成精确**：动态 id / 计算属性会漏，用运行时 `__R.c` 缓存交叉验证。
- **抽出来不还原就读**：CFF/字符串数组未还原时模块体不可读，先过 `deobf.md`。
- **跳过 handoff**：闭包能 `require` 不代表输出正确，外部符号没补对照样跑错（且静默）。
- **抽出后静默跑错先排查模块自校验（self-defending / require 改写检测）**：bundle 带 self-defending / debug-protection 时，模块会用 `Function.prototype.toString` 比对自身源码、或校验 `__webpack_require__` 是否被改写（被改写时**返回错值而非报错**，触发完整性自爆）。抽出单跑时你的手搓 shim 与格式化后的源码都会让这些校验失败，于是静默产出错误签名。**跑出的值与浏览器对不上、但又不报错时，先怀疑模块自校验，再怀疑闭包不全**；绕过手法（`toString` 伪装、还原 require 原貌）见 `anti-tamper-playbook.md` 的 toString 伪装/完整性校验小节。
