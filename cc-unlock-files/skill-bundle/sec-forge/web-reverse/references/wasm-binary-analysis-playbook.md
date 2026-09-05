# WASM Binary Analysis Deep-Dive Playbook

Version: 1

适用场景：WASM模块分析需要超越WAT层面，深入二进制结构、内存布局、运行时行为和算法识别。本playbook作为 `wasm-runtime-playbook.md` 的深度补充。

---

## 1. WASM二进制分析工具链

### 1.1 标准工具

| 工具 | 用途 | 命令示例 |
|------|------|---------|
| `wasm2wat` (WABT) | 二进制转WAT | `wasm2wat module.wasm -o module.wat` |
| `wat2wasm` (WABT) | WAT转二进制 | `wat2wasm module.wat -o module.wasm` |
| `wasm-objdump` (WABT) | 段结构分析 | `wasm-objdump -x module.wasm` |
| `wasm-decompile` (WABT) | 反编译为类C代码 | `wasm-decompile module.wasm -o module.wasm.decomp` |
| `wasm2c` (WABT) | 转C代码 | `wasm2c module.wasm -o module.c` |
| `wasm-opt` (Binaryen) | 优化与分析 | `wasm-opt -O3 module.wasm -o opt.wasm` |
| `wasm-reduce` (Binaryen) | 测试用例简化 | `wasm-reduce ...` |
| `wasminspect` | 交互式调试 | `wasminspect module.wasm` |
| `wasm-tools` (BA) | 现代瑞士军刀：parse/print/validate/strip/component | `wasm-tools print module.wasm` |

### 1.1b 反编译器（大模块优先出伪 C，而非只 wasm2wat）

| 工具 | 用途 | 说明 |
|------|------|------|
| **IDA 9.x** | 原生 wasm loader + 反编译 | 大/复杂模块首选，直接出伪 C，比 WAT 可读 |
| **Ghidra + wasm 插件** | wasm 反编译出伪 C | 开源替代，配 wasm 处理器/loader 插件 |
| emscripten 产物 | 用 `.symbols` / DWARF 恢复符号 | 带 name section / sourcemap 时优先恢复符号名再读 |

> 经验：WAT 适合小模块或定位单函数；**大模块直接走反编译器出伪 C**，不要硬读 wasm2wat 的栈式指令。

### 1.1c WASM 分析 MCP 能力映射（先探测环境再选工具）

与 `browser-mcp-capability-map.md` 同理：**「分析 WASM 需要的能力」与具体工具无关**，但若环境内已挂二进制分析类 MCP，优先用它们替代手敲 wabt 命令——能直接出伪 C / 交叉引用，比读 WAT 快得多。开工前先看可用工具里的 `mcp__<server>__*` 前缀确认你有哪个：

| 分析能力（方法论需要） | 有 `ida-pro-mcp` | 有 `radare2` | 二者皆无的 fallback |
|---|---|---|---|
| **加载 / 反编译 wasm 出伪 C** | ✅ IDA 原生 wasm loader + `decompile_function`（按 export/函数地址反编译，比 WAT 可读） | ⚙️ `r2 -A` / `aaa` 自动分析后读反汇编；wasm 反编译能力弱于 IDA，主要做粗筛 | `wasm-decompile module.wasm`（WABT，伪 C）/ 退回 `wasm2wat` 读栈式指令 |
| **函数枚举 / 段·函数粗筛** | ✅ 列函数 + 按 Code 段大小定位大函数 | ✅ `list_functions`（`afl`）按大小/调用度排序，先看最大函数 | `wasm-objdump -x`（看 Code 段各 func size，最大者通常是核心算法） |
| **字符串 / 常量扫描**（找错误消息、provider 名、魔数） | ✅ 列字符串 + 数据段交叉引用 | ✅ `list_strings`（`izz`）扫全二进制字符串 | `wasm-objdump -s` + `xxd module.wasm \| grep`（搜 S-box/魔数字节序列） |
| **交叉引用定位 S-box / 轮函数 / 密钥表** | ✅ `get_xrefs_to`：从数据段（S-box/K 表）反查读它的函数，直接锁定轮函数 | ⚙️ `axt`/`axf` 看引用关系（解析度有限，配合字符串/常量人工关联） | 无 xref：只能从 §4 算法特征 + Data 段内容人工比对 |
| **运行时 hook export 抓入参/内存** | （静态为主，运行期取证仍走浏览器 MCP） | （同左） | §5.2 JS 侧包装 export + §3.2 内存 diff（与具体 MCP 无关） |

