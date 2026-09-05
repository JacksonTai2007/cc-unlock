/**
 * Preload Hook 模板
 * 用途：在页面脚本执行前注入，用于：
 *   1. 反反调试（绕过debugger/toString检测）
 *   2. 覆盖环境值（navigator/screen等）
 *   3. Hook关键函数（crypto/fetch/XHR/storage）
 *
 * 使用方式：通过 Puppeteer/Playwright 的 evaluateOnNewDocument 注入
 */

(function preloadHook() {
  'use strict';

  const LOG_PREFIX = '[PreloadHook]';
  const ENABLED = {
    antiDebug: true,
    envOverride: true,
    cryptoHook: true,
    networkHook: true,
    storageHook: false,  // 默认关闭，避免影响正常功能
  };

  // ===================== 工具函数 =====================

  function log(...args) {
    if (typeof console !== 'undefined') {
      console.log(LOG_PREFIX, ...args);
    }
  }

  function hook(obj, prop, wrapper) {
    if (!obj || !obj[prop]) return false;
    const orig = obj[prop];
    obj[prop] = wrapper(orig);
    return true;
  }

  // ===================== 1. 反反调试 =====================

  if (ENABLED.antiDebug) {
    // 禁用debugger语句
    const origDebugger = window.debugger;
    Object.defineProperty(window, 'debugger', {
      get: () => {},
      set: () => {},
      configurable: true,
    });

    // 绕过Function.prototype.toString检测
    const origToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === Function.prototype.toString) return origToString.call(this);
      if (this === window.fetch) return 'function fetch() { [native code] }';
      if (this === XMLHttpRequest.prototype.open) return 'function open() { [native code] }';
      // 可以添加更多原生函数的伪装
      return origToString.call(this);
    };

    // 绕过console.clear检测
    const origClear = console.clear;
    console.clear = function() {
      log('console.clear intercepted');
      // 可选：不执行真正的clear
      // origClear.apply(this, arguments);
    };

    // 绕过performance.now时序检测（可选，注意影响精度）
    // const origNow = performance.now.bind(performance);
    // let baseTime = origNow();
    // performance.now = function() {
    //   return baseTime + (Date.now() - Math.floor(baseTime));
    // };

    log('Anti-debug hooks installed');
  }

  // ===================== 2. 环境值覆盖 =====================

  if (ENABLED.envOverride) {
    const envConfig = {
      // navigator覆盖
      navigator: {
        webdriver: undefined,
        plugins: [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
        languages: ['zh-CN', 'zh', 'en'],
        // 可按需添加更多属性
      },
      // screen覆盖
      screen: {
        // 这些通常不需要覆盖，除非特定目标检测
        // width: 1920,
        // height: 1080,
      },
    };

    // 覆盖navigator属性
    for (const [key, value] of Object.entries(envConfig.navigator)) {
      if (value !== undefined) {
        Object.defineProperty(navigator, key, {
          get: () => value,
          configurable: true,
        });
      } else {
        // 删除属性（如webdriver）
        delete navigator[key];
      }
    }

    log('Environment overrides installed');
  }

  // ===================== 3. Crypto Hook =====================

  if (ENABLED.cryptoHook && window.crypto && window.crypto.subtle) {
    const subtle = window.crypto.subtle;

    // Hook encrypt
    if (subtle.encrypt) {
      const origEncrypt = subtle.encrypt.bind(subtle);
      subtle.encrypt = async function(algorithm, key, data) {
        log('crypto.subtle.encrypt called', { algorithm });
        const result = await origEncrypt(algorithm, key, data);
        // 记录输入输出（注意：不要全量记录大数组）
        window.__cryptoHookLog = window.__cryptoHookLog || [];
        window.__cryptoHookLog.push({
          op: 'encrypt',
          algorithm,
          dataLength: data.byteLength,
          resultLength: result.byteLength,
          timestamp: Date.now(),
        });
        return result;
      };
    }

    // Hook decrypt
    if (subtle.decrypt) {
      const origDecrypt = subtle.decrypt.bind(subtle);
      subtle.decrypt = async function(algorithm, key, data) {
        log('crypto.subtle.decrypt called', { algorithm });
        const result = await origDecrypt(algorithm, key, data);
        window.__cryptoHookLog = window.__cryptoHookLog || [];
        window.__cryptoHookLog.push({
          op: 'decrypt',
          algorithm,
          dataLength: data.byteLength,
          resultLength: result.byteLength,
          timestamp: Date.now(),
        });
        return result;
      };
    }

    // Hook digest
    if (subtle.digest) {
      const origDigest = subtle.digest.bind(subtle);
      subtle.digest = async function(algorithm, data) {
        log('crypto.subtle.digest called', { algorithm });
        const result = await origDigest(algorithm, data);
        window.__cryptoHookLog = window.__cryptoHookLog || [];
        window.__cryptoHookLog.push({
          op: 'digest',
          algorithm: typeof algorithm === 'string' ? algorithm : algorithm.name,
          dataLength: data.byteLength,
          timestamp: Date.now(),
        });
        return result;
      };
    }

    log('Crypto hooks installed');
  }

  // ===================== 4. 网络请求Hook =====================

  if (ENABLED.networkHook) {
    // Hook fetch
    if (window.fetch) {
      const origFetch = window.fetch;
      window.fetch = async function(...args) {
        const [url, options = {}] = args;
        log('fetch intercepted', { url: String(url), method: options.method || 'GET' });
        window.__networkHookLog = window.__networkHookLog || [];
        window.__networkHookLog.push({
          type: 'fetch',
          url: String(url),
          method: options.method || 'GET',
          headers: options.headers,
          bodyPreview: options.body ? String(options.body).slice(0, 200) : null,
          timestamp: Date.now(),
        });
        return origFetch.apply(this, args);
      };
    }

    // Hook XHR
    if (window.XMLHttpRequest) {
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._hookMeta = { method, url: String(url), timestamp: Date.now() };
        return origOpen.call(this, method, url, ...rest);
      };

      XMLHttpRequest.prototype.send = function(body) {
        if (this._hookMeta) {
          log('XHR intercepted', this._hookMeta);
          window.__networkHookLog = window.__networkHookLog || [];
          window.__networkHookLog.push({
            type: 'xhr',
            ...this._hookMeta,
            bodyPreview: body ? String(body).slice(0, 200) : null,
          });
        }
        return origSend.call(this, body);
      };
    }

    log('Network hooks installed');
  }

  // ===================== 5. Storage Hook（可选）=====================

  if (ENABLED.storageHook) {
    // localStorage setItem
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      log('localStorage.setItem', { key, value: String(value).slice(0, 100) });
      return origSetItem.call(this, key, value);
    };

    log('Storage hooks installed');
  }

  // ===================== 标记完成 =====================

  window.__preloadHookInstalled = true;
  window.__preloadHookConfig = ENABLED;
  log('All preload hooks installed successfully');

})();
