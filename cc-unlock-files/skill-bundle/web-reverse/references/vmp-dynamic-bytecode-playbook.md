# VMP Dynamic Bytecode Playbook

Version: 1

适用场景：VMP 字节码不是静态装载，而是在运行时解密、解包、分段装载、自修改或根据环境值动态生成。

## 核心定位

动态字节码不是"另一种混淆"，而是直接影响分析策略的关键特征：

- 静态分析工具（如简单的字节码解析器）会失效
- 插桩必须覆盖字节码生命周期全程
- 环境值可能参与字节码生成/选择

---

## 动态字节码模式识别

### 模式 1：装载时解密

**特征：**
- 字节码以 base64 / hex / 自定义编码存储
- VM constructor 或首次 dispatch 前执行 decode
- decode 函数通常紧邻 VM constructor

**捕获策略：**
1. hook VM constructor，记录原始 bytecode 的 length / hash
2. hook decode 函数入口和出口，对比前后
3. 若 decode 是异步的（Promise / callback），追踪 resolve 值

### 模式 2：运行时逐段解密

**特征：**
- 初始装载的 bytecode 不完整或加密
- dispatch 过程中根据需要解密下一段
- 常见于大体积 bytecode，为了减小初始下载

**捕获策略：**
1. 在 dispatcher 入口 hook，记录每次 dispatch 前的 pc 和 bytecode 状态
2. 比较相邻两次 dispatch 的 bytecode hash，识别修改区域
3. 追踪"解密触发条件"（特定 opcode、特定 pc 范围、特定调用栈）

### 模式 3：环境派生 bytecode

**特征：**
- 不同浏览器环境下，VM 执行不同的 bytecode
- 环境值作为种子，选择 opcode 表或生成 bytecode
- 与指纹采集紧密关联

**捕获策略：**
1. 同一页面，用两种不同环境（如正常浏览器 vs 无头浏览器）分别捕获完整 bytecode
2. 对比 bytecode 差异
3. 追踪"环境读取 → 变换 → bytecode 选择/生成"的完整链
4. 用最小环境交换矩阵确认因果：改变哪个环境值会导致 bytecode 变化

### 模式 4：自修改 bytecode

**特征：**
- VM 执行过程中改写自身 bytecode
- 常见形式：JMP 目标动态计算后回填、CALL 目标运行时解析
- 与 JIT 类似但发生在解释器层面

**捕获策略：**
1. 周期性（如每 1000 条 opcode）计算 bytecode 区域 hash
2. 标记 hash 变化的时间点和 pc 位置
3. 定位触发修改的 handler（通常是 SETPROP 或内存写入类）
4. 区分"预期内的元数据更新"和"业务逻辑相关的 bytecode 修改"

### 模式 5：嵌套 VM 装载

**特征：**
- 外层 VM 的某个 handler 负责装载内层 VM 的 bytecode
- 可能存在多层嵌套

**捕获策略：**
1. 识别 VM constructor 的所有调用点
2. 若 constructor 在 VM dispatch 过程中被调用，标记为嵌套
3. 为每层 VM 建立独立的 bytecode 生命周期追踪
4. 优先分析最内层 VM（通常包含目标算法）

---

## 环境值与动态字节码的关联

这是最需要关注的交叉领域：

| 关联方式 | 识别信号 | 取证重点 |
|---------|---------|---------|
| 环境值选择 opcode 表 | 不同环境下载不同的 opcode map 文件 | 追踪 opcode map 的请求触发条件和参数 |
| 环境值派生 bytecode 种子 | VM init 阶段大量读取环境值后生成数组 | 捕获种子生成函数和 bytecode 生成函数 |
| 环境值决定 dispatch 偏移 | dispatcher 中使用环境值计算跳转索引 | hook dispatcher，记录环境值与 dispatch 目标的映射 |
| 环境值嵌入 bytecode 常量 | bytecode 中包含环境相关字符串/数值 | 静态扫描 bytecode 中的可疑常量，验证是否来自环境 |

---

## 取证与交付

### 动态字节码捕获清单

- [ ] 原始 bytecode carrier（加密/压缩/编码前）
- [ ] decode 函数位置与算法摘要
- [ ] decode 前后对比（至少一个样本）
- [ ] 若存在分段装载：每段的触发条件和边界
- [ ] 若存在自修改：修改点、触发条件、修改前后的差异
- [ ] 若存在环境派生：环境值 → 变换 → bytecode 差异的完整证据链
- [ ] 若存在嵌套：每层 VM 的独立 boundary 和 bytecode 来源

### 交付物

- `run/vm-bytecode-lifecycle.md`
  - `carrierType`：inline / fetch / postMessage / Function / WASM memory
  - `decodeChain`：解码链各环节
  - `dynamicPatterns`：命中哪些动态模式
  - `envDependency`：是否依赖环境值
  - `segmentMap`：分段装载映射（若有）
  - `selfModifyLog`：自修改日志（若有）

- `run/vm-nesting-map.md`（若命中嵌套）
  - 每层 VM 的层级、boundary、bytecode 来源、与外层的数据流

---

## 常见误区

- 看到 bytecode 是数组就假设是静态的，未检查是否在运行时被修改
- 只抓一次 bytecode 就认为完整，未验证不同环境下的 bytecode 是否一致
- 把自修改当成"混淆手段"去研究，而忽略了它只是实现动态跳转的技术
- 未区分"VM 本身的 bytecode"和"VM 动态生成的代码（如通过 Function 构造）"
