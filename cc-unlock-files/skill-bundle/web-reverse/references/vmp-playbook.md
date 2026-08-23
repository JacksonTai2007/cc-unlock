# JS-VMP Playbook

Version: 2

适用场景：目标存在解释器、字节码、dispatcher、handler table、虚拟栈或虚拟寄存器。

如果当前目标还包含“把案例经验沉淀成通用模板 / SOP / checklist / 工具基线”，先补读：

- `references/vm-generic-reverse-template.md`

## 前置分流

进入本 playbook 前，必须先完成 **VM 分流决策**（见 `SKILL.md` 的「VM / WASM / DRM」段）：

- 若分流结论为 `blackbox`：不进入本 playbook，直接走黑盒复用路线
- 若分流结论为 `browser-controlled`：不进入本 playbook，走浏览器内可控复用路线
- 若分流结论为 `deep-analysis`：继续执行以下全部阶段
- 分流判断以 `route-state.json.vmTriage.triageResult` 为准

## 总原则

- 先定 `VM boundary`，再谈 handler 语义
- 先拿运行时轨迹，再做静态提升
- 先确认字节码装载与解码，再尝试反汇编
- 先按 opcode 聚类，再按业务语义命名
- **环境值感知优先**：VM 从浏览器环境读取的值，必须追踪其读取点、变换链和最终去向
- **混合链路优先**：若 VM 与 WASM / 动态代码 / 指纹采集交织，先建立跨边界调用图

---

## 强制分流检查点

每进入下一阶段前，必须书面确认上一阶段的验收条件已满足。不满足时，必须回退到上一阶段或切换为 `blackbox` / `browser-controlled` 路线。

**检查点 1（进入 Trace 前）**：
- [ ] VM boundary 已定位（字节码来源、解码器、dispatcher、VM 状态对象）
- [ ] 若无法定位 boundary，标记 `PARKED` 并回退到 Capture

**检查点 2（进入 Map 前）**：
- [ ] 至少拿到一种轨迹（pc -> opcode 或 opcode -> handler）
- [ ] 若两轮未拿到轨迹，标记 `PARKED` 并切换到 `blackbox` 或 `browser-controlled`

**检查点 3（进入 Lift 前）**：
- [ ] opcode 到 handler 的最小映射已建立
- [ ] 控制流属性（fallthrough / jump / call / return）已分类
- [ ] 若映射覆盖率低于 20%，不得进入 Lift

**检查点 4（进入 Verify 前）**：
- [ ] 至少提升了 PUSH / LOAD / STORE / CALL / JMP / RETURN 中的 3 类
- [ ] 提升后的语义必须与轨迹交叉验证

**任何检查点失败时的默认动作**：
1. 记录失败原因到 `UNKNOWNS`
2. 评估是否满足 `blackbox` 复用条件
3. 评估是否满足 `browser-controlled` 复用条件
4. 若均可行，切换路线并停止深拆
5. 若均不可行，回退到上一阶段重新 probe

---

## 环境值感知：VM 中的浏览器环境读取

现代 JSVMP 越来越频繁地从浏览器环境读取值，这些值可能：

1. **直接影响控制流**：根据 `navigator.userAgent` 长度、`screen.width` 等选择不同执行分支
2. **参与算法运算**：环境值经过位运算、哈希、拼接后进入签名/加密参数
3. **动态字节码生成**：环境值作为种子，生成或选择不同的字节码片段
4. **VM 状态初始化**：环境值决定 VM 寄存器初始值、栈深度或 dispatch 偏移

### 取证要求

在 Trace 阶段，必须同时追踪：

- **env-read 轨迹**：VM 执行过程中读取了哪些 `window / navigator / screen / document` 属性
- **env-transform 轨迹**：读取后的变换链（拼接、哈希、位运算、数组索引）
- **env-consume 轨迹**：变换后的值最终去了哪里（签名参数、WASM 输入、条件跳转、内存写入）

### 识别信号

- handler 中出现 `globalThis[xxx]`、`window[xxx]`、`navigator.xxx` 读取
- opcode 操作数包含动态计算的偏移量，偏移量来源与环境值相关
- 同一段字节码在不同浏览器环境下产生不同输出
- VM 初始化阶段有显著的 "fingerprinting phase"（连续读取大量环境属性）

### 交付要求

`run/vm-env-reads.json` 至少覆盖：

- `readPoints`：环境读取点列表（属性名、读取时机 pc、读取次数）
- `transformChains`：从读取到消费的最小变换链
- `consumeTargets`：消费目标分类（`control-flow` / `algorithm-input` / `bytecode-seed` / `vm-state-init`）
- `swapMatrix`：环境值交换验证结果（替换环境值后输出是否变化）

---

## 动态字节码与嵌套 VM

### 动态字节码

现代 JSVMP 不再是静态装载一次字节码，常见动态行为：

| 动态模式 | 特征 | 捕获策略 |
|---------|------|---------|
| 运行时解密 | 字节码以加密/压缩形式存储，VM constructor 或 dispatch 时逐段解密 | hook constructor 和每次 dispatch 前的 decode 函数 |
| 分段装载 | 初始只有 stub bytecode，执行中通过 `fetch` / `postMessage` / `Function` 加载新段 | 追踪 bytecode carrier 的所有来源 |
| 自修改 | 执行过程中 VM 改写自身 bytecode（如 JMP 目标动态计算后回填） | 比较执行前后的 bytecode hash，标记修改区域 |
| 环境派生 | 字节码生成或选择与环境值绑定（如根据 `userAgent` 选不同 opcode 表） | 多环境对比执行，找出 bytecode 差异点 |

