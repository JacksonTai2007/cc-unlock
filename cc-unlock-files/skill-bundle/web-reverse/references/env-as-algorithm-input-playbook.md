# Env-as-Algorithm-Input Playbook

Version: 1

适用场景：浏览器环境值（`navigator` / `screen` / `window` / `document` / `location` / `performance` 等属性）不仅仅是被读取用于"检测环境是否真实"，而是直接参与算法运算（签名、加密、哈希、位运算、数组索引、条件分支），影响最终输出结果。

这是现代前端逆向中最容易被忽视、也最关键的问题之一。

---

## 核心定位

环境值在目标代码中通常扮演三种角色：

| 角色 | 目的 | 分析方法 |
|------|------|---------|
| **检测向量** | 判断运行环境是否"真实"、是否"自动化" | 传统指纹分析 |
| **算法输入** | 直接参与签名/加密/哈希等运算 | 本 playbook 重点 |
| **控制流选择** | 根据环境值选择不同执行分支 | 控制流分析 |

一个环境值可能同时扮演多种角色。例如 `navigator.userAgent` 既可能用于检测 headless，也可能被哈希后作为签名参数。

**关键洞察**：补环境"通过检测"不等于"产生正确算法输出"。即使所有检测点都绕过了，如果环境值参与算法运算且值不正确，最终请求仍然会失败。

---

## 识别信号

### 强信号（高度怀疑环境值参与算法）

- 代码在初始化阶段连续读取大量环境属性，然后立即进入签名/加密函数
- 不同浏览器环境下，同一操作产生不同的签名/加密结果
- 补环境后检测通过，但请求被拒绝（`200+空体`、`silent reject`）
- VMP/WASM 中存在专门读取环境值的 handler/import，且读取后立即参与运算
- 环境值被传入 `CryptoJS`、`crypto.subtle`、自定义哈希函数、WASM export

### 弱信号（需要进一步验证）

- 代码读取了环境值但去向不明
- 环境值被存入数组/对象，后续被批量处理
- 环境值参与了字符串拼接，拼接结果进入网络请求

---

## 分析框架

### 三层追踪模型

```
L1 读取层 (Read)
  ↓
L2 变换层 (Transform)
  ↓
L3 消费层 (Consume)
```

#### L1 读取层

识别所有环境读取点：

- `navigator.*`（userAgent, platform, language, hardwareConcurrency, deviceMemory, maxTouchPoints, vendor, productSub, ...）
- `screen.*`（width, height, availWidth, availHeight, colorDepth, pixelDepth）
- `window.*`（innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio, screenX, screenY）
- `document.*`（documentElement.clientWidth, readyState, referrer, cookie, domain）
- `location.*`（href, protocol, host, hostname, port, pathname, search, hash）
- `performance.*`（timing, navigation, now()）
- `crypto.*`（getRandomValues）

读取点可能出现在：
- 普通 JS 代码
- VMP handler（ENVREAD 类）
- WASM import 函数
- 动态生成的代码（eval / Function）

#### L2 变换层

追踪读取后的变换链：

| 变换类型 | 示例 | 分析方法 |
|---------|------|---------|
| 字符串操作 | split, join, slice, substring, replace, match | 记录输入输出字符串 |
| 编码/解码 | btoa, atob, encodeURIComponent, TextEncoder | 记录编码前后对比 |
| 哈希/摘要 | MD5, SHA1, SHA256, 自定义哈希 | hook 哈希函数，记录输入 |
| 位运算 | &, \|, ^, ~, <<, >> | 记录操作数和结果 |
| 算术运算 | +, -, *, /, % | 记录运算链 |
| 数组/对象索引 | arr[index], obj[key] | 记录索引值来源 |
| 条件分支 | if/switch/三元运算符 | 记录条件值来源 |
| 拼接 | str1 + str2, template literal | 记录拼接结果 |

#### L3 消费层

确认变换后的值最终去向：

- **签名参数**：成为 `x-sign`、`x-token`、`signature` 等字段的组成部分
- **加密输入**：成为 `AES.encrypt`、`crypto.subtle.encrypt` 等的输入
- **哈希输入**：成为 `MD5`、`SHA256` 等的输入
- **WASM 输入**：写入 WASM 内存或作为 WASM export 参数
- **VMP 种子**：决定 VMP 字节码选择/生成
- **控制流**：决定执行哪个分支、调用哪个函数
- **网络字段**：成为请求 URL、header、body、cookie 的一部分

---

## 验证方法

### 方法 1：单点控制变量法

1. 选择一个环境读取点（如 `navigator.userAgent`）
2. 在浏览器中 hook 该读取点，返回一个修改后的值（保持其他环境值不变）
3. 执行目标操作（如点击、提交、刷新）
4. 观察最终输出（签名值、请求参数、响应结果）
5. 记录变化情况

**判定标准：**
- 若输出变化 → 该环境值参与算法运算，标记为 `algorithm-input`
- 若输出不变 → 该环境值可能仅用于检测，标记为 `detection-only`
- 若请求失败 → 该环境值可能是关键输入，需进一步分析

### 方法 2：正交实验法

对多个疑似参与算法的环境值，设计正交实验：