落地顺序：

1. **有 `ida-pro-mcp`** → 用其 wasm loader 加载，先列函数按大小定位大函数，`decompile_function` 出伪 C；对疑似 S-box/K 表的数据段用 `get_xrefs_to` 反查读取它的函数，直接锁定轮函数 / 加密核心。
2. **有 `radare2`** → `r2 -A`（或 `aaa`）自动分析后，做函数粗筛（按大小/调用度排序找最大函数）+ 字符串扫描（找 provider/错误码/魔数线索）。工具名以实际挂载的 radare2-mcp 前缀（`mcp__radare2__*`）为准——不同发行版常把这些能力暴露为透传 `afl`（列函数）/`izz`（扫字符串）/`axt`（看引用）的命令入口，先看前缀确认你有哪个，别照搬 `list_functions`/`list_strings` 等名字。操作锚点：运行时先列一次可用工具（确认实际暴露的命令名/前缀）再调用，别凭记忆拍命令名。radare2 的 wasm 反编译弱于 IDA，主要承担「段/函数粗筛 + 字符串扫描」，深拆伪 C 仍优先 IDA。
3. **二者皆无** → 退回 wabt：`wasm-decompile` 出伪 C、`wasm2wat` 读 WAT、`wasm-objdump -x/-s` 看段结构与数据段（即上文 §1.1 / §1.1b 工具链）。

> 与 `browser-mcp-capability-map.md` 的分工：那张表是**浏览器侧运行期取证**（hook signer / 抓网络），本表是 **wasm 二进制静态分析**；同一任务里二者常配合——先 IDA/radare2 静态锁定核心函数，再用浏览器 MCP 在运行期 hook 对应 export 抓样本对交叉验证。

### 1.2 浏览器内工具

- **Chrome DevTools**：Sources面板支持WASM调试（设置断点、单步执行、查看内存）
- **Firefox DevTools**：Debugger支持WASM源码映射
- **Chrome扩展**：Wasm Code Explorer

### 1.3 推荐安装

```bash
# WABT (WebAssembly Binary Toolkit)
# https://github.com/WebAssembly/wabt
# 提供 wasm2wat, wat2wasm, wasm-objdump, wasm-decompile, wasm2c

# Binaryen
# https://github.com/WebAssembly/binaryen
# 提供 wasm-opt, wasm-reduce, wasm-dis, wasm-as
```

---

## 2. 二进制结构分析

### 2.1 段（Section）级分析

使用 `wasm-objdump -x` 获取段级视图：

```
Section Details:

Type[1]:
 - type[0] () -> i32           # 函数类型签名
 - type[1] (i32, i32) -> i32   # 两个i32参数，返回i32
Import[2]:
 - func[0] sig=0 <env><get_time>     # 导入env.get_time
 - memory[0] pages: initial=256 <env><memory>  # 导入内存
Function[3]:
 - func[1] sig=1              # 内部函数，类型签名1
 - func[2] sig=0
 - func[3] sig=1
Export[2]:
 - func[1] -> "compute_hash"  # 导出函数
 - memory[0] -> "memory"      # 导出内存
Data[1]:
 - segment[0] memory=0 size=1024 - init i32.const 1024  # 数据段
Code[3]:
 - func[1] size=2345          # 函数体大小（可用于定位大函数）
 - func[2] size=123
 - func[3] size=567
```

**分析要点**：
- 关注最大的Code段（通常是核心算法）
- 关注Data段内容（可能包含密钥表、S-box、常量字符串）
- 关注Import段（了解WASM与JS的交互面）

### 2.2 数据段（Data Segment）深度分析

数据段常包含关键信息：

```
# 提取数据段内容
wasm2wat module.wasm | grep "(data"
```

