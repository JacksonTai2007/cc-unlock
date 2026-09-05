# WASM Runtime Playbook

Version: 2

适用场景：

- `WebAssembly.instantiate` / `instantiateStreaming`
- 独立 `.wasm` 下载
- `emscripten` / `wasm-bindgen` / `wasm-pack` / `AssemblyScript`
- JS 只是包装层，核心算法落在导出函数或线性内存
- **WASM 模块被加密/压缩/动态生成**
- **WASM 与 JSVMP 混合执行**
- **WASM 从浏览器环境读取值参与运算**

本专题的目标不是只拿到一份 `wasm-analysis.wat`，而是明确：

1. 模块如何被加载
2. 导入导出如何映射到 JS 侧
3. 线性内存中的输入输出边界在哪里
4. **WASM 如何与 JS 环境交互（尤其是读取环境值）**
5. **WASM 是否受保护（加密/压缩/动态生成）**
6. 如何在浏览器或本地稳定复现关键函数

**强制前置规则**：当 WASM 模块涉及加密/解密/签名/哈希计算时，在假设"自定义WASM算法"之前，**必须先通过SKILL.md的"算法识别强制检查"流程**（完整输出观察→已知算法排查→外部搜索）。不得仅凭WAT局部反编译特征或截断样本下"自定义算法"结论。

---

## 1. 最小识别面

至少确认：

- 加载方式：`instantiate` / `instantiateStreaming` / bundler wrapper
- 模块来源：网络、内嵌字节、base64、动态拼接、**VM 生成**
- 框架特征：`emscripten` / `wasm-bindgen` / `AssemblyScript` / custom glue
- 关键导出：算法入口、内存、分配器、释放器
- **保护特征：是否加密/压缩/混淆**

### WASM 保护识别

| 保护类型 | 识别信号 | 应对策略 |
|---------|---------|---------|
| 字节码加密 | `.wasm` 文件内容非标准 WASM magic | 追踪 JS 侧的解密函数，拦截解密前后 |
| 字节码压缩 | 下载体积小，加载时有明显解压延迟 | hook `instantiate` 前解压点，捕获原始 bytes |
| 动态生成 | 没有独立的 `.wasm` 请求，bytes 由 JS 拼接 | 追踪 bytes 的所有来源，hook `new Uint8Array` |
| VM 生成 | WASM bytes 由 VMP 动态输出 | 参考 `wasm-jsvmp-bridge-playbook.md` |
| imports 混淆 | 导入函数名被哈希/压缩 | 通过运行时调用样本反推语义 |

---

## 2. 运行时优先级

推荐顺序：

1. 截获模块字节或 `Response.arrayBuffer()`（**优先捕获解密/解压前的原始 bytes**）
2. 记录 `imports` 结构
3. 记录导出函数名与 `memory/table/global`
4. 找到 JS wrapper 到导出函数的参数桥
5. **追踪 WASM 导入函数中的环境读取（imports.env 中是否有 navigator/screen/window 访问）**
6. 再做内存观察、指针语义和离线复现

---

## 3. 必抓证据

至少落下：

- `.wasm` 或字节缓存（**解密/解压后**的标准 WASM bytes）
- `wasm-analysis.wat`
- imports 摘要（**特别关注 env imports 中的浏览器 API 访问**）
- exports 摘要
- 至少一条真实调用样本
- 至少一段输入或输出内存片段
- **若存在保护：解密/解压前后的对比样本**
- **若读取环境值：环境读取点与变换链**

---

## 4. 环境值感知：WASM 中的浏览器环境读取

WASM 本身不能直接访问浏览器环境，但通过 JS imports 可以间接读取：

### 识别信号

- imports 对象中有 `env.navigator_*`、`env.screen_*`、`env.window_*` 等命名
- imports 对象中有 `env.get_user_agent`、`env.get_platform` 等函数
- JS glue 代码在调用 WASM export 前，先读取环境值并写入 WASM 内存
- WASM 的内存区域中包含环境相关字符串（如 userAgent、platform）

### 取证重点

1. **imports 侧**：哪些 JS 函数被导入到 WASM，这些函数是否读取环境
2. **glue 侧**：JS wrapper 是否在调用 WASM 前准备环境值
3. **内存侧**：环境值在 WASM 内存中的位置、编码方式、生命周期
4. **输出侧**：环境值是否影响 WASM 的输出结果

