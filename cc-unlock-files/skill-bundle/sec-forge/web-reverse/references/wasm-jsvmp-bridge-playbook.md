# WASM-JSVMP Bridge Playbook

Version: 1

适用场景：JS VMP 与 WASM 模块之间存在调用关系、数据共享或协同执行，需要分析跨边界链路。

## 核心定位

WASM-JSVMP 混合不是"两个独立专题的叠加"，而是需要统一分析的复合执行链：

- 算法可能在 WASM 中，但输入准备和输出消费在 VMP 中
- 算法可能在 VMP 中，但用 WASM 加速某些子操作（如哈希、矩阵运算）
- 双方可能共享内存状态
- 环境值可能在 JS 侧读取，经 VMP 变换后传入 WASM

目标不是分别完成 VMP 分析和 WASM 分析，而是建立**跨边界调用图**和**数据流图**。

---

## 混合模式识别

### 模式 A：VMP 调用 WASM（最常见）

**特征：**
- VMP 的某个 handler 或 call bridge 调用 WASM export
- WASM 执行纯计算，返回结果给 VMP
- 环境值可能由 VMP 读取，经变换后写入 WASM 内存

**分析重点：**
1. VMP 中哪个 opcode/handler 触发 WASM 调用
2. VMP 栈/寄存器 → WASM 参数的映射
3. WASM 返回值 → VMP 状态的映射
4. 调用前后的内存变化

### 模式 B：WASM 调用 VMP（较少见但存在）

**特征：**
- WASM 的 import 函数是 VMP 提供的
- WASM 执行中回调到 VMP 逻辑
- 常见于事件驱动或异步回调场景

**分析重点：**
1. WASM imports 中哪些是由 VMP 提供的
2. WASM 在什么条件下触发这些 import 调用
3. 调用参数和返回值的语义

### 模式 C：内存共享

**特征：**
- VMP 直接读写 WASM 的 `memory.buffer`
- 双方通过内存区域交换数据，而非函数调用
- 环境值可能被写入共享内存的特定偏移

**分析重点：**
1. 共享内存的边界（起始偏移、长度、生命周期）
2. 读写时机和同步机制
3. 内存中的数据结构（字符串、数组、结构体）

### 模式 D：环境值桥接

**特征：**
- JS 侧读取浏览器环境值（navigator/screen/window）
- 环境值经 VMP 变换后传入 WASM
- 或环境值直接写入 WASM 内存，VMP 只负责触发

**分析重点：**
1. 环境读取点在 JS 侧、VMP 侧还是 WASM import 侧
2. 环境值的变换链（拼接、哈希、编码、压缩）
3. 变换后的值在 WASM 中的消费方式

---

## 分析流程

### 阶段 1：建立边界图

1. 画出 JS 侧、VMP 侧、WASM 侧三个泳道
2. 标记所有跨边界调用（箭头表示调用方向）
3. 标记所有共享内存区域
4. 标记环境值的读取点和流向

### 阶段 2：捕获调用样本

对每一次跨边界调用，记录：

- 触发时机（pc、调用栈、用户动作）
- 调用方向（VMP→WASM / WASM→VMP）
- 输入参数（类型、值、来源）
- 输出结果（类型、值、去向）
- 内存状态（调用前后的关键内存区域）

### 阶段 3：识别关键路径

从目标输出（如签名值、加密结果）反向追踪：

1. 输出由谁产生（VMP 还是 WASM）
2. 产生该输出需要什么输入
3. 这些输入来自哪里（环境值、用户输入、前一步计算）
4. 建立从"环境值/用户输入"到"目标输出"的完整链

### 阶段 4：验证环境依赖

对关键路径上的每个环节，验证环境值的影响：

1. 修改环境值，观察输出是否变化
2. 若变化，定位最小环境值集合
3. 建立环境值 → 中间结果 → 最终输出的映射

---

## 插桩策略

### 联合 hook 模板

> **两条编译路径都要 hook**：现代大 WASM 模块几乎都走 **流式编译** `instantiateStreaming` / `compileStreaming`，只 hook `instantiate(bytes, imports)` 会在 streaming 站点完全抓不到 imports/exports，误判"没有 WASM 桥"。下面三个入口用**同一套** imports/exports 包装逻辑，且必须在**目标脚本创建 WASM 实例之前预注入**（preload / `Page.addScriptToEvaluateOnNewDocument`）。

