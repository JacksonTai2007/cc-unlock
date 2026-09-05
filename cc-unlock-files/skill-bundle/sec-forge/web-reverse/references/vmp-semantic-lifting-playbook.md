# JS-VMP Semantic Lifting Playbook

Version: 1

适用场景：已完成VMP的边界定位、trace采集和opcode映射（见 `vmp-playbook.md`），需要将低层opcode序列提升回可理解的高层语义（近似JavaScript代码或算法描述），以支持：
- 理解核心算法逻辑（签名、加密、哈希）
- 识别算法模式（AES、HMAC、SHA、RSA等）
- 提取可迁移到Python/Node的纯算法边界
- 验证黑盒复用的正确性

---

## 1. 前置条件

进入本playbook前，必须满足：
- [ ] VM boundary 已确认（`vmp-playbook.md` Boundary阶段完成）
- [ ] Trace已采集（至少包含 `pc → opcode → handler → stack delta`）
- [ ] Opcode到handler的映射已建立（覆盖率 > 20%）
- [ ] 控制流属性已分类（fallthrough / jump / call / return）
- [ ] 环境值读取点已标记（`vmp-playbook.md` 环境值感知章节）

**不满足以上条件时，回退到 `vmp-playbook.md`。**

---

## 2. 语义提升五阶段

### 阶段1：Opcode模式识别（Pattern Recognition）

在原始trace中识别常见计算模式：

#### 模式A：常量加载序列
```
PUSH_CONST 0x10001
PUSH_CONST 0x89ABCDEF
XOR
```
→ 语义：`0x10001 ^ 0x89ABCDEF`

#### 模式B：内存访问模式
```
PUSH_LOCAL 0x2      ; 加载基地址
PUSH_CONST 0x4      ; 偏移
ADD                 ; 地址计算
LOAD                ; 取值
```
→ 语义：`memory[local_2 + 4]`

#### 模式C：函数调用序规约
```
PUSH_GLOBAL "CryptoJS"
GETPROP "AES"
PUSH_LOCAL 0x1      ; 明文
PUSH_LOCAL 0x2      ; key
PUSH_LOCAL 0x3      ; iv
CALL 3              ; 3个参数
```
→ 语义：`CryptoJS.AES.encrypt(local_1, local_2, {iv: local_3})`

#### 模式D：循环骨架
```
LABEL_0x10:
  PUSH_LOCAL 0x0    ; 循环变量
  PUSH_CONST 0x10   ; 上限
  LT
  JCC LABEL_0x50    ; 条件不满足则跳出
  ; 循环体 ...
  PUSH_LOCAL 0x0
  PUSH_CONST 0x1
  ADD
  STORE_LOCAL 0x0   ; i++
  JMP LABEL_0x10    ; 回边
LABEL_0x50:
```
→ 语义：`for (let i = 0; i < 0x10; i++) { ... }`

#### 模式E：条件分支
```
  PUSH_LOCAL 0x1
  PUSH_CONST 0x0
  EQ
  JCC LABEL_ELSE
  ; then块 ...
  JMP LABEL_END
LABEL_ELSE:
  ; else块 ...
LABEL_END:
```
→ 语义：`if (local_1 === 0) { ... } else { ... }`

**交付物**：`run/vmp-opcode-patterns.json`

---

### 阶段2：数据流分析（Data Flow Analysis）

追踪值在VM内部的流动：

#### 定义-使用链（Def-Use Chain）
```
对于每个寄存器/栈位置/局部变量：
  1. 记录定义点（哪个opcode写入值）
  2. 记录使用点（哪些opcode读取该值）
  3. 建立 def → use 的链
```

**示例**：
```
pc=0x10: PUSH_CONST 0x5A827999  → def R0
pc=0x12: PUSH_LOCAL 0x3           → def R1
pc=0x14: ADD                       → use R0, R1; def R2
pc=0x16: PUSH_LOCAL 0x4           → def R3
pc=0x18: ADD                       → use R2, R3; def R4
```
链：`0x5A827999 → ADD@0x14 → ADD@0x18`

