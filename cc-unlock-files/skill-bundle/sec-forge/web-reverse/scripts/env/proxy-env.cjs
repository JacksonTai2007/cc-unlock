/**
 * proxy-env.cjs — 补环境 Proxy 自吐器
 *
 * 用途：在扣出的目标代码最顶部 require 本文件并调用 setupEnvProbe()，
 *       自动打印目标代码访问/设置的所有缺失环境属性，据此逐步补全。
 *       是 Patch（补环境）阶段定位"还差哪些环境属性"的最便宜起点。
 *
 * 用法：
 *   const { setupEnvProbe, minimalNodeMock } = require('./proxy-env.cjs');
 *   minimalNodeMock();                     // 先铺最小 mock
 *   setupEnvProbe();                       // 默认探测 window/document/navigator/...
 *   // ... 在此粘贴/require 扣出的目标代码 ...
 *
 * 或浏览器中直接把 setupEnvProbe 函数体粘进 Console 运行。
 * 配套方法论：docs/reference/env-patching.md（canonical）、references/node-env-rebuild.md。
 */

function setupEnvProbe(targets, opts) {
  targets = targets || ['window', 'document', 'location', 'navigator', 'history', 'screen'];
  opts = opts || {};
  const logGet = opts.logGet !== false;   // 默认记录 get
  const logSet = opts.logSet !== false;   // 默认记录 set
  const sink = opts.sink || ((...a) => console.log(...a));

  const g = (typeof globalThis !== 'undefined') ? globalThis : (typeof global !== 'undefined' ? global : this);

  for (const name of targets) {
    const handler = {
      get(target, prop, receiver) {
        if (logGet) sink('[GET]', name, String(prop), typeof target[prop]);
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        if (logSet) sink('[SET]', name, String(prop), typeof value);
        return Reflect.set(target, prop, value, receiver);
      }
    };
    try {
      if (typeof g[name] !== 'undefined' && g[name] !== null) {
        g[name] = new Proxy(g[name], handler);
      } else {
        g[name] = new Proxy({}, handler);
      }
    } catch (e) {
      try { g[name] = new Proxy({}, handler); } catch (_) { /* 不可写，跳过 */ }
    }
  }
  sink('[proxy-env] probing:', targets.join(', '));
}

/** 最小 Node mock：补常见缺失对象，作为补环境起点 */
function minimalNodeMock() {
  const g = globalThis;
  if (typeof g.window === 'undefined') g.window = g;
  if (typeof g.self === 'undefined') g.self = g;
  if (typeof g.document === 'undefined') g.document = {};
  if (typeof g.navigator === 'undefined') {
    Object.defineProperty(g, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        languages: ['zh-CN', 'zh', 'en'],
        platform: 'Win32',
        hardwareConcurrency: 8,
      },
      writable: true, configurable: true,
    });
  }
  if (typeof g.location === 'undefined') {
    g.location = { href: 'https://example.com/', origin: 'https://example.com', protocol: 'https:', host: 'example.com' };
  }
  try {
    if (typeof g.crypto === 'undefined') g.crypto = require('crypto').webcrypto;
  } catch (_) {}
}

module.exports = { setupEnvProbe, minimalNodeMock };

if (require.main === module) {
  minimalNodeMock();
  setupEnvProbe();
  console.log('[proxy-env] mock + probe ready. require your target code after this.');
}
