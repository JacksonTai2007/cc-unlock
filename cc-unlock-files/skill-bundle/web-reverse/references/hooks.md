# Hooks 与反调试（按需加载）

使用场景：需要捕获请求/响应、定位签名参数、绕过浏览器反调试、捕获WebCrypto/CryptoJS参数。

## 1) 统一网络捕获 Hook

```javascript
// ① Hook fetch
const _fetch = window.fetch;
window.fetch = async function(...args) {
  const req = args[0] instanceof Request ? args[0] : new Request(...args);
  const body = req.method !== 'GET' ? await req.clone().text() : '';
  console.log('[fetch→]', req.method, req.url, body.slice(0, 512));
  const resp = await _fetch(...args);
  const clone = resp.clone();
  clone.text().then(t => console.log('[fetch←]', resp.status, req.url, t.slice(0, 512)));
  return resp;
};

// ② Hook XMLHttpRequest
const _XHRopen = XMLHttpRequest.prototype.open;
const _XHRsend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(m, u) { this._m = m; this._u = u; return _XHRopen.apply(this, arguments); };
XMLHttpRequest.prototype.send = function(body) {
  console.log('[XHR→]', this._m, this._u, body ? String(body).slice(0, 256) : '');
  this.addEventListener('load', () => console.log('[XHR←]', this.status, this._u, this.responseText.slice(0, 512)));
  return _XHRsend.apply(this, arguments);
};

// ③ Hook WebSocket
const _WS = window.WebSocket;
window.WebSocket = function(...args) {
  const ws = new _WS(...args);
  console.log('[WS] connect:', args[0]);
  ws.addEventListener('message', e => console.log('[WS←]', typeof e.data === 'string' ? e.data.slice(0, 256) : '[binary frame]'));
  const _send = ws.send.bind(ws);
  ws.send = function(d) { console.log('[WS→]', typeof d === 'string' ? d.slice(0, 256) : '[binary frame]'); return _send(d); };
  return ws;
};

// ④ Hook sendBeacon
const _beacon = navigator.sendBeacon.bind(navigator);
navigator.sendBeacon = function(url, data) {
  console.log('[beacon→]', url, data ? String(data).slice(0, 256) : '');
  return _beacon(url, data);
};

// ⑤ Hook document.cookie setter
const _cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                    Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
if (_cookieDesc && _cookieDesc.set) {
  Object.defineProperty(document, 'cookie', {
    set: function(val) {
      console.log('[cookie set]', val.slice(0, 256));
      return _cookieDesc.set.call(this, val);
    },
    get: function() { return _cookieDesc.get.call(this); },
    configurable: true
  });
}
```

## 2) Service Worker 检测

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => console.log('[SW] scope:', r.scope, 'scriptURL:', r.active?.scriptURL));
  });
}
```

## 3) Anti-Anti-Debug（增强版）

```javascript
(function installAntiAntiDebug() {
  // 1. 归一化时序
  const _dateNow = Date.now;
  Date.now = () => _dateNow();
  const _perf = performance.now.bind(performance);
  performance.now = () => _perf();

  // 2. 固定 console.log，减少 console 检测噪音
  const _consoleLog = console.log;
  Object.defineProperty(console, "log", {
    value: _consoleLog,
    writable: false,
    configurable: false
  });

  // 3. 拦截包含 debugger/devtools 的 setInterval/setTimeout
  ['setInterval','setTimeout'].forEach(fn => {
    const _orig = window[fn];
    window[fn] = function(cb, delay, ...rest) {
      const source = typeof cb === 'function' ? cb.toString() : String(cb);
      if (/debugger|devtools/i.test(source)) {
        console.log('[AAD] blocked', fn, source.slice(0, 120));
        return 0;
      }
      return _orig(cb, delay, ...rest);
    };
  });

  // 4. 屏蔽 DevTools 尺寸检测
  Object.defineProperty(window, 'outerWidth',  { configurable:true, get: () => window.innerWidth });
  Object.defineProperty(window, 'outerHeight', { configurable:true, get: () => window.innerHeight });

  // 5. 拦截 new Function(...) 中的 debugger
  const _origFunction = Function;
  window.Function = new Proxy(_origFunction, {
    construct(target, args) {
      const body = args[args.length - 1] || '';
      if (typeof body === 'string' && /debugger/.test(body)) {
        args[args.length - 1] = body.replace(/\bdebugger\b/g, '0');
      }
      return Reflect.construct(target, args);
    }
  });

  // 6. Function.prototype.toString 伪装
  const _fnToString = Function.prototype.toString;
  Function.prototype.toString = function() {
    if (this.__isHook__) return `function ${this.__originalName__ || this.name}() { [native code] }`;
    return _fnToString.call(this);
  };

  console.log('[AAD] Anti-anti-debug installed');
})();
```

## 3a) 使用建议

- 首屏即触发的反调试，优先 preload 注入
- 先枚举模式，再选择最小 patch
- 绕过后立即回到请求链路 / sign 链路 / token 链路
- 记录“已触发 / 已绕过 / 未解决”三类状态

## 4) WebCrypto / CryptoJS 捕获

```javascript
const subtle = crypto.subtle;
const _importKey = subtle.importKey.bind(subtle);
const _sign = subtle.sign.bind(subtle);
const _encrypt = subtle.encrypt.bind(subtle);
const _decrypt = subtle.decrypt.bind(subtle);
const _digest = subtle.digest.bind(subtle);

function ab2hex(ab) {
  return Array.from(new Uint8Array(ab)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

subtle.importKey = async function(format, keyData, algo, extractable, usages) {
  if (keyData instanceof ArrayBuffer) console.log('[WebCrypto] importKey', format, JSON.stringify(algo), ab2hex(keyData));
  return _importKey(format, keyData, algo, extractable, usages);
};

subtle.sign = async function(algo, key, data) {
  console.log('[WebCrypto] sign', JSON.stringify(algo), ab2hex(data));
  const sig = await _sign(algo, key, data);
  console.log('[WebCrypto] sign result', ab2hex(sig));
  return sig;
};

subtle.encrypt = async function(algo, key, data) {
  console.log('[WebCrypto] encrypt', JSON.stringify(algo), ab2hex(data));
  if (algo.iv) console.log('[WebCrypto] IV', ab2hex(algo.iv));
  const ct = await _encrypt(algo, key, data);
  console.log('[WebCrypto] encrypt result', ab2hex(ct));
  return ct;
};

subtle.decrypt = async function(algo, key, data) {
  console.log('[WebCrypto] decrypt', JSON.stringify(algo), ab2hex(data));
  const pt = await _decrypt(algo, key, data);
  console.log('[WebCrypto] decrypt result', ab2hex(pt));
  return pt;
};

subtle.digest = async function(algo, data) {
  console.log('[WebCrypto] digest', algo, ab2hex(data));
  const hash = await _digest(algo, data);
  console.log('[WebCrypto] digest result', ab2hex(hash));
  return hash;
};

if (window.CryptoJS) {
  const _AESenc = CryptoJS.AES.encrypt;
  CryptoJS.AES.encrypt = function(msg, key, cfg) {
    console.log('[CryptoJS.AES.encrypt] key:', key.toString ? key.toString() : key);
    console.log('  cfg:', JSON.stringify(cfg || {}));
    console.log('  msg:', msg.toString ? msg.toString() : msg);
    const result = _AESenc(msg, key, cfg);
    console.log('  ciphertext:', result.toString());
    return result;
  };
}
```
