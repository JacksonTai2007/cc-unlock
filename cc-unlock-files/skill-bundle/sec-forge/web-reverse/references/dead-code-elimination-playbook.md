# Dead Code Elimination Playbook

Version: 1

适用场景：目标代码存在死代码注入（Dead Code Injection, DCI），即混淆器插入大量永远不会执行或不影响最终输出的代码片段，以增加分析难度和代码体积。

---

## 1. 识别信号

### 模式1：永不满足的条件

```javascript
if (typeof window === 'undefined') {
    // 这段代码在浏览器中永远不会执行
    var _0xdead = 'trap';
    console.log(_0xdead);
}
```

### 模式2：无副作用的表达式

```javascript
// 计算结果被丢弃
_0xabc + _0xdef * 0x123;
// 自执行但无影响
(function() { return Math.random(); })();
```

### 模式3：不可达代码

```javascript
function _0xfn() {
    return true;
    // 以下代码不可达
    var x = 1;
    console.log(x);
}
```

### 模式4：虚假循环

```javascript
for (var i = 0; i < 0; i++) {
    // 永远不会执行
    _0xtrap();
}
```

### 模式5：与主逻辑无关的IIFE

```javascript
// 主逻辑
var result = compute();

// 死代码IIFE
(function _0xdead() {
    var a = 1, b = 2;
    var c = a + b;
    // c从未被使用
})();
```

---

## 2. 分析策略

### 阶段1：静态可达性分析

```
1. 标记所有入口点（全局代码、导出函数、事件处理器）
2. 从入口点进行DFS/BFS，标记可达代码
3. 未标记的代码块为候选死代码
4. 注意：动态代码（eval/setTimeout）可能引入新的入口点
```

### 阶段2：副作用分析

区分"纯计算"和"有副作用"：

| 有副作用 | 无副作用 |
|---------|---------|
| DOM操作 | 算术运算 |
| 网络请求 | 字符串拼接 |
| 存储读写 | 变量赋值（后续未使用） |
| console输出 | 未使用函数返回值 |
| 抛异常 | 被catch且忽略的异常 |

### 阶段3：条件常量折叠

```javascript
// 原始
if (typeof window !== 'undefined') {
    realLogic();
} else {
    deadLogic();  // 可标记为死代码
}

// 简化
realLogic();
```

---

## 3. 半自动消除方法

> **删除前必须过自校验白名单护栏（见 §3.0）**。obfuscator.io 的 self-defending / debug-protection 大量用"看似无副作用的表达式"做完整性自校验，`typeof window` / `typeof process` / `typeof global` 分支常是**真实环境分叉**（补环境复现时 Node 侧恰恰走 `undefined` 分支）。把它们当死代码删掉 → 还原出的代码静默跑错（不报错、签名错），极难定位。**环境分叉分支不是死代码。**

### 3.0 自校验 / 环境分叉白名单（删除前先排除）

```javascript
// 命中以下任一，禁止当作死代码删除（保守保留）：
function isProtectedFromElimination(node, path) {
  const src = path.getSource();
  // a. 环境探测分叉：typeof window/process/global/document/navigator
  if (/\btypeof\s+(window|process|global|globalThis|document|navigator|self)\b/.test(src)) return true;
  // b. 完整性自校验：Function.prototype.toString / RegExp 检测 / constructor 链
  //    末段匹配 `[native code]` 字面（self-defending 把函数 toString() 出来比对 native 标记的场景）；
  //    不要写回带反斜杠的 `\[native`（匹配不到无反斜杠的真实源码，且早期错形态 `\/\\[native` 字符类未闭合会导致整条正则无法加载）。
  if (/\.toString\s*\(\s*\)|Function\(['"]return|\bconstructor\b.*toString|\[native\s+code\]/.test(src)) return true;
  // c. 反调试：debugger / 计时探测
  if (/\bdebugger\b|performance\.now|Date\.now.*-/.test(src)) return true;
  // d. 表达式的结果被后续语句/条件读取（看似无副作用，实则被依赖）
  //    交给作用域分析：若赋值目标 binding 后续有 referencePaths，则保留
  return false;
}
```

### AST遍历思路（Babel）

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

function eliminateDeadCode(ast) {
    traverse(ast, {
        // 1. 消除永不满足的条件分支
        IfStatement(path) {
            // 护栏：typeof window/process 等环境分叉不是死代码，跳过（补环境 Node 侧可能正走该分支）
            if (isProtectedFromElimination(path.node.test, path.get('test'))) return;
            const test = path.node.test;
            if (isAlwaysTrue(test)) {
                path.replaceWithMultiple(path.node.consequent.body);
            } else if (isAlwaysFalse(test)) {
                if (path.node.alternate) {
                    path.replaceWithMultiple(path.node.alternate.body);
                } else {
                    path.remove();
                }
            }
        },

        // 2. 消除不可达代码
        BlockStatement(path) {
            const body = path.node.body;
            for (let i = 0; i < body.length; i++) {
                if (isTerminator(body[i])) {
                    // return/throw/break 之后的代码不可达
                    path.node.body = body.slice(0, i + 1);
                    break;
                }
            }
        },

        // 3. 消除无副作用的表达式语句
        ExpressionStatement(path) {
            // 护栏：自校验 / 被后续读取的表达式不删（self-defending 常伪装成无副作用表达式）
            if (isProtectedFromElimination(path.node.expression, path)) return;
            // 若该表达式产物（赋值目标）后续仍被引用，保留
            if (t.isAssignmentExpression(path.node.expression)) {
                const left = path.node.expression.left;
                if (t.isIdentifier(left)) {
                    const binding = path.scope.getBinding(left.name);
                    if (binding && binding.referencePaths.length > 0) return;
                }
            }
            if (!hasSideEffect(path.node.expression)) {
                path.remove();
            }
        }
    });
}
```

---

## 4. 交付要求

- `run/dead-code-analysis.md`
- `run/dead-code-eliminated.js`（消除后的代码样本）
- `run/dead-code-stats.json`
  ```json
  {
    "totalLines": 5000,
    "deadLines": 2300,
    "deadRatio": 0.46,
    "categories": {
      "unreachable": 800,
      "noSideEffect": 1200,
      "alwaysFalseCondition": 300
    }
  }
  ```

---

## 5. 常见误区

- 将自校验代码误判为死代码（**最危险**）：obfuscator.io self-defending / debug-protection 用"看似无副作用表达式"自校验，`typeof window/process` 是真实环境分叉而非死代码；照搬 §3 骨架前必须接 §3.0 白名单护栏，否则还原代码静默跑错（不报错、签名错）。§3.0 护栏 b 分支匹配的是 `[native code]` 字面（self-defending 把函数 `toString()` 出来比对 native 标记的场景），维护时不要写回带反斜杠的 `\[native` 形态——既匹配不到无反斜杠的真实源码，错形态还会让整条正则无法加载
- 忽略动态入口点（eval/Function）导致的可达性
- 未考虑时间/随机相关的条件分支
- 将调试代码（console.log）当作死代码（虽然通常无害，但不应在分析阶段删除）