```javascript
// 通用包装逻辑：包 imports（标记环境读取函数）+ 包 exports
function wrapImports(imports) {
  const envImports = (imports && (imports.env || imports.wasi_snapshot_preview1)) || {};
  for (const [name, fn] of Object.entries(envImports)) {
    if (typeof fn === 'function') {
      envImports[name] = function(...args) {
        console.log("[wasm-bridge] import call", name, args);
        return fn.apply(this, args);
      };
    }
  }
  return imports;
}
function wrapInstance(instance) {
  const exports = instance.exports;
  for (const [name, exp] of Object.entries(exports)) {
    if (typeof exp === 'function') {
      instance.exports[name] = function(...args) {
        console.log("[wasm-bridge] export call", name, args);
        const ret = exp.apply(this, args);
        console.log("[wasm-bridge] export return", name, ret);
        return ret;
      };
    }
  }
  return instance;
}

// 1a. Hook WebAssembly.instantiate（bytes/module 直接编译路径）
const originalInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function(bytesOrModule, imports) {
  console.log("[wasm-bridge] instantiate", bytesOrModule.byteLength || bytesOrModule.length);
  const result = await originalInstantiate.call(this, bytesOrModule, wrapImports(imports));
  // instantiate(bytes) 返回 {module,instance}；instantiate(module) 返回 instance
  if (result.instance) wrapInstance(result.instance);
  else wrapInstance(result);
  return result;
};

// 1b. Hook WebAssembly.instantiateStreaming（流式编译，现代主路径）
// 注意：第一参是 Response 或 Promise<Response>，原生会消费掉 body 流，
// 需先 clone 读 bytes（取证用）再把原 Response 交回原生，避免流被读空报错
const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
if (originalInstantiateStreaming) {
  WebAssembly.instantiateStreaming = async function(source, imports) {
    const resp = await source;
    try {
      const buf = await resp.clone().arrayBuffer();
      console.log("[wasm-bridge] instantiateStreaming bytes", buf.byteLength);
    } catch (e) { /* clone 失败不阻断主流程 */ }
    const result = await originalInstantiateStreaming.call(this, resp, wrapImports(imports));
    wrapInstance(result.instance);
    return result;
  };
}

// 1c. Hook WebAssembly.compileStreaming（仅编译，后续配合 new WebAssembly.Instance）
const originalCompileStreaming = WebAssembly.compileStreaming;
if (originalCompileStreaming) {
  WebAssembly.compileStreaming = async function(source) {
    const resp = await source;
    try {
      const buf = await resp.clone().arrayBuffer();
      console.log("[wasm-bridge] compileStreaming bytes", buf.byteLength);
    } catch (e) { /* clone 失败不阻断主流程 */ }
    return originalCompileStreaming.call(this, resp);
  };
}

// 2. Hook VMP dispatch（在 VMP boundary 确定后）
// 记录每次 dispatch 前后状态，特别关注调用 WASM export 的 opcode
```

### 内存观察

```javascript
// 在 WASM export 调用前后观察内存
function observeMemory(memory, start, end, label) {
  const bytes = new Uint8Array(memory.buffer, start, end - start);
  console.log(`[wasm-bridge] memory ${label}`, start, end, 
    Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')
  );
}
```

---

## 环境值桥接分析

当环境值参与 VMP-WASM 混合链路时，按以下层次分析：

| 层次 | 位置 | 分析方法 |
|------|------|---------|
| L1 读取 | JS 侧 `navigator.xxx` / VMP ENVREAD handler / WASM import | hook 读取点，记录属性名和原始值 |
| L2 变换 | VMP 运算 / JS glue / WASM 本地计算 | 追踪变换链，记录中间结果 |
| L3 传递 | VMP→WASM 参数桥 / 共享内存写入 | 记录传递时机、编码方式、目标位置 |
| L4 消费 | WASM export / VMP handler | 记录消费方式和输出影响 |

---

## 交付要求

- `run/wasm-jsvmp-bridge.md`
  - 混合模式（A/B/C/D）
  - 跨边界调用图（文本或 Mermaid）
  - 关键调用样本（至少一条完整链）
  - 内存共享区域（若有）
  - 环境值桥接分析（若有）

- `run/wasm-imports-exports.json`
  - 需额外标记哪些 imports/exports 参与 VMP 交互

- `report.md` 中必须包含：
  - VMP-WASM 混合模式判定
  - 关键跨边界调用链摘要
  - 环境值是否参与混合链路
