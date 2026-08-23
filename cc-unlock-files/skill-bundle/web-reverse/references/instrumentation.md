# 插桩参考

适用场景：

- 参数在深层函数中生成
- 需要追踪 VMP dispatcher
- 需要抓中间值而不是只看最终结果
- 需要确认某个 handler 的输入输出边界
- 需要区分环境噪音和 VM 语义
- 需要追踪 `cookie / localStorage / sessionStorage` 如何被写入内存 signer state

优先顺序：

1. hook
2. preload hook
3. trace
4. breakpoint

## Hook 语义层级优先级

先定“**钩哪一层**”，再定“**用哪种 hook 手法**”。默认优先级：

1. **业务动作 / 状态机入口**：按钮动作、`dispatch`、command router、challenge decision point
2. **请求组装 / payload 边界**：request builder、payload builder、签名前入参归一化、`fetch/xhr` 调用前最后一跳
3. **reader**：签名前最后一次读取 signer state / session / token 的函数
4. **writer / bridge**：把 `cookie / storage / worker / frame` 同步进内存 signer state 的点
5. **低层 carrier / DOM / script**：`document.cookie`、storage setter、`script.src`、`setAttribute`、`appendChild`

结论：

- `Hook-preferred` 的意思是“优先走插桩路线”，不是“先在低层 surface 到处挂钩子”。
- 只有当上层语义面不可见、不可达或已被证据排除时，才回落到第 4～5 层。
- 从 `document.cookie` 换到 `cookieStore`，或从 `script.src` 换到 `appendChild`，不算真正 pivot，只算同类低层 hook 变体。
- 同一低层家族默认最多试 2 轮；两轮没有把证据推进到 `payload / sign / request-use`，就必须换语义层或换 entrypoint。

插桩记录必须写回：

- `runtime-evidence.jsonl`
- `report.md`

## Stateful Signer 插桩建议

优先追三类点：

- 高语义：`dispatch`、challenge action、payload builder、sign callsite、request builder
- writer：`cookie setter`、storage setter、bootstrap callback、token refresh 回调
- bridge：把 carrier 映射到 `u[idx] / signerState / runtime cache` 的同步点
- reader：签名前最后一次读取该状态的函数

建议先做低侵入且**高语义优先**的 hook：

- `dispatch / action / payload builder / request builder`
- sign callsite 的入参与返回值
- reader 的状态快照

仅当上层不可达时，再补下列低层 hook：

- `document.cookie` 读写
- `localStorage` / `sessionStorage` 的 `setItem`
- signer 容器对象的关键键位写入

这类任务的目标不是记录全部 VM 轨迹，而是拿到 `carrier -> writer -> signer state -> reader -> request-use` 最小证据链。

如果某个低层 hook 只能说明“值在哪里被写了”，却不能解释“它如何进入 signer / payload / request-use”，就不能把它当成当前主线完成，必须继续向上追 reader 或向前追 request 边界。

## 目标漂移自检

每次加 hook 前先问三件事：

1. 这条 hook 命中的层，离 `request acceptance` 还有几跳？
2. 它能否直接回答 `payload / sign / request-use` 的关键未知量？
3. 如果失败，下一跳是换语义层，还是只是换同层 surface？

若第 3 条的答案只是“再换一个 cookie / script / DOM hook 点”，说明还没有真正 pivot。

## JS-VMP 插桩建议

### 一级：低侵入

- hook VM constructor
- hook bytecode decode 函数
- hook dispatcher 入口
- hook bridge call

目标：先建立 `bytecode -> dispatcher -> bridge` 主骨架。

### 二级：中侵入

- 在 handler table 包装每个 handler
- 记录 `opcode`、`pc`、操作数长度、栈深变化
- 对 `regs` / `stack` 做摘要，不直接全量 dump

目标：建立 `opcode -> handler -> state delta` 对照表。

### 三级：高侵入

- 条件断点只命中特定 opcode
- 对关键 handler 做单步
- 对 call bridge 做入参与返回值对齐

目标：解决少量高价值、难命名 handler。

## 建议记录格式

每条轨迹最少包含：

- `ts`
- `pc`
- `opcode`
- `handler`
- `stackDepthBefore`
- `stackDepthAfter`
- `regsTouched`
- `notes`

## 低噪音原则

- 优先记录摘要，不要无条件全量 dump stack / regs
- 先限定时间窗或触发动作，再开追踪
- 先按 opcode 聚类，再展开 raw

## VMP 专项片段

```javascript
function wrapHandler(opcode, handler, getState) {
  return function (...args) {
    const state = getState.call(this);
    const beforeDepth = state.stack?.length ?? null;
    console.log("[vm]", JSON.stringify({
      opcode,
      pc: state.pc,
      stackDepthBefore: beforeDepth
    }));
    const rv = handler.apply(this, args);
    const afterState = getState.call(this);
    console.log("[vm]", JSON.stringify({
      opcode,
      pc: afterState.pc,
      stackDepthAfter: afterState.stack?.length ?? null
    }));
    return rv;
  };
}
```

更多 task-local 片段见：

- `references/vmp-instrumentation-snippets.md`

```javascript
function hookBridge(obj, name) {
  const orig = obj[name];
  obj[name] = function (...args) {
    console.log("[vm-bridge:in]", name, args);
    const rv = orig.apply(this, args);
    console.log("[vm-bridge:out]", name, rv);
    return rv;
  };
}
```