### 嵌套 VM

嵌套 VM 的识别信号：

- 外层 VM 的某个 handler 内部构造新的 VM 实例
- 存在多层 dispatcher（dispatcher 内部调用另一个 dispatcher）
- 字节码中存在 "VM 装载" 语义（如 LOAD_BYTECODE、INIT_VM）
- 调用栈中出现重复的 VM 相关函数名模式

分析策略：

1. 先区分每层 VM 的 boundary（各自独立的 bytecode、dispatcher、state）
2. 追踪层间数据流（外层 VM 如何向内层 VM 传递参数/字节码）
3. 判断哪一层 VM 包含目标算法（通常最内层）
4. 优先分析最内层 VM 的输入输出契约

---

## VMP + WASM 混合链路

当 VM 与 WASM 交织时，分析策略：

1. **先建立混合调用图**：
   - VM dispatch → JS bridge → WASM export → 线性内存 → WASM export 返回 → JS bridge → VM 继续
   - 用 `wasm-jsvmp-bridge-playbook.md` 指导

2. **追踪跨边界参数**：
   - VM 栈/寄存器中的值如何编码为 WASM 输入（指针、长度、数值）
   - WASM 返回值如何解码回 VM 状态

3. **内存观察点**：
   - WASM `memory.buffer` 在 VM 调用前后的变化
   - 特别关注环境值是否被写入 WASM 内存作为算法输入

4. **边界判定**：
   - 如果目标算法主要在 WASM 中，VM 可能只是 glue 层，应优先分析 WASM
   - 如果 WASM 只是辅助（如提供快速哈希），VM 仍承载主逻辑，应优先分析 VM

---

## 建议阶段

### 1. Boundary

先回答五个问题：

- 字节码从哪里来
- 谁负责解码 / 解密 / 解包
- dispatcher 在哪里
- VM 状态对象长什么样
- **VM 是否读取浏览器环境值，读取点在哪里**

### 2. Trace

最小要拿到一种轨迹：

- `pc -> opcode`
- `opcode -> handler`
- `opcode -> stack delta`
- `opcode -> regs read/write`
- **`pc -> env-read -> transform -> consume`**（环境值轨迹）

### 3. Map

建立最小映射：

- opcode 编号
- handler 入口
- 操作数长度
- 控制流属性：fallthrough / jump / call / return
- **env-read 属性：是否读取环境、读取哪个属性**
- 置信度

### 4. Lift

优先提升以下 handler：

- `PUSH / LOAD / STORE`
- `CALL / APPLY / NEW`
- `JMP / JCC / RETURN`
- `GETPROP / SETPROP`
- `EQ / LT / ADD / XOR`
- **ENVREAD / ENVGET / GLOBALGET**（环境读取类）

### 5. Verify

提升后的语义必须和轨迹交叉验证：

- 输入一致
- 中间值一致
- 控制流转移一致
- **环境值替换后输出一致（验证环境依赖）**

---

## VMP 插桩优先位点

1. VM constructor
2. bytecode decode / inflate
3. dispatcher 入口
4. handler 入口
5. stack push / pop
6. regs read / write
7. call bridge
8. return / trap / exception
9. **env-read 拦截点（`globalThis` / `window` / `navigator` property access）**
10. **WASM bridge 点（VM 调用 WASM export 的边界）**

---

## 最低交付

- `run/vm-opcodes.txt` 或等价映射
- `run/vm-trace.jsonl`
- `run/dispatcher-map.md`
- **`run/vm-env-reads.json`**（环境值读取分析）
- 报告中的 `UNKNOWNS`

如果命中动态字节码或嵌套 VM，额外补充：
- `run/vm-bytecode-lifecycle.md`
- `run/vm-nesting-map.md`

如果命中 VMP + WASM 混合，额外补充：
- `run/wasm-jsvmp-bridge.md`
- `run/wasm-imports-exports.json`

---

## 推荐模板

- `references/vm-generic-reverse-template.md`
- `artifacts/tasks/_TEMPLATE/run/vm-trace-template.js`
- `artifacts/tasks/_TEMPLATE/run/vm-env-trace-template.js`
- `artifacts/tasks/_TEMPLATE/run/vm-opcodes.txt`
- `artifacts/tasks/_TEMPLATE/run/vm-trace.jsonl`
- `artifacts/tasks/_TEMPLATE/run/dispatcher-map.md`
- `artifacts/tasks/_TEMPLATE/run/vm-handler-clusters.md`
- `artifacts/tasks/_TEMPLATE/run/vm-env-reads.json`
- `artifacts/tasks/_TEMPLATE/run/vm-bytecode-lifecycle.md`
- `artifacts/tasks/_TEMPLATE/run/vm-nesting-map.md`
- `artifacts/tasks/_TEMPLATE/run/vm-template-profile.json`
- `references/vmp-instrumentation-snippets.md`
- `references/vmp-dynamic-bytecode-playbook.md`
- `references/wasm-jsvmp-bridge-playbook.md`

---

## 禁止事项

- 没有轨迹就硬命名大量 opcode
- 把单次命中的 handler 当成完整语义
- 只因为函数名像 VM 就直接下 T4 结论
- 未确认字节码边界就开始写伪反编译器
- **忽略 VM 中的环境读取，只关注 opcode 语义**
- **未验证环境值影响就声称"纯算法提取完成"**
- 未确认动态字节码就假设 bytecode 是静态的
