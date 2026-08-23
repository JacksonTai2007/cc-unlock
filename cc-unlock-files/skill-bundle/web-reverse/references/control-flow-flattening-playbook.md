# Control Flow Flattening Deobfuscation Playbook

Version: 1

适用场景：目标代码存在控制流平坦化（Control Flow Flattening, CFF）结构，典型特征包括：
- 大量 `switch` 或 `if-else` 链，由单个状态变量（dispatcher var）驱动
- 原始函数被拆分为基本块（basic blocks），通过 `while (true)` 或 `for (;;)` 循环调度
- 每个基本块末尾修改状态变量，控制下一个执行的块
- 状态变量常被称为 `state`、`step`、`_0x1`、`$`、`control` 等
- 混淆器来源：javascript-obfuscator、obfuscator.io、自定义混淆工具

---

## 0. 自动化优先（先一键，卡住再手写 Babel）

CFF 还原先走自动化，不要默认手写 traverse：

1. **首选 `webcrack`**：`npx webcrack <file> -o out/` 对 obfuscator.io 系的 `while(true)+switch(state)` 平坦化通常能直接线性化还原。
2. **备选** `synchrony`、`restringer`，挑还原最干净的。
3. **仅当自动还原不彻底**（自定义 dispatcher、状态机非标准、含反求值自防御）才进入下文手写 Babel 重排——下面的手工内容是**兜底**，不是第一步。

---

## 1. 识别信号

### 强信号（几乎确认存在CFF）

```javascript
// 模式A: while(true) + switch(state)
var _0x1 = 0x0;
while (!![]) {
    switch (_0x1) {
        case 0x0:
            // block A
            _0x1 = 0x1;
            break;
        case 0x1:
            // block B
            _0x1 = 0x3;
            break;
        // ...
    }
}

// 模式B: 数组调度器
var _0xabc = ['blockA', 'blockB', 'blockC'];
var _0xidx = 0;
while (_0xidx < _0xabc.length) {
    var _0xfn = _0xfunctions[_0xabc[_0xidx]];
    _0xidx = _0xfn();
}

// 模式C: 分布式dispatch（状态变量分散在多个闭包）
function _0xmain() {
    var _0xstate = { pc: 0, stack: [] };
    _0xstep1(_0xstate);
}
function _0xstep1(_0xstate) {
    // ...
    _0xstate.pc = 2;
    _0xstep2(_0xstate);
}
```

### 辅助信号

- 同一函数内出现 `while(!![])`、`while(true)`、`for(;;)` 作为最外层循环
- 变量在 `switch` 的 `case` 末尾被重新赋值，且赋值后立即 `break`
- `switch` 的 `case` 编号不连续或呈十六进制形式
- 函数体异常冗长，但每个 `case` 块只有2-5行
- 存在 `continue` 或 `break` 到外层循环，但循环条件永真

---

## 2. 分析策略

### 阶段1：定位Dispatcher

找到控制流分发的核心结构：

1. **识别状态变量**：追踪在循环头部被读取、在每个分支末尾被写入的变量
2. **识别调度结构**：`switch(var)`、`if-else if` 链、数组索引调用、对象方法映射
3. **识别基本块边界**：每个 `case` 或 `if` 分支对应一个原始基本块
4. **记录入口点**：哪个 `case` 是函数的第一条执行语句

**取证输出**：
- `run/cff-dispatcher-var.md`：状态变量名、类型、初始值
- `run/cff-block-map.json`：case编号 → 基本块内容映射

### 阶段2：构建控制流图（CFG）

将平坦化结构还原为控制流图：

```
每个基本块 = 节点
状态变量赋值 = 边（case X → case Y）
条件分支 = 多条边（根据条件走向不同case）
```

**关键操作**：
- 提取每个case中的**最后一条赋值语句**（通常是 `_0x1 = 0x3;`）
- 区分无条件跳转（固定赋值）和条件跳转（三元运算或if分支赋值）
- 识别循环回边（某个case的跳转目标在控制流中形成环）
- 识别函数出口（`return`、`throw`、或跳出外层循环的 `break`）

**取证输出**：
- `run/cff-cfg.json`：节点和边的图结构
- `run/cff-jump-table.md`：case编号 → 目标case编号的跳转表

### 阶段3：语义块聚类

将基本块按语义聚类：

| 块类型 | 特征 | 处理策略 |
|--------|------|---------|
| 顺序块 | 无条件跳转到下一个逻辑块 | 合并到线性序列 |
| 条件头 | 包含条件判断，决定分支走向 | 还原为 `if/else` |
| 循环头 | 跳转目标在自身之前（回边） | 还原为 `while/for` |
| 循环尾 | 跳转回循环头 | 标记为循环体结束 |
| try块 | 包含异常处理逻辑 | 还原为 `try/catch/finally` |
| return块 | 包含 `return` 或 `throw` | 标记为终止节点 |

**识别循环的技巧**：
- 使用DFS检测回边（back edge）
- 回边的目标节点是循环头
- 从循环头可达、且能回到循环头的所有节点构成循环体

