# Env Drift Decision Tree

这个文档解决的是“补环境卡住了以后，下一刀该补哪里”。

## 1. drift taxonomy

先把偏差归类，不要盲补：

- `api-missing`
- `presence-misclassified`
- `descriptor`
- `scheduler`
- `typed-array`
- `crypto`
- `storage`
- `fingerprint`
- `return-shape`
- `error-surface`

## 2. 证据链

每一轮补丁前都要有完整 `证据链`：

1. 浏览器侧真实样本
2. Node rebuild 当前输出
3. first divergence
4. 该 divergence 属于哪个 drift taxonomy
5. 为什么当前补丁就是最小因果修复

没有证据链，不允许进入 patch。

## 3. 最小补丁单元

只能选择一个 `最小补丁单元`：

- 值
- 函数
- 存在性判定
- descriptor
- 返回对象壳
- 调度顺序
- 异常形态

单轮补丁禁止同时改两个以上 drift surface。

## 4. 决策树

如果 first divergence 是：

- `typeof foo !== "undefined"` / `'foo' in globalThis` / UMD loader / export branch 因未知全局被误判为存在
  进入 `presence-misclassified`
- `Object.getOwnPropertyDescriptor` / `toStringTag` / `name` / `length`
  进入 `descriptor`
- `queueMicrotask` / `Promise.then` / `MessageChannel` / `setTimeout` / `Date.now` / `performance.now`
  进入 `scheduler`（时间量需固定化复现时用 `node-env-rebuild.md`「确定性回放骨架」把 `Date.now`/`performance.now` 钉到取证时刻）
- `Uint8Array` / `ArrayBuffer` / `DataView`
  进入 `typed-array`
- `crypto.getRandomValues` / `crypto.subtle` / `Math.random`
  进入 `crypto`（随机量参与签名时用 `node-env-rebuild.md`「确定性回放骨架」回放浏览器侧采集的同一序列，而非真随机）
- `localStorage` / `sessionStorage`
  进入 `storage`
- `canvas / webgl / audio / rtc / timezone / font`
  进入 `fingerprint`（`getTimezoneOffset`/本地时间相关漂移用 `node-env-rebuild.md`「确定性回放骨架」显式对齐 `process.env.TZ`）
- 显式 env divergence 已基本消失，但 swap matrix 证明“只换本地 signer 就失败”或请求稳定 `200 + 空体`
  退出 `env` 主线，转到 `signature + session + storage + instrumentation-hooking`

## 5. browser -> node 回放闭环

补环境不是造壳，而是缩小 browser -> node 偏差：

1. 先记录 `run/browser-env-snapshot.json`
2. 在 Node 里复跑
3. 更新 `run/env-drift-matrix.md`
4. 只修 first divergence
5. 再次复跑并记录 `Rerun shift`

其中 `api-missing` 与 `presence-misclassified` 必须分开：

- `api-missing`：浏览器里确实存在，Node 里没有
- `presence-misclassified`：浏览器里本该 `undefined/absent`，却被本地 stub/Proxy 错补成 present

第二类往往更隐蔽，因为它不会立刻抛缺失异常，而是把执行流带进错误分支。

## 6. PureExtraction 准入

满足以下条件前，不得进入 `PureExtraction 准入`：

- first divergence 已前移或消失
- drift matrix 中高优先级项已对齐
- 仍未对齐项已经明确记录
- 结果不再依赖临时 patch 噪音

## 7. 高风险误判

- “代码能跑了”不代表环境已一致
- “有同名函数”不代表 descriptor 一致
- “返回了值”不代表 error surface 一致
- “异步最终完成”不代表 scheduler 一致
- “页面不再报错”也不代表 signer state 已写对
- “把未知全局补成 stub 后报错消失”不代表补对了；要先排除是否把本该缺失的符号误补成了 present