**常见内容**：
- **S-box表**：AES的SubBytes表（256字节）
- **轮常数**：AES的Rcon表、SHA的K表
- **字符串常量**：错误消息、版本号、调试信息
- **密钥材料**：硬编码密钥（虽然少见但存在）
- **魔数/标识**：`0x52494646` ("RIFF") 等文件格式标识

**识别密码学常量的方法**：
```bash
# 将WASM转储为字节，搜索常见魔数
xxd module.wasm | grep "63 7e ..."  # AES S-box 前几个字节
```

---

## 3. 内存分析技术

### 3.1 线性内存布局

WASM使用单一线性内存（通常32位地址空间）：

```
地址 0          1024       2048       ...       16MB
     ├──────────┼──────────┼─────────┼──────────┤
     │  栈区    │  堆区    │ 数据段  │  动态分配 │
     │ (向下增长)│ (向上增长)│         │          │
     └──────────┴──────────┴─────────┴──────────┘
```

**分析策略**：
1. 确定栈指针初始位置（通常从内存末尾开始）
2. 确定数据段加载地址（从objdump获取）
3. 追踪关键export的内存访问范围

### 3.2 运行时内存快照

在浏览器中捕获WASM内存：

```javascript
// 在调用关键export前后捕获内存
const mem = wasmInstance.exports.memory;
const before = new Uint8Array(mem.buffer.slice());

// 调用目标函数
const result = wasmInstance.exports.compute_sign(ptr, len);

const after = new Uint8Array(mem.buffer.slice());

// 对比差异
const diff = [];
for (let i = 0; i < before.length; i++) {
  if (before[i] !== after[i]) {
    diff.push({ addr: i, before: before[i], after: after[i] });
  }
}
console.log('[WASM Memory Diff]', diff.slice(0, 50));
```

### 3.3 指针语义分析

当export接收指针参数时：

```javascript
// 示例：compute_sign(ptr, len, out_ptr)
// 分析输入指针
const inputBytes = new Uint8Array(wasmInstance.exports.memory.buffer, ptr, len);
console.log('[WASM Input]', Array.from(inputBytes));

// 分析输出指针
const outputLen = 32; // 假设输出32字节
const outputBytes = new Uint8Array(wasmInstance.exports.memory.buffer, out_ptr, outputLen);
console.log('[WASM Output]', Array.from(outputBytes));
```

**关键问题**：
- 输入数据的编码方式（UTF-8、二进制、小端/大端整数）
- 输出数据的生命周期（调用后是否立即失效）
- 指针是否由WASM内部分配（如调用malloc）

---

## 4. 算法识别指南

### 强制前置步骤

在深入本节的WASM算法识别之前，**必须先通过SKILL.md的"算法识别强制检查"流程**：

1. 完整输出观察（至少3对完整样本）
2. 已知算法特征排查（P0→P1→P2→P3优先级表）
3. 外部搜索（目标站点+算法关键词）

**不得在未完成上述检查前，仅凭WAT/WASM局部特征就下"自定义算法"结论。**

### 4.1 从WAT/WASM识别密码学算法

#### AES识别
```wasm
;; 特征1: 大量使用i32.load8_u + i32.store8（字节级操作）
;; 特征2: 固定循环8-14轮（取决于密钥长度）
;; 特征3: 存在256字节的查找表访问
;; 特征4: 位运算模式：xor, shl, shr_rot

(i32.load8_u (i32.add (local.get $sbox_base) (local.get $byte)))
;; ↑ 典型的S-box查找
```

#### SHA-256识别
```wasm
;; 特征1: 64轮循环（压缩函数）
;; 特征2: 大量ROTR（循环右移）和SHR（逻辑右移）
;; 特征3: 使用64个不同的32位常量（K表）
;; 特征4: 维护8个状态变量（a-h）
;; 特征5: 顺序：Ch → Maj → Σ0 → Σ1 → 模加

(i32.add
  (i32.add
    (i32.xor (i32.rotr (local.get $e) (i32.const 6)) ...)
    ...)
  ...)
;; ↑ 典型的SHA-256轮函数结构
```

