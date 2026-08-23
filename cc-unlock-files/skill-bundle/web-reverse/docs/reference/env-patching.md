# Env Patching

这份文档是 `web-reverse` 的正式补环境规范。

## 目标原则

- 先取证，再补环境
- 最小宿主，逐项回填
- 代理日志优先
- `first divergence` 优先
- 一次只做一个补丁决策

## 三阶段落地

1. `Node rebuild`
2. `Portable runtime`
3. `Pure extraction`

## 最小补丁决策

一个补丁决策只允许覆盖一个最小因果单元：

- 基础值
- 存在性判定
- 函数壳
- 返回对象
- 最小对象契约

## 存在性判定优先

补环境前，先判断符号在浏览器里应当是：

- `present`
- `undefined`
- `absent`
- `pending`

不要把“当前 Node 缺什么”直接等同于“浏览器里应该补什么”。

高风险符号：

- `process`
- `Buffer`
- `global`
- `require`
- `module`
- `exports`
- `define`

这些 `Node/CommonJS/AMD` 符号在浏览器里经常本来就不存在。若无页面证据，不得默认补成 present 或 stub；先看 `typeof`、`in`、descriptor 与真实运行分支。

### 可操作探测序列（如何判定一个符号该 present 还是 absent）

不要凭印象判定。对每个待定符号，在**真实目标页面环境**里跑下面的存在性三连查，并取一次真实分支取证，再决定补不补、补到哪一档：

```javascript
// 在目标页面真实环境执行（DevTools / preload），对每个待定符号 sym 跑三连查
({
  typeofResult: typeof window[sym],                                  // "undefined" / "function" / "object" / ...
  inGlobal: sym in window,                                           // 区分「值为 undefined」与「键根本不存在(absent)」
  descriptor: Object.getOwnPropertyDescriptor(window, sym)          // getter? value? configurable/enumerable? —— 决定补值还是补 descriptor
})
```

三连查的判读：

- `typeof === 'undefined'` 且 `in === false` → **absent**：浏览器里键本来就不存在，Node 侧也应保持不存在，补成 present 反而制造 first divergence。
- `typeof === 'undefined'` 且 `in === true` → **undefined**：键存在但值为 `undefined`（常见于被显式置空 / getter 返回 undefined），Node 侧也要复现「键在、值 undefined」。
- `typeof !== 'undefined'` → **present**：再看 `descriptor` 决定补值（`value`）还是补 descriptor（`get`/`set`/`name`/`length`/`enumerable`），别只造同名函数。

**真实分支取证**：仅有上面三个静态结果还不够——必须确认目标代码**真的读了这个符号、且其 `present/absent` 状态改变了运行分支**（如 `typeof module !== 'undefined' ? umdExport() : globalExport()`）。在该读点 hook / 断点，记录命中的分支，才知道这个符号是否值得补、补成哪种状态。读点根本没命中的符号不补。

**为什么 Proxy 兜底壳危险（判别）**：把未知全局统一补成 `new Proxy({}, { get: () => ()=>{} })` 这类「万能壳」会让上面的 absent/undefined 判定全部失真——壳让 `typeof` 变成 `"object"`、`in` 永远为 `true`、任意属性访问都返回真值，于是浏览器里本该走 absent 分支的 anti-tamper / UMD / loader 探测被骗成 present 分支，整条 rebuild 跑偏且难定位。判别红旗：补丁后 `first divergence` 不前移反而后移、出现新的「为什么这里突然有值」的疑问、或 `sym in window` 对一批本应 absent 的符号集体变 true。命中即拆掉兜底壳，回到逐符号三连查。

> 指针级回链：存在性三连查与 Node 侧 `markNative` / `toStringTag` / `webdriver` 补丁骨架，见 `references/env-conformance-playbook.md` §4（存在性一致性）与 §7.5（Node 侧反检测对齐补丁）；canonical 原则在此，可操作骨架在那里，不要在本页重复抄骨架代码。

## 禁止事项

- 无页面证据补环境
- 无日志补环境
- 无 `first divergence` 连补多个对象
- 直接把整页 runtime 塞进 pure 实现
- 把所有未知全局统一补成 stub / Proxy 壳
- 未判断“真实缺失”还是“错误 present”就继续扩补
