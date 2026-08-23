#!/usr/bin/env node
/**
 * deob-ob.cjs — OB(obfuscator.io) 标准混淆反混淆器
 *
 * 处理：大数组 + 位移 IIFE + 解密函数 → 还原所有解密调用为字面量，
 *       移除解密函数别名链，清理死代码，静态折叠常量。
 *
 * 依赖：cd scripts && npm i  （@babel/parser @babel/traverse @babel/generator @babel/types）
 *
 * 用法：
 *   node scripts/deob/deob-ob.cjs obfuscated.js [deobfuscated.js]
 *
 * 注意：本脚本用 vm 在隔离上下文执行"解密三件套"。仅对可信样本运行，
 *       或在容器/沙箱内运行。无法处理控制流平坦化/字典混淆等变体——
 *       失败时转手工，见 references/string-array-deobfuscation-playbook.md /
 *       references/control-flow-flattening-playbook.md / references/deobf.md。
 */

const fs = require('fs');
const vm = require('vm');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

function parse(code) {
  return parser.parse(code, {
    sourceType: 'unambiguous',
    allowReturnOutsideFunction: true,
    allowImportExportEverywhere: true,
    errorRecovery: true,
  });
}

/** 找到字符串大数组名（全字符串、长度>5） */
function findStringArray(ast) {
  let name = null, max = 0;
  traverse(ast, {
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (t.isIdentifier(id) && t.isArrayExpression(init)) {
        const allStr = init.elements.length > 5 &&
          init.elements.every(e => t.isStringLiteral(e) || t.isNullLiteral(e));
        if (allStr && init.elements.length > max) { max = init.elements.length; name = id.name; }
      }
    },
  });
  return name;
}

/** 找到解密函数名（引用了大数组、含位移/charCodeAt 等特征） */
function findDecoder(ast, arrName) {
  let name = null;
  const isDecoder = (path) => {
    const src = path.toString();
    return src.includes(arrName) && /function/.test(src) &&
      (src.includes('shift') || src.includes('charCodeAt') || src.includes('parseInt') ||
        src.includes('push') || src.includes('[') );
  };
  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id && isDecoder(path)) name = name || path.node.id.name;
    },
    VariableDeclarator(path) {
      if (t.isFunctionExpression(path.node.init) && t.isIdentifier(path.node.id) && isDecoder(path)) {
        name = name || path.node.id.name;
      }
    },
  });
  return name;
}

/** 抽取解密相关语句（大数组声明 + 位移 IIFE + 解密函数）并在 vm 中执行 */
function buildDecoder(ast, code, arrName, decName) {
  // 提取顶层与解密相关的语句源码：包含 arrName 或 decName 的 declaration / 顶层 IIFE
  const fragments = [];
  for (const node of ast.program.body) {
    const src = code.slice(node.start, node.end);
    if (src.includes(arrName) || src.includes(decName)) fragments.push(src);
    // 顶层自执行函数（位移器）通常不含 decName，但含 arrName，已覆盖
  }
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fragments.join('\n') + `\n;globalThis.__dec = ${decName};`, sandbox, { timeout: 5000 });
  return (arg) => sandbox.__dec(arg);
}

function deobfuscate(code) {
  const ast = parse(code);
  const arrName = findStringArray(ast);
  if (!arrName) throw new Error('未找到字符串大数组，可能不是标准 OB 混淆');
  const decName = findDecoder(ast, arrName);
  if (!decName) throw new Error('未找到解密函数');
  console.error(`[deob] 大数组=${arrName} 解密函数=${decName}`);

  const decode = buildDecoder(ast, code, arrName, decName);

  // 1. 解析别名链：var a = decName; var b = a; → 统一替换为 decName
  traverse(ast, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.init) && path.node.init.name === decName && t.isIdentifier(path.node.id)) {
        const alias = path.node.id.name;
        const binding = path.scope.getBinding(alias);
        if (binding) {
          binding.referencePaths.forEach(ref => {
            if (t.isIdentifier(ref.node)) ref.node.name = decName;
          });
          path.remove();
        }
      }
    },
  });

  // 2. 替换解密调用 decName(0x1) → 字面量
  let replaced = 0;
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (t.isIdentifier(callee) && callee.name === decName) {
        const args = path.node.arguments;
        if (args.every(a => t.isNumericLiteral(a) || t.isStringLiteral(a))) {
          try {
            const val = decode(...args.map(a => a.value));
            if (typeof val === 'string') { path.replaceWith(t.stringLiteral(val)); replaced++; }
          } catch (_) {}
        }
      }
    },
  });
  console.error(`[deob] 替换解密调用 x${replaced}`);

  // 3. 静态常量折叠
  traverse(ast, {
    BinaryExpression(path) {
      const ev = path.evaluate();
      if (ev.confident && (typeof ev.value === 'number' || typeof ev.value === 'string')) {
        path.replaceWith(typeof ev.value === 'number' ? t.numericLiteral(ev.value) : t.stringLiteral(ev.value));
      }
    },
  });

  // 4. 清理无引用声明（解密函数、大数组等死代码）
  traverse(ast, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id)) {
        const b = path.scope.getBinding(path.node.id.name);
        if (b && !b.referenced) path.remove();
      }
    },
  });

  return generate(ast, { compact: false, comments: true }).code;
}

if (require.main === module) {
  const [, , inFile, outFile] = process.argv;
  if (!inFile) { console.error('用法: node scripts/deob/deob-ob.cjs <input.js> [output.js]'); process.exit(1); }
  const code = fs.readFileSync(inFile, 'utf8');
  try {
    const out = deobfuscate(code);
    if (outFile) { fs.writeFileSync(outFile, out); console.error(`[deob] 已写出 ${outFile}`); }
    else process.stdout.write(out);
  } catch (e) {
    console.error('[deob] 失败:', e.message);
    console.error('  → 可能是 OB 变体（控制流平坦化/字典/RC4数组），见 references/control-flow-flattening-playbook.md');
    process.exit(2);
  }
}

module.exports = { deobfuscate };