#### HMAC识别
```wasm
;; 特征1: 两次调用同一哈希函数
;; 特征2: 密钥与固定常量异或（0x36和0x5C）
;; 特征3: 内部哈希结果作为外部哈希的输入
;; 特征4: 存在ipad和opad的初始化逻辑
```

### 4.2 从反编译代码识别

使用 `wasm-decompile` 获得类C代码后：

```c
// 如果看到大量这种结构，可能是位运算密集的哈希
int f(int a, int b, int c) {
  return ((a >> 2) | (a << 30)) + b + c;  // SHA-like ROTR+ADD
}

// 如果看到这种查找表模式，可能是S-box
int sub_byte(int x) {
  return memory[1024 + (x & 255)];  // 1024是S-box基地址
}
```

---

## 5. WASM调试技术

### 5.1 Chrome DevTools调试

1. **启用WASM调试**：
   - Sources面板 → 找到wasm文件
   - 点击即可查看反汇编代码

2. **设置断点**：
   - 在函数开头点击行号
   - 或在调用 `wasmInstance.exports.xxx()` 的JS代码处设置断点，然后Step Into

3. **查看内存**：
   - Console中运行 `new Uint8Array(wasmInstance.exports.memory.buffer)`
   - 或使用内存快照工具

4. **条件断点**：
   - 在Wasm函数内设置条件断点（需要DevTools支持）

### 5.2 日志插桩（无需源码）

在JS侧包装关键export，记录参数和内存：

```javascript
function instrumentWasmExport(wasmInstance, exportName) {
  const original = wasmInstance.exports[exportName];
  wasmInstance.exports[exportName] = function(...args) {
    console.log(`[WASM:${exportName}:in]`, args);
    
    // 如果参数包含指针，读取内存
    const mem = new Uint8Array(wasmInstance.exports.memory.buffer);
    if (args.length >= 2 && typeof args[0] === 'number' && typeof args[1] === 'number') {
      const ptr = args[0];
      const len = args[1];
      console.log(`[WASM:${exportName}:input_mem]`, 
        Array.from(mem.slice(ptr, ptr + Math.min(len, 64))));
    }
    
    const result = original.apply(this, args);
    console.log(`[WASM:${exportName}:out]`, result);
    return result;
  };
}
```

---

## 6. wasm2c迁移策略

当需要将WASM算法迁移到C/Python时：

### 步骤1：生成C代码
```bash
wasm2c module.wasm -o module.c
```

### 步骤2：分析生成的C代码
- `wasm2c` 生成的代码结构：
  - 每个WASM函数对应一个C函数
  - 使用结构体模拟WASM内存和栈
  - 内置函数处理i64、内存访问等

### 步骤3：简化与提取
- 识别核心算法函数（通常是最长的函数）
- 将WASM内存模型转换为标准C数组/指针
- 移除WASM运行时框架（如果不需要完整的WASM语义）

### 步骤4：编译验证
```bash
gcc -O2 module.c -o module_test
./module_test
```

---

## 7. 交付要求

WASM深度分析时，除 `wasm-runtime-playbook.md` 要求外，额外补充：

- `run/wasm-section-analysis.md` — 段级分析结果
- `run/wasm-data-segments.json` — 数据段内容（脱敏）
- `run/wasm-memory-layout.md` — 内存布局分析
- `run/wasm-algorithm-identification.md` — 算法识别结论
- `run/wasm-binary-samples/` — 解密前后的wasm样本（脱敏存储）

---

## 8. 常见误区

- 只看WAT不看二进制结构，遗漏数据段信息
- 忽略内存对齐问题（WASM要求对齐访问）
- 将WASM的i32当作有符号整数处理（实际是无符号的，取决于操作）
- 未验证就从WAT猜测算法（需要运行时样本交叉验证）
- 忘记WASM的栈是值栈不是调用栈（调用栈由引擎管理）
- 混淆线性内存的page大小（1 page = 64KB）
- **仅凭局部输出截断样本（如前256字节）就猜测"自定义轻量算法"，未先排查TEA等标准块加密算法**
- **在样本截断（未捕获完整输出）的情况下建立算法假说，遗漏了截断点之外的修改范围**
- **未搜索目标站点+算法关键词的外部已有分析，在已知公开的算法上重复深挖**