### 交换验证

- 修改环境值后，观察 WASM export 的输出是否变化
- 若变化，建立"环境值 → WASM 输入 → WASM 输出"的映射
- 若不变，排除环境值对该 export 的影响

---

## 5. 常见框架指纹

### Emscripten

- `Module`
- `HEAP8/HEAPU8/HEAP32`
- `ccall` / `cwrap`
- `_malloc` / `_free`

重点不是只看导出，而是把：

- JS wrapper 参数
- `HEAPU8.set(...)`
- 指针返回
- 输出切片

串成一条完整链。

**环境值相关：**
- Emscripten 的 `Module.preRun` / `Module.postRun` 中常包含环境检测
- `ENVIRONMENT_IS_WEB` / `ENVIRONMENT_IS_WORKER` 等分支可能读取 `window` / `self`

### wasm-bindgen / wasm-pack

- `passStringToWasm0`
- `getInt32Memory0`
- `cachedUint8Memory0`
- `__wbindgen_malloc`
- `__wbindgen_free`

重点是找：

- 输入字符串编码边界
- 输出指针和长度的回传方式
- JS glue 如何把导出结果再变回字符串或数组

**环境值相关：**
- `wasm-bindgen` 可能生成 `web-sys` 绑定，允许 Rust 代码直接访问 Web API
- 检查是否有 `navigator` / `window` / `document` 的绑定调用

### 自定义 glue

- `new Uint8Array(memory.buffer, ptr, len)`
- 手写 `TextEncoder/TextDecoder`
- 导出函数名被压缩或隐藏

这种场景更依赖真实调用样本与内存切片证据。

**环境值相关：**
- 自定义 glue 中更常见手动读取环境值并传入 WASM
- 重点追踪 `memory.set()` 前的数据来源

---

## 6. WASM + JSVMP 混合分析

当 WASM 与 JSVMP 混合时：

1. **识别耦合模式**：
   - VMP 调用 WASM export（VMP 是 caller）
   - WASM import 调用 VMP 函数（WASM 是 caller）
   - 双向调用

2. **参数桥分析**：
   - VMP 栈/寄存器中的值 → JS glue → WASM 内存/参数
   - WASM 返回值 → JS glue → VMP 状态

3. **内存共享**：
   - VMP 和 WASM 是否共享同一块内存（SharedArrayBuffer / WASM memory 被 VMP 直接访问）
   - 内存中是否有双方共同读取的"协议区域"

详细策略参考 `references/wasm-jsvmp-bridge-playbook.md`。

---

## 7. 内存分析要求

如果关键导出使用指针参数，至少要回答：

- 输入写入偏移
- 输入长度来源
- 输出返回方式：返回指针 / 写回调用者 / 栈式结构体
- 关键输出切片
- **环境值是否被写入内存作为输入**

只知道"调用了某个 export"不算完成。

---

## 8. 运行时 hook 建议

优先级：

1. hook `WebAssembly.instantiate`（捕获原始 bytes，无论是否加密）
2. hook `WebAssembly.instantiateStreaming`
3. 记录 imports/exports（**标记哪些 imports 读取环境**）
4. 对关键 export 做参数与返回值包装
5. 如需要，观察 `memory.buffer` 的调用前后切片
6. **若存在 VMP 调用 WASM，同时 hook VMP dispatch 和 WASM export**

默认先抓摘要，再决定是否落完整内存转储。

---

## 9. 交付要求

命中 WASM 专题时，至少补充：

- `task.json.wasmAnalysis`
- `run/wasm-analysis.wat`
- `run/wasm-runtime-hook-template.js`
- `run/wasm-notes.md`
- `run/wasm-imports-exports.json`
- `report.md` 中的 `WASM 状态`

报告至少写清：

- 加载方式
- 框架类型
- imports / exports 概要
- 关键内存边界
- **保护类型（若有）和解密/解压策略**
- **环境值交互点（若有）**
- 是否已获得离线复现路径

若命中 WASM + JSVMP 混合，额外补充：
- `run/wasm-jsvmp-bridge.md`

若命中 WASM 保护，额外补充：
- `run/wasm-protection-bypass.md`
- 解密/解压前后的 bytes 样本（脱敏存储）