### 阶段4：结构还原

按优先级还原：

1. **内层循环优先**：先还原最内层的 `while/for`，再处理外层
2. **条件分支次之**：将 `switch-case` 调度还原为 `if-else` 或 `switch`
3. **顺序块合并**：将线性执行的块合并为连续代码
4. **去除死代码**：标记不可达case（从入口无法到达的节点）。**注意**：删除前过 `dead-code-elimination-playbook.md` §3.0 自校验白名单护栏——`typeof window/process` 环境分叉、self-defending 自校验不是死代码，误删会让还原代码静默跑错。

**还原示例**：

```javascript
// 原始平坦化代码
var _0x1 = 0;
while (!![]) {
    switch (_0x1) {
        case 0:
            var a = 1;
            _0x1 = 1;
            break;
        case 1:
            if (a > 10) { _0x1 = 3; }
            else { _0x1 = 2; }
            break;
        case 2:
            a++;
            _0x1 = 1;  // 回边 → 循环
            break;
        case 3:
            return a;
    }
}

// 还原后
var a = 1;
while (a <= 10) {
    a++;
}
return a;
```

---

## 3. 高级模式

### 模式1：嵌套CFF

多个函数各自有独立的dispatcher，或者一个CFF函数内部调用另一个CFF函数。

**策略**：
- 先分别还原每个函数的CFG
- 再处理函数间调用关系
- 注意内层函数的返回值可能被外层用作状态跳转条件

### 模式2：状态变量加密

状态变量不是直接的整数，而是经过简单运算：

```javascript
var _0xstate = _0xdecode(0x12);  // 初始值加密
// ...
_0xstate = _0xdecode(_0xstate + 0x1);  // 跳转值加密
```

**策略**：
- hook `_0xdecode` 函数，记录输入输出映射
- 建立加密case编号 → 真实case编号的映射表
- 或者直接动态执行收集所有状态转换

### 模式3：概率/随机调度

某些case的跳转依赖随机数：

```javascript
case 0x5:
    _0xstate = Math.random() > 0.5 ? 0x6 : 0x7;
    break;
```

**策略**：
- 识别随机/时间相关的跳转条件
- 这类分支可能需要保守处理（保留条件结构）
- 记录所有可能的分支目标

### 模式4：与字符串数组混淆结合

CFF的基本块中大量调用字符串解密函数。

**策略**：
- 先还原字符串（见 `string-array-deobfuscation-playbook.md`）
- 再处理控制流（语义更清楚）
- 或并行处理：在构建CFG时同时记录字符串引用

---

## 4. 工具辅助

### 半自动还原脚本思路

```javascript
// 1. 提取所有基本块
function extractBlocks(switchNode) {
    const blocks = {};
    for (const case_ of switchNode.cases) {
        const caseValue = case_.test.value;
        blocks[caseValue] = {
            body: case_.consequent,
            exit: extractExitAssignment(case_.consequent)
        };
    }
    return blocks;
}

// 2. 提取跳转目标
function extractExitAssignment(body) {
    // 找最后一条对状态变量的赋值
    for (let i = body.length - 1; i >= 0; i--) {
        if (isStateAssignment(body[i])) {
            return evaluateAssignment(body[i]);
        }
    }
    return null; // 可能包含return/throw/break
}

// 3. 构建图并检测循环
function buildCFG(blocks, entryCase) {
    const graph = new DiGraph();
    for (const [caseValue, block] of Object.entries(blocks)) {
        graph.addNode(caseValue, block);
        if (block.exit && block.exit.type === 'jump') {
            graph.addEdge(caseValue, block.exit.target);
        }
    }
    // 使用Tarjan算法检测强连通分量（循环）
    return detectLoops(graph);
}
```

### 推荐AST工具

- `@babel/parser` + `@babel/traverse` + `@babel/types`：JS AST操作
- `recast`：保留代码格式的同时修改AST
- `acorn`：轻量级解析器，适合快速分析

---

## 5. 交付要求

命中控制流平坦化时，至少补充：

- `run/cff-dispatcher-var.md`
- `run/cff-block-map.json`
- `run/cff-cfg.json`
- `run/cff-jump-table.md`
- `run/cff-deobfuscated.js`（还原后的近似代码，即使不完全正确也要记录）
- `report.md` 中的 `控制流平坦化状态`

报告至少写清：
- 调度器类型（switch/if/array/object）
- 状态变量特征
- 基本块数量
- 识别出的循环数量和嵌套深度
- 条件分支数量
- 不可达块数量
- 还原置信度（高/中/低）
- 未解决模式（如加密状态值、随机跳转）

---

## 6. 禁止事项

- 没有构建跳转表就手动"猜"代码逻辑
- 忽略回边导致循环结构丢失
- 将条件跳转错误还原为顺序执行
- 在字符串数组未还原前就声称"已完成CFF还原"
- 对概率/随机调度不做标记直接线性化