#### 常量传播（Constant Propagation）
- 如果某个值在定义时是常量，且在使用前未被修改，可将其替换为常量
- 这是识别"魔数"（magic numbers）的关键步骤

#### 常见密码学魔数
| 魔数 | 算法 |
|------|------|
| `0x5A827999` | SHA-1 常量 K0 |
| `0x6ED9EBA1` | SHA-1 常量 K1 |
| `0x8F1BBCDC` | SHA-1 常量 K2 |
| `0xCA62C1D6` | SHA-1 常量 K3 |
| `0x67452301` | MD5/SHA 初始状态 H0 |
| `0xEFCDAB89` | MD5/SHA 初始状态 H1 |
| `0x636F6E74` | "cont"（可能来自"continue"） |
| `0x5C5C5C5C` | HMAC ipad/opad 相关 |

**交付物**：`run/vmp-dataflow-analysis.json`

---

### 阶段3：算法模式匹配（Algorithm Pattern Matching）

在提升后的语义中识别标准算法：

#### SHA-256 特征
```
1. 初始化8个32位状态变量（0x6a09e667, 0xbb67ae85, ...）
2. 64轮压缩，每轮使用不同的常量K[0..63]
3. 操作序列：S0, S1, Ch, Maj, Σ0, Σ1
4. 位运算主导：ROTR, SHR, AND, XOR, NOT, ADD
```

#### AES 特征
```
1. 4x4状态矩阵操作
2. SubBytes / ShiftRows / MixColumns / AddRoundKey
3. 轮密钥扩展（KeySchedule）
4. 查找表特征：256字节的S-box和InvS-box
```

#### HMAC 特征
```
1. 两个密钥派生步骤：ipad = key XOR 0x36, opad = key XOR 0x5C
2. 两次哈希调用：H(K XOR ipad || message) → inner
3. 最终：H(K XOR opad || inner)
```

**匹配策略**：
- 先匹配常量表（查找预定义魔数）
- 再匹配操作序列（轮函数结构）
- 最后验证输入输出边界

**交付物**：`run/vmp-algorithm-identification.md`

---

### 阶段4：控制流重建（Control Flow Reconstruction）

将VM的goto-based控制流还原为结构化控制流：

```
VM控制流：              重建后：
JMP A                   while (cond) {
A: JCC B      →→→         ...
  ...                     if (inner) break;
  JMP A                   ...
B: ...                  }
```

#### 结构化算法
1. **检测循环**：寻找回边（back edge），即跳转目标在当前位置之前的边
2. **检测条件**：寻找双向分支（一个条件跳转到X，另一个fallthrough到Y）
3. **检测switch**：寻找多路分发（一个值对应多个跳转目标）
4. **处理异常**：寻找try/catch/finally的异常处理框架

**交付物**：`run/vmp-reconstructed-cfg.json`

---

### 阶段5：高层语义输出（High-Level Semantic Output）

最终输出形式（选择一种或多种）：

#### 形式A：伪JavaScript
```javascript
function vm_lifted_sign(data, timestamp, nonce) {
  const key = deriveKey(sessionSeed, timestamp);
  const payload = canonicalize(data);
  const inner = HMAC_SHA256(key, payload + nonce);
  return base64url(inner.slice(0, 16));
}
```

#### 形式B：算法流程图
```
输入: data, timestamp, nonce
  │
  ▼
┌─────────────────┐
│ deriveKey()     │ ← 使用 sessionSeed + timestamp
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ canonicalize()  │ ← 排序 + 编码
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ HMAC-SHA256     │ ← key, payload+nonce
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ base64url       │ ← 取前16字节
└────────┬────────┘
         │
         ▼
输出: signature
```

