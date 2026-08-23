# String Array Deobfuscation Playbook

Version: 1

适用场景：目标代码使用字符串数组混淆，典型特征包括：
- 代码顶部有一个大数组，包含大量十六进制或base64编码的字符串
- 有一个解码/解密函数（通常名为 `_0xabc`、`a`、`b`、`_0xde` 等）
- 代码中所有字符串字面量被替换为函数调用，如 `_0xabc(0x12)` 或 `_0xabc(0x12, 'key')`
- 混淆器来源：javascript-obfuscator、obfuscator.io、custom packers
- 常与控制流平坦化、十六进制编码、自防御等组合出现

---

## 0. 自动化优先（先一键，卡住再手写 Babel）

资深做法是**先自动化、还原不彻底再 fallback 手工**，不要一上来就手写 traverse：

1. **首选 `webcrack`**：`npx webcrack <file> -o out/` 一键还原字符串数组 + 轮换 + 解 CFF + 解 packer + 拆模块，obfuscator.io 系基本一把梭。（webcrack 的运行时要求 Node 22/24 与 vm2 禁令/CVE-2026-22709 等打底用法 canonical 在 `closure-extraction-playbook.md` §1，此处不复述。）
2. **备选** `synchrony`（deobfuscator）、`restringer`、`ben-sb` 系工具，覆盖面互补，挑还原最干净的。
3. **仅当自动还原不彻底**（自定义解码器、非标准混淆器、webcrack 误判）才进入下文手写 Babel 流程——下面的手工内容是**兜底**，不是第一步。

> 求值提取出的 decoder 时绝不在主机裸跑 untrusted 代码（不要用 vm2/node:vm），用 isolated-vm 或一次性 Docker，理由与示例见 `deobf.md`。

---

## 1. 识别信号

### 模式1：基础字符串数组

```javascript
var _0x12ab = ['hello', 'world', 'foo', 'bar'];
function _0xcd34(_0x1, _0x2) {
    // 可能包含简单的位移、异或或字符重排
    return _0x12ab[_0x1 - 0x1];
}
_0xcd34(0x1); // 'hello'
```

### 模式2：旋转/位移字符串数组（javascript-obfuscator典型）

```javascript
var _0xabc = ['foo', 'bar', 'hello', 'world'];
(function (_0x1, _0x2) {
    var _0x3 = function (_0x4) {
        while (--_0x4) { _0x1.push(_0x1.shift()); }
    };
    _0x3(++_0x2);
}(_0xabc, 0x123));
// 数组被旋转了0x123次
function _0xdef(_0x1, _0x2) {
    _0x1 = _0x1 - 0x0;
    var _0x3 = _0xabc[_0x1];
    return _0x3;
}
```

### 模式3：带解密的字符串数组

```javascript
var _0xabc = ['\x48\x65\x6c\x6c\x6f', '\x57\x6f\x72\x6c\x64'];
function _0xdef(_0x1, _0x2) {
    _0x1 = _0x1 - 0x100;
    var _0x3 = _0xabc[_0x1];
    // 可能还有额外的base64/hex/rc4解码
    if (typeof _0x3 === 'string') {
        // 解码逻辑
        _0x3 = decode(_0x3);
        _0xabc[_0x1] = _0x3;
    }
    return _0x3;
}
```

### 模式4：分布式数组（分片）

```javascript
// 主数组
var _0xmain = [];
// 多个IIFE填充数组
(function () { _0xmain.push('a', 'b'); })();
(function () { _0xmain.push('c', 'd'); })();
// 可能还有运行时通过网络追加
```

### 模式5：函数参数作为数组（高级）

```javascript
(function (_0xarr) {
    function _0xdec(idx) { return _0xarr[idx]; }
    // 业务代码大量使用 _0xdec(...)
})(['str1', 'str2', 'str3']);
```

---

## 2. 分析策略

### 阶段1：定位数组和decoder

```javascript
// 搜索特征
1. 大数组声明（长度 > 20，元素多为字符串）
2. 数组自执行旋转函数（push/shift 模式）
3. 从数组取值的函数（通常2-3个参数）
4. 该函数在代码中被大量调用（出现次数 > 50）
```

**取证输出**：
- `run/string-array-locations.json`
  ```json
  {
    "arrays": [
      {
        "name": "_0x12ab",
        "location": "line 15, col 0",
        "length": 156,
        "sample": ["\x48\x65\x6c\x6c\x6f", "\x57\x6f\x72\x6c\x64"],
        "decoder": "_0xcd34",
        "callCount": 423
      }
    ]
  }
  ```

### 阶段2：提取decoder函数

必须记录decoder的完整逻辑：

1. **索引变换**：是否有偏移（如 `_0x1 - 0x100`）
2. **旋转操作**：数组是否在运行时旋转
3. **解密逻辑**：
   - 十六进制转义 `\x48` → `H`
   - Unicode转义 `H` → `H`
   - Base64解码 `atob` / `btoa`
   - RC4/AES解密
   - 自定义位运算（异或、移位、字符重排）
4. **缓存机制**：解码结果是否被写回数组（常见优化）

**动态提取策略**：
```javascript
// hook decoder函数，记录所有调用
const origDecoder = _0xcd34;
_0xcd34 = function(_0x1, _0x2) {
    const result = origDecoder.apply(this, arguments);
    console.log(JSON.stringify({
        input: _0x1,
        secondary: _0x2,
        output: result
    }));
    return result;
};
```

### 阶段3：建立完整映射表

目标是获得：`索引 → 明文字符串` 的完整映射。

