# Anti-Tamper Playbook

Version: 1

适用场景：目标使用自校验、完整性校验、Trusted Types、CSP、SRI、hook 封堵、toString 完整性检查或对象冻结来阻断调试、注入或替换。

## 目标

- 识别完整性面、hook 阻断面和实际业务保护面。
- 识别 sink protection 与 runtime self-check 的关系。
- 识别最小可行 patch 面与残余未解模式。

## 建议流程

1. 先列出 self-check surface，不要直接硬改全局对象。
2. 记录检测点、触发时机、被校验对象和失败后果。
3. 记录 Trusted Types / CSP / SRI 是否只是环境门槛，还是直接约束业务代码路径。
4. 把 anti-tamper 与 anti-debug、dynamic-code、env 关系拆开。

## 最低交付

- `run/anti-tamper-notes.md`
- `run/integrity-surface.json`

## self-defending bundle 识别信号

扣出的闭包**静默产出错误签名却不报错**时，优先怀疑模块自校验（self-defending / debug-protection），而非闭包不全。典型信号：

- 跑出的值与浏览器对不上，但**没有任何异常/报错**（自爆走「返回错值」而非 throw）。
- bundle 里出现 `function(){return ...}.constructor("return this")()`、`debugger` 循环、`Function.prototype.toString` 被读取并 `indexOf`/正则比对自身源码。
- `__webpack_require__` / `webpackJsonp` / require 工厂被读取后做相等性或长度比对。

## toString 完整性校验绕过

目标用 `Function.prototype.toString()` 取自身源码做指纹比对（检测函数是否被 hook / 美化 / 改写）。绕过要点：**原型级 hook，且保真 name/length**。

```javascript
// 原型级覆盖（不要只 hook 单个实例：self-check 常用 fn.toString.call(targetFn) 穿透实例 hook）
const _toString = Function.prototype.toString;
const fakeSources = new WeakMap(); // 目标函数 → 要伪装成的源码字符串
Function.prototype.toString = new Proxy(_toString, {
  apply(target, thisArg, args) {
    if (fakeSources.has(thisArg)) return fakeSources.get(thisArg);
    return Reflect.apply(target, thisArg, args);
  }
});
// 保真：toString 自身的 name/length 必须与原生一致，否则二阶自检（对 toString 再 toString）会暴露。
// 注：Proxy 默认已转发被包装的 _toString 的 name/length，下面两行是显式兜底（防个别环境/二次包装下转发失真），并非不写就一定失真。
Object.defineProperty(Function.prototype.toString, "name", { value: "toString" });
Object.defineProperty(Function.prototype.toString, "length", { value: 0 });
```

- 关键：自检常用 `Function.prototype.toString.call(fn)` 而非 `fn.toString()`，**只 hook 实例 `.toString` 会被 `.call(fn)` 穿透**，必须改原型。
- 与 `env-conformance-playbook.md` §7.5 的 `markNative` 对齐：被 hook 的函数对外 `toString` 必须仍是 `function xxx() { [native code] }` 或原始源码。
- 单点 toString 伪装样例见 `anti-debug-snippets.md` #5；本节是其**完整性校验场景**的强化版（保真 + 原型级 + 穿透防护）。

## `__webpack_require__` 改写检测的还原

self-defending bundle 会检测 `__webpack_require__` / 模块工厂是否被劫持（被改写时返回错值触发自爆）。还原原则：**保留原 require 引用、在工厂外层包壳，不改全局 require 本体**。

```javascript
// 反例（会被检测）：直接覆盖全局 __webpack_require__ 或改模块工厂 .toString 可见的源码
// 正例：dump 模块时保存原始工厂函数引用，shim 只在「调用前后」插桩，不修改工厂体本身
const _factory = modules[id];               // 原始工厂，保持其 toString 原貌
const wrapped = function (module, exports, require) {
  // 取证仅在外层，不进入工厂内部改写
  return _factory.call(this, module, exports, require);
};
// 若 bundle 校验 require.toString()/length，wrapped 需 markNative 或直接复用原 require 引用传入。
```

- 手搓 require shim 与「格式化后的源码」都会让 self-check 失败 → 静默错值；扣单跑时优先**保留 webpack 运行时原貌**（见 `closure-extraction-playbook.md` 运行时劫持 dump 法）。

## Object.freeze / 冻结原型应对

目标 `Object.freeze(Function.prototype)` / 冻结关键对象阻止 hook：

- 在冻结**之前**注入（`add_script_to_evaluate_on_new_document` / preload 阶段抢跑），冻结后再改会静默失败。
- 若已冻结，改用 `Proxy` 包裹**调用点**（拦截 callsite 而非改被冻结对象），或在 CDP 层用 `Debugger.setScriptSource` / 条件断点取证。

## 最低交付

- `run/anti-tamper-notes.md`：记录命中的每个完整性面 + 用了哪种绕过 + 如何验证已绕过（值与浏览器对齐）。
- `run/integrity-surface.json`。

## 禁止事项

- 一上来全局重写对象，不记录完整性面。
- 不区分 sink protection 与 runtime self-check。
- 声称已绕过，但没有残余模式与最小 patch 说明。
- 只 hook 函数**实例** `.toString` 而不改原型（被 `.call(fn)` 穿透）。
- hook 后不保真 name/length，被二阶自检暴露。
