# Anti-Debug Snippets

## 1. Timer / debugger 拦截

```javascript
["setInterval", "setTimeout"].forEach((name) => {
  const original = window[name];
  window[name] = function (cb, delay, ...rest) {
    const source = typeof cb === "function" ? cb.toString() : String(cb);
    if (/debugger|devtools/i.test(source)) {
      console.log("[anti-debug] blocked", name, source.slice(0, 80));
      return 0;
    }
    return original.call(this, cb, delay, ...rest);
  };
});
```

## 2. Timing 归一化（压制单步 / 暂停时间差）

timing 型反调试靠 `Date.now()` / `performance.now()` 的 **delta** 检测单步与断点暂停（暂停期间真实墙钟差暴增 → 触发自爆）。**恒等包装（`now = () => originalNow()`）等于什么都没做**，delta 照样暴露。要真正压制，必须让暂停期间的时间差对页面**不可见**。两档实现，按需选：

**档位 A — 量化（推荐，覆盖 delta 检测）**：记录基准，每次取值返回平滑递增的固定小步长，真实墙钟差被夹掉。

```javascript
// performance.now 量化：返回单调递增的小步长，断点/单步期间的真实墙钟差不可见
const originalPerfNow = performance.now.bind(performance);
let perfVirtual = 0;
const PERF_STEP = 0.1; // 每次调用虚拟前进 0.1ms，足够平滑且抹掉暂停跳变
performance.now = function () {
  perfVirtual += PERF_STEP;
  return perfVirtual;
};

// Date.now 量化：以虚拟时钟为准，避免暂停期间的墙钟跳变
const originalDateNow = Date.now;
const dateBase = originalDateNow();
Date.now = function () {
  return dateBase + Math.floor(perfVirtual);
};
```

**档位 B — 冻结/夹紧**：对相邻两次取值的 delta 做上限夹紧，超过阈值就按固定小增量返回（保留部分真实时序，副作用更小）。

```javascript
const originalPerfNow = performance.now.bind(performance);
let lastReal = originalPerfNow();
let lastReturned = lastReal; // 夹紧后的虚拟时间基准，performance.now 与 Date.now 共用
const MAX_DELTA = 5; // 单次取值最多前进 5ms，超出视为暂停跳变并夹紧
performance.now = function () {
  const real = originalPerfNow();
  const delta = Math.min(real - lastReal, MAX_DELTA);
  lastReal = real;
  lastReturned += Math.max(delta, 0.01);
  return lastReturned;
};

// Date.now 同源夹紧：读同一个 lastReturned 虚拟时间，避免与 performance.now 的 delta 互相矛盾
const originalDateNow = Date.now;
const dateOffset = originalDateNow() - lastReturned; // 墙钟与虚拟时钟的固定偏移，锁定二者同源
Date.now = function () {
  performance.now(); // 复用同一夹紧逻辑推进 lastReturned，确保两时钟单调同步
  return Math.floor(dateOffset + lastReturned);
};
```

**副作用**：量化（档 A）过猛会破坏依赖真实时序的业务逻辑（动画、节流、超时、媒体同步）；若目标链路本身读 timing 做业务计算，优先用档 B 夹紧，并把 `PERF_STEP / MAX_DELTA` 调到刚好压住 delta 检测又不破坏业务的最小值。`Date.now` 与 `performance.now` 要**同源**改写，避免两者 delta 互相矛盾被交叉检测识破。

## 3. DevTools 尺寸检测

```javascript
Object.defineProperty(window, "outerWidth", {
  configurable: true,
  get: () => window.innerWidth
});
Object.defineProperty(window, "outerHeight", {
  configurable: true,
  get: () => window.innerHeight
});
```

## 4. Function / eval 动态 debugger

```javascript
const OriginalFunction = Function;
window.Function = new Proxy(OriginalFunction, {
  construct(target, args) {
    const body = args[args.length - 1] || "";
    if (typeof body === "string" && /debugger/.test(body)) {
      args[args.length - 1] = body.replace(/\bdebugger\b/g, "0");
    }
    return Reflect.construct(target, args);
  }
});
```

## 5. toString 伪装

```javascript
const originalToString = Function.prototype.toString;
Function.prototype.toString = function () {
  if (this.__isHook__) {
    return `function ${this.__originalName__ || this.name}() { [native code] }`;
  }
  return originalToString.call(this);
};
```

## 6. console 固定

```javascript
const originalConsoleLog = console.log;
Object.defineProperty(console, "log", {
  value: originalConsoleLog,
  writable: false,
  configurable: false
});
```