#### 形式C：纯算法边界（用于迁移）
```json
{
  "algorithm": "HMAC-SHA256-truncated",
  "inputs": ["data", "timestamp", "nonce", "sessionSeed"],
  "steps": [
    {"op": "deriveKey", "args": ["sessionSeed", "timestamp"], "output": "key"},
    {"op": "canonicalize", "args": ["data"], "output": "payload"},
    {"op": "hmac_sha256", "args": ["key", "concat(payload, nonce)"], "output": "inner"},
    {"op": "slice", "args": ["inner", 0, 16], "output": "truncated"},
    {"op": "base64url", "args": ["truncated"], "output": "signature"}
  ]
}
```

**交付物**：`run/vmp-lifted-semantics.js` 或 `run/vmp-lifted-algorithm.json`

---

## 3. 符号执行思路（Symbolic Execution）

对于复杂条件分支和状态依赖，使用符号执行辅助分析：

### 基本思路
```
将VM寄存器/内存标记为符号变量（而非具体值）
执行每条opcode时，维护符号表达式
遇到条件分支时，记录路径约束
遇到输出时，建立"输入符号 → 输出表达式"的映射
```

### 简化版实现策略
```javascript
// 符号值
class SymValue {
  constructor(expr, constraints = []) {
    this.expr = expr;        // 如 "x ^ 0x5A827999"
    this.constraints = constraints;
  }
}

// 在trace上模拟执行
function symbolicExecute(trace) {
  const state = new Map();   // 寄存器 → 符号值
  const outputs = [];
  
  for (const step of trace) {
    switch (step.opcode) {
      case 'PUSH_CONST':
        state.push(new SymValue(String(step.operand)));
        break;
      case 'PUSH_LOCAL':
        state.push(state.getLocal(step.operand));
        break;
      case 'XOR': {
        const b = state.pop();
        const a = state.pop();
        state.push(new SymValue(`(${a.expr} ^ ${b.expr})`));
        break;
      }
      // ... 其他opcode
    }
  }
  return state.peek();
}
```

### 应用场景
- **输入边界识别**：哪些输入影响输出
- **常量推导**：输出中的某部分是否纯由常量计算
- **分支条件分析**：某个分支是否需要特定输入值

**注意**：完整符号执行引擎复杂，本playbook建议仅在必要时使用简化版本，优先依赖模式识别和数据流分析。复杂分支无法靠模式识别拆开时，可接入现成符号执行 / 约束求解（如 angr、Triton、z3）辅助，但仍保持「优先模式识别 + 数据流，符号执行只作复杂分支兜底」的优先级，不要一上来就上 SMT。

---

## 4. 验证要求

语义提升完成后，必须通过以下验证：

1. **输入输出一致性**：用相同的输入运行原始VM和提升后的语义，输出必须一致（至少5组样本）
2. **边界等价性**：提升后的算法边界（输入/输出/状态依赖）与原始VM一致
3. **环境值依赖验证**：修改环境值后，提升后的语义和原始VM的变化方向一致
4. **控制流覆盖**：至少覆盖trace中80%的opcode执行路径

**未通过验证时**：
- 标记不一致点为 `UNKNOWNS`
- 检查是否是动态字节码导致trace不完整
- 必要时回退到更详细的trace采集

---

## 5. 交付汇总

语义提升专题的完整交付物：

- `run/vmp-opcode-patterns.json` — 识别的opcode模式
- `run/vmp-dataflow-analysis.json` — 数据流分析结果
- `run/vmp-algorithm-identification.md` — 算法识别结论
- `run/vmp-reconstructed-cfg.json` — 重建的控制流图
- `run/vmp-lifted-semantics.js` — 提升后的伪代码
- `run/vmp-lifted-algorithm.json` — 纯算法边界描述
- `run/vmp-semantic-verification.md` — 验证结果和偏差记录

---

## 6. 禁止事项

- 没有trace证据就猜测opcode语义
- 将部分匹配的算法模式当成确认结论（必须验证）
- 忽略环境值对语义的影响
- 在控制流未重建时就输出"伪代码"
- 将"看起来像AES"当成"确认是AES"（必须验证S-box和轮数）
- 未验证就声称"可纯算法迁移"