**静态分析路径**：
- 如果decoder逻辑简单（仅索引偏移），可直接计算
- 如果数组无旋转，直接按索引取值
- 如果有旋转，需计算旋转后的位置

**动态分析路径**（推荐）：
```javascript
// 在页面加载后执行
const mapping = {};
for (let i = 0; i < _0x12ab.length; i++) {
    try {
        mapping[i] = _0xcd34(i);
    } catch(e) {
        mapping[i] = `ERROR: ${e.message}`;
    }
}
console.log(JSON.stringify(mapping, null, 2));
```

**注意**：
- 某些decoder要求正确的secondary参数（解密key）
- 如果索引参数是表达式（如 `_0xcd34(0x1 + _0x2)`），需hook运行时调用

### 阶段4：批量替换

获得映射表后，将所有调用替换为字符串字面量：

```javascript
// 替换前
var msg = _0xcd34(0x12) + _0xcd34(0x13);
_0xobj[_0xcd34(0x14)](_0xcd34(0x15));

// 替换后
var msg = 'Hello' + 'World';
_0xobj['methodName']('argument');
```

**注意事项**：
- 保留原始调用作为注释，便于回溯
- 处理属性访问：`obj[_0xabc(0x1)]` → `obj['key']` → 可进一步简化为 `obj.key`
- 处理方法调用：`obj[_0xabc(0x1)]()` → `obj['method']()` → `obj.method()`

---

## 3. 高级模式

### 模式A：多数组共存

某些混淆器使用多个字符串数组：

```javascript
var _0xarr1 = ['a', 'b'];
var _0xarr2 = ['c', 'd'];
function _0xdec1(idx) { return _0xarr1[idx]; }
function _0xdec2(idx) { return _0xarr2[idx]; }
```

**策略**：分别提取每个数组和decoder，建立多个映射表。

### 模式B：字符串数组 + 控制流平坦化组合

CFF的基本块中使用字符串数组调用。

**策略**：
1. 先还原字符串（让基本块可读）
2. 再分析控制流（见 control-flow-flattening-playbook.md）
3. 或反向：先定位CFF结构，在块内识别字符串调用

### 模式C：自修改数组

数组内容在运行时被修改：

```javascript
var _0xarr = ['encrypted1', 'encrypted2'];
_0xarr[0] = decrypt(_0xarr[0]); // 首次访问时解密并缓存
```

**策略**：
- hook数组的getter/setter
- 或在decoder函数处拦截，记录首次解码结果
- 注意：解密可能依赖运行时状态（时间、随机数、环境值）

### 模式D：死字符串（未使用的数组元素）

混淆器故意在数组中放入大量未使用的字符串，增加噪音。

**策略**：
- 统计decoder函数被调用的所有索引值
- 标记从未被调用的数组元素为"dead strings"
- 在报告中记录死字符串比例（可作为混淆强度指标）

---

## 4. 自动化脚本模板

### 浏览器控制台脚本

```javascript
(function deobfuscateStringArray() {
    // 1. 搜索候选数组
    const candidates = [];
    for (const key of Object.keys(window)) {
        const val = window[key];
        if (Array.isArray(val) && val.length > 20 && val.every(x => typeof x === 'string')) {
            candidates.push({ name: key, length: val.length, sample: val.slice(0, 3) });
        }
    }
    console.log('[StringArray] 候选数组:', candidates);

    // 2. 如果已知数组名和decoder名
    const ARRAY_NAME = '_0x12ab';  // 修改此处
    const DECODER_NAME = '_0xcd34'; // 修改此处

    const arr = window[ARRAY_NAME];
    const decoder = window[DECODER_NAME];

    if (!arr || !decoder) {
        console.error('[StringArray] 未找到数组或decoder');
        return;
    }

    // 3. 建立映射
    const mapping = {};
    for (let i = 0; i < arr.length; i++) {
        try {
            mapping[i] = decoder(i);
        } catch (e) {
            mapping[i] = `<ERROR: ${e.message}>`;
        }
    }

    // 4. 输出
    console.log('[StringArray] 映射表:', JSON.stringify(mapping, null, 2));
    return mapping;
})();
```

### Node.js AST批量替换脚本思路

```javascript
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

function replaceStringCalls(code, decoderName, mapping) {
    const ast = parser.parse(code);
    traverse(ast, {
        CallExpression(path) {
            const { node } = path;
            if (t.isIdentifier(node.callee, { name: decoderName }) &&
                node.arguments.length >= 1 &&
                t.isNumericLiteral(node.arguments[0])) {
                const idx = node.arguments[0].value;
                if (mapping[idx] !== undefined) {
                    path.replaceWith(t.stringLiteral(mapping[idx]));
                }
            }
        }
    });
    // 输出修改后的代码
}
```

---

## 5. 交付要求

命中字符串数组混淆时，至少补充：

- `run/string-array-locations.json`
- `run/string-array-mapping.json`
- `run/string-array-decoder-notes.md`
- `run/string-array-deobfuscated.js`（替换后的代码样本）

报告至少写清：
- 数组数量和长度
- Decoder函数特征（索引偏移、旋转、加密类型）
- 映射表覆盖率（成功还原 / 总调用次数）
- 失败项和原因
- 死字符串比例（如可识别）

---

## 6. 常见误区

- 看到大数组就直接假设所有元素都使用，忽略死字符串
- 忽略decoder的secondary参数，导致解密失败
- 在数组旋转函数执行前就读取数组（得到的是旋转前的值）
- 混淆器可能有多个decoder，只用了一个导致部分字符串未还原
- 忘记处理 `\x` 和 `\u` 转义序列（这些是JS字面量的一部分，不是额外加密）