| 实验 | userAgent | platform | screen.width | ... | 输出 |
|------|-----------|----------|--------------|-----|------|
| 1 | 原始 | 原始 | 原始 | ... | 基准 |
| 2 | 修改 | 原始 | 原始 | ... | 对比1 |
| 3 | 原始 | 修改 | 原始 | ... | 对比2 |
| 4 | 原始 | 原始 | 修改 | ... | 对比3 |

通过对比输出差异，建立"环境值 → 输出敏感度"矩阵。

### 方法 3：数据流追踪法

1. 在环境读取点设置断点或 hook
2. 向前追踪该值的所有使用点
3. 标记是否经过变换、是否进入算法函数
4. 建立从读取点到消费点的完整数据流图

**工具建议：**
- 浏览器 DevTools：Scope 面板观察变量流向
- 自定义 hook：`Proxy` 包装环境对象，记录 get/set
- VMP 插桩：在 ENVREAD handler 后追踪寄存器/栈变化

---

## 常见环境值参与算法的模式

### 模式 1：环境值拼接后哈希

```javascript
// 典型模式
const seed = navigator.userAgent + screen.width + screen.height;
const sign = md5(seed + timestamp + nonce);
```

**识别特征：**
- 多个环境值字符串拼接
- 拼接结果进入哈希函数
- 哈希结果作为签名

### 模式 2：环境值作为加密密钥/IV

```javascript
// 典型模式
const key = deriveKey(navigator.platform, navigator.language);
const encrypted = AES.encrypt(data, key);
```

**识别特征：**
- 环境值经过派生/变换后成为 key/iv/salt
- 加密输出在不同环境下不同

### 模式 3：环境值选择算法分支

```javascript
// 典型模式
const algo = navigator.hardwareConcurrency > 4 ? 'complex' : 'simple';
if (algo === 'complex') {
  result = wasm_complex_compute(data);
} else {
  result = simple_compute(data);
}
```

**识别特征：**
- 环境值决定调用哪个函数
- 不同环境下执行路径不同
- 输出格式可能相同但内部算法不同

### 模式 4：环境值作为数组索引

```javascript
// 典型模式
const table = ['a', 'b', 'c', 'd'];
const index = navigator.maxTouchPoints % table.length;
const selected = table[index];
```

**识别特征：**
- 环境值经过取模/截断后作为索引
- 选择不同的常量/函数/字节码

### 模式 5：环境值写入 WASM 内存

```javascript
// 典型模式
const uaBytes = new TextEncoder().encode(navigator.userAgent);
const ptr = wasm.exports.malloc(uaBytes.length);
new Uint8Array(wasm.memory.buffer, ptr, uaBytes.length).set(uaBytes);
const sign = wasm.exports.compute_sign(ptr, uaBytes.length, timestamp);
```

**识别特征：**
- 环境值被编码为字节数组
- 写入 WASM 线性内存
- 调用 WASM export 计算结果

---

## 跨专题联动

环境值作为算法输入的问题，天然跨越多个专题：

| 联动专题 | 联动点 | 分析重点 |
|---------|--------|---------|
| `fingerprint` | 环境读取点识别 | 哪些指纹向量进入算法 |
| `jsvmp` | VMP 中的 ENVREAD handler | VM 如何读取和使用环境值 |
| `wasm` | WASM imports / glue | WASM 如何获取环境值 |
| `signature` | 签名参数来源 | 环境值是否参与签名 |
| `userland-crypto` | 加密输入来源 | 环境值是否参与加密 |
| `env` | 补环境策略 | 需要补哪些环境值才能产生正确输出 |

**工作原则：**
- 不要孤立分析每个专题
- 环境值追踪是跨专题的"横向切面"
- 建立统一的"环境值读取 → 变换 → 消费"追踪表

---

## 交付要求

- `run/env-as-algorithm-input.md`
  - 所有识别到的环境读取点清单
  - 每条读取点的变换链摘要
  - 消费目标分类（sign / crypto / wasm / vm / control-flow / network）
  - 单点/正交验证结果
  - 敏感度矩阵

- `run/env-algorithm-input-map.json`

```json
{
  "envReads": [
    {
      "property": "navigator.userAgent",
      "readPoint": "vm-handler-ENVREAD_NAVIGATOR",
      "readContext": "worker",
      "transformChain": ["split(' ')", "pop()", "hashCode()"],
      "consumeTarget": "sign-field-x-ua-token",
      "consumeType": "sign",
      "sensitivity": "high",
      "swapVerified": true,
      "notes": "修改 userAgent 后签名值变化"
    }
  ],
  "sensitivityMatrix": {
    "navigator.userAgent": {"sign": "high", "crypto": "none", "wasm": "medium"},
    "screen.width": {"sign": "medium", "crypto": "none", "wasm": "none"}
  }
}
```

---

## 常见误区

- **把"检测绕过"当成"算法复现"**：补环境通过指纹检测，不代表算法输出正确
- **忽视弱信号**：环境值只参与了简单的字符串拼接或数组索引，也可能影响最终输出
- **只追踪显式读取**：通过 `Function('return navigator.userAgent')` 等动态代码读取的环境值更难追踪
- **忽略跨上下文**：worker / iframe 中的环境读取可能与主线程不同
- **假设环境值只影响控制流**：即使只影响控制流，不同分支可能调用不同算法，输出仍然不同
- **未验证就假设**：看到环境值被读取就假设它参与算法，必须通过交换验证确认因果关系
