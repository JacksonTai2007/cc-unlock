#!/usr/bin/env node
/**
 * jsvmp-instrument.cjs — JSVMP 解释器自动插桩
 *
 * 在 VM 主循环的 switch/case 分发处自动注入 opcode 日志，
 * 输出插桩后的代码 + 一个日志收集器。运行插桩后的代码即可
 * 得到完整 opcode 执行序列，用于分析操作码语义。
 *
 * 依赖：cd scripts && npm i  （@babel/parser @babel/traverse @babel/generator @babel/types）
 *
 * 用法：
 *   node scripts/vm/jsvmp-instrument.cjs vm.js instrumented.js
 *   # 然后在浏览器/Node 运行 instrumented.js，读取 window.__VMLOG / global.__VMLOG
 *
 * 策略：定位最大的 while(true){ switch(...) } 结构，
 *       在 switch 语句前插入 __vmlog(disc) 记录分发值。
 * 配套方法论：references/vmp-playbook.md、references/vmp-instrumentation-snippets.md。
 */
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const LOGGER = `
(function(g){
  g.__VMLOG = g.__VMLOG || [];
  g.__vmlog = function(op){ try { g.__VMLOG.push(op); } catch(e){} return op; };
})(typeof globalThis!=='undefined'?globalThis:this);
`;

function instrument(code) {
  const ast = parser.parse(code, { sourceType: 'unambiguous', errorRecovery: true });
  let count = 0;

  traverse(ast, {
    SwitchStatement(path) {
      // 仅插桩位于循环体内的 switch（VM 分发器特征）
      const inLoop = path.findParent(p =>
        t.isWhileStatement(p.node) || t.isForStatement(p.node) || t.isDoWhileStatement(p.node));
      if (!inLoop) return;
      if (path.node.cases.length < 5) return; // case 太少不像 VM 分发

      const disc = path.node.discriminant;
      // 在 switch 前插入：__vmlog(<discriminant 副本>)
      const logCall = t.expressionStatement(
        t.callExpression(t.identifier('__vmlog'), [t.cloneNode(disc, true)])
      );
      path.insertBefore(logCall);
      count++;
    },
  });

  console.error(`[jsvmp] 已插桩 ${count} 处 switch 分发器`);
  const out = generate(ast, { compact: false }).code;
  return LOGGER + '\n' + out;
}

if (require.main === module) {
  const [, , inFile, outFile] = process.argv;
  if (!inFile) { console.error('用法: node scripts/vm/jsvmp-instrument.cjs <vm.js> [out.js]'); process.exit(1); }
  const code = fs.readFileSync(inFile, 'utf8');
  const out = instrument(code);
  if (outFile) { fs.writeFileSync(outFile, out); console.error(`[jsvmp] 已写出 ${outFile}`); }
  else process.stdout.write(out);
}

module.exports = { instrument };
