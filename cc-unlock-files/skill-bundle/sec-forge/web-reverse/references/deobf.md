# 反混淆与解包（T1–T3）

说明：

- 本页是战术级技巧补充，不等于对应专题已经进入 `closed-loop` 或 `synthetic-e2e`
- 真正的专题成熟度口径以 `docs/reference/capability-matrix.md` 为准
- 如果任务已经命中 `dynamic-code`、`jsvmp` 或相关专题，优先按对应 playbook 和 task artifact 要求组织证据

使用场景：识别 ob-fuscator.io、字符串数组加密、CFG扁平化、eval-pack/JSFuck/JJencode/aaencode 等。

## T1 变量重命名 / 死代码

```bash
# Prettier美化
npx prettier --parser babel --print-width 120 obfuscated.js > pretty.js

# js-beautify
js-beautify -n obfuscated.js -o pretty.js
```

```javascript
// Babel AST重命名hex标识符
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const fs = require('fs');

const code = fs.readFileSync('pretty.js', 'utf8');
const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
let counter = 0;
const nameMap = {};

traverse(ast, {
  Identifier(path) {
    const n = path.node.name;
    if (/^_0x[0-9a-f]+$/i.test(n)) {
      if (!nameMap[n]) nameMap[n] = 'v' + (counter++);
      path.node.name = nameMap[n];
    }
  }
});
fs.writeFileSync('renamed.js', generate(ast).code);
```

## T2 ob-fuscator.io / 字符串数组加密 / CFG扁平化

**指纹特征：**
- 顶部大型字符串数组：`var _0x1a2b = ['encStr1', ...]`
- 轮换函数：`_0x1a2b.push(_0x1a2b.shift())`
- 解码器：`function _0x3c4d(index, key) { ... }`
- CFG扁平化：`while(true){switch(state){...}}`

**字符串数组解码（求值优先级：先自动化，必须自跑再用隔离沙箱）：**

1. **首选 `webcrack`** 直接一把梭：`npx webcrack obfuscated.js -o out/` 通常能一键还原 obfuscator.io 系的字符串数组 + 轮换 + CFF + 解 packer，还原不彻底再手工。
2. **必须自跑 decoder 求值时，绝不在分析主机裸跑 untrusted 代码**：用 `isolated-vm`（V8 Isolate，真隔离）或一次性 Docker 容器执行提取出的 decoder。

> **禁止事项**：不要用 `vm2` / `node:vm` 执行目标站的 decoder / eval-pack。`vm2` 已于 2023 停维护，2026-01 爆 `CVE-2026-22709`（CVSS 9.8，Promise handler 沙箱逃逸）；`node:vm` 本就不是安全边界。逆向场景把目标站恶意/混淆代码丢进它们求值 = 分析机被 RCE 的直接攻击面。

```javascript
// 必须自跑 decoder 时：isolated-vm（V8 Isolate，真隔离），而非 vm2/node:vm
const ivm = require('isolated-vm');
const decoderSrc = require('fs').readFileSync('decoder_extracted.js', 'utf8');
const isolate = new ivm.Isolate({ memoryLimit: 128 });
const context = isolate.createContextSync();
context.evalSync(decoderSrc); // 仅在隔离 Isolate 内，无 Node API 暴露
const decodeRef = context.global.getSync('_0x3c4d', { reference: true });
const decode = (idx, key) => decodeRef.applySync(undefined, [idx, key], { result: { copy: true } });

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const fs = require('fs');

const code = fs.readFileSync('obfuscated.js', 'utf8');
const ast = parser.parse(code);

traverse(ast, {
  CallExpression(path) {
    const { callee, arguments: args } = path.node;
    if (callee.name && /^_0x[0-9a-f]+$/i.test(callee.name) && args.length >= 1) {
      try {
        const idx = args[0].value;
        const key = args[1] ? args[1].value : undefined;
        const result = decode(idx, key);
        if (typeof result === 'string') path.replaceWith({ type: 'StringLiteral', value: result });
      } catch (e) {}
    }
  }
});
fs.writeFileSync('deobf_strings.js', generate(ast).code);
```

**CFG扁平化线性化（思路）：**
- 找到 `order = '3|1|0|2'.split('|')` 这类序列
- 按序列排列 `switch` 的 `case` 体
- 用线性 `BlockStatement` 替换 `while+switch`

## T3 eval-packing / JSFuck / JJencode / aaencode

**eval pack 解包（捕获而不执行）：**
```javascript
const _eval = window.eval;
window.eval = function(src) {
  console.log('[eval captured] length:', src.length);
  console.log(src.slice(0, 2000));
  return undefined; // 如可疑则阻止执行
};
```

**离线解包（不执行原始 payload，只把 eval 替换成打印）：**
```javascript
// 安全做法：把 eval 改成 console.log，让 packer 自己吐出解包后的源码而不真正执行
const packedSrc = require('fs').readFileSync('packed.js', 'utf8');
const unpacked = packedSrc.replace(/\beval\b/, 'console.log');
// 仍需在 isolated-vm / 一次性 Docker 内运行，不要用 require('vm').runInNewContext 在主机裸跑——
// 同样是 untrusted 代码执行面（理由见上文 vm2 禁止事项）。
const ivm = require('isolated-vm');
const isolate = new ivm.Isolate({ memoryLimit: 128 });
const context = isolate.createContextSync();
const jail = context.global;
jail.setSync('log', new ivm.Reference((s) => console.log(String(s).slice(0, 2000))));
context.evalSync('var console = { log: (...a) => log.applySync(undefined, a.map(String)) };');
context.evalSync(unpacked);
```

## T4 webpack/browserify bundle 拆包（扣代码打底）

> webcrack 扣代码打底用法（`npx webcrack bundle.js -o out/` 一键 unbundle + Node 22/24 运行时要求 + vm2 禁令/CVE-2026-22709）的 canonical 在 `closure-extraction-playbook.md` §1；拆出模块后的「抽依赖闭包 → 搭最小 require shim → Node 单跑 → 交棒补环境」完整链路同见该页。本节只列 deobf 工具优先级。

**常用工具（优先顺序）：**
- `webcrack`（解混淆 **+ webpack/browserify unbundle 拆包**，扣代码首选；需 Node 22/24）
- synchrony (deobfuscator)
- restringer
- js-deobfuscator
- ast-deobfuscator

