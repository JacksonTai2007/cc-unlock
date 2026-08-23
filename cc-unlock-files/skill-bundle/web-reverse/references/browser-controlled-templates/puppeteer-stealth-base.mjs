/**
 * Puppeteer Stealth 基础模板
 * 用途：浏览器可控复用的最小可运行骨架
 *
 * ⚠️ 反检测优先级（2026 现状）：
 *   1. 首选 rebrowser-patches / patchright（CDP 泄漏已修，主流风控未广泛标记）
 *   2. 次选 nodriver（CDP-minimal；本环境已挂 stealth-browser-mcp 即基于 nodriver，优先与之对齐）
 *   3. puppeteer-extra-plugin-stealth 仅用于低强度 / 遗留目标 —— 该插件约 3 年无更新，
 *      其特征已被 Cloudflare / DataDome / Akamai 主动检测，遇到强 anti-bot 直接换上面两项。
 *   本模板保留 stealth 写法仅为最小可运行参考，强目标请改用 rebrowser-puppeteer / patchright。
 *
 * 要求：Node.js >= 18
 * 安装依赖（首选）:
 *   npm install rebrowser-puppeteer          // drop-in 替换 puppeteer，CDP 泄漏已修
 * 安装依赖（遗留/低强度，本模板示例）:
 *   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */

// 首选：import puppeteer from 'rebrowser-puppeteer';  // 强目标用这一行替换下面两行
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ===================== 配置区 =====================
const CONFIG = {
  headless: 'new',           // 或 false 用于调试
  slowMo: 0,                 // 操作延迟（ms），调试时可设为50-100
  viewport: { width: 1920, height: 1080 },
  userAgent: null,           // null = 使用默认，或指定完整UA
  locale: 'zh-CN',
  timezone: 'Asia/Shanghai',
  // 反检测额外参数
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
  ],
  // Preload脚本路径（覆盖环境值、反反调试、hook模板）
  preloadScript: null,       // 如: './preload.js'
};

const TARGET = {
  url: 'https://example.com', // 修改为目标站
  waitForSelector: 'body',    // 页面就绪标记
  timeout: 30000,
};

// ===================== 核心函数 =====================

/**
 * 启动浏览器并返回page实例
 */
export async function launchBrowser(config = CONFIG) {
  const launchOptions = {
    headless: config.headless,
    args: config.args,
    defaultViewport: config.viewport,
  };

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  // 设置UA和语言
  if (config.userAgent) {
    await page.setUserAgent(config.userAgent);
  }
  await page.setExtraHTTPHeaders({
    'Accept-Language': config.locale,
  });

  // 注入timezone覆盖（在页面导航前）
  await page.evaluateOnNewDocument((tz) => {
    Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
      value: function() {
        const opts = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'resolvedOptions').value.call(this);
        opts.timeZone = tz;
        return opts;
      }
    });
  }, config.timezone);

  // 注入preload脚本（如果有）
  if (config.preloadScript) {
    const fs = await import('fs');
    const preloadCode = fs.readFileSync(config.preloadScript, 'utf8');
    await page.evaluateOnNewDocument(preloadCode);
  }

  return { browser, page };
}

/**
 * 拦截并记录网络请求
 */
export async function setupNetworkInterception(page, targetUrlPattern = /.*/) {
  const requests = [];
  const responses = [];

  await page.setRequestInterception(true);

  page.on('request', (req) => {
    if (targetUrlPattern.test(req.url())) {
      requests.push({
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        postData: req.postData(),
        timestamp: Date.now(),
      });
    }
    req.continue();
  });

  page.on('response', async (res) => {
    if (targetUrlPattern.test(res.url())) {
      try {
        const body = await res.text().catch(() => null);
        responses.push({
          url: res.url(),
          status: res.status(),
          headers: res.headers(),
          bodyPreview: body ? body.slice(0, 500) : null,
          timestamp: Date.now(),
        });
      } catch (e) {
        // 忽略
      }
    }
  });

  return { requests, responses };
}

/**
 * Hook目标函数并记录调用
 */
export async function hookFunction(page, globalPath, options = {}) {
  const { logArgs = true, logReturn = true, maxLogs = 1000 } = options;
  const hookName = `_hook_${globalPath.replace(/\./g, '_')}`;

  await page.evaluateOnNewDocument((path, name, opts) => {
    const parts = path.split('.');
    let obj = window;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (!obj) return;
    }
    const fnName = parts[parts.length - 1];
    const orig = obj[fnName];
    if (typeof orig !== 'function') return;

    const logs = window[name] = [];

    obj[fnName] = function(...args) {
      const entry = { timestamp: Date.now(), args: opts.logArgs ? args : undefined };
      const result = orig.apply(this, args);
      if (opts.logReturn) entry.return = result;
      if (logs.length < opts.maxLogs) logs.push(entry);
      return result;
    };
  }, globalPath, hookName, { logArgs, logReturn, maxLogs });

  return async () => {
    return page.evaluate((name) => window[name] || [], hookName);
  };
}

/**
 * 提取页面关键状态
 */
export async function extractPageState(page) {
  return page.evaluate(() => {
    return {
      url: location.href,
      cookies: document.cookie,
      localStorage: { ...localStorage },
      sessionStorage: { ...sessionStorage },
      title: document.title,
      // 可扩展：提取特定全局变量
      // customState: window.__APP_STATE__
    };
  });
}

/**
 * 主执行流程模板
 */
export async function runBrowserControlledTask(taskFn, config = CONFIG) {
  const { browser, page } = await launchBrowser(config);
  const network = await setupNetworkInterception(page);

  try {
    // 导航到目标
    await page.goto(TARGET.url, { waitUntil: 'networkidle2', timeout: TARGET.timeout });
    await page.waitForSelector(TARGET.waitForSelector, { timeout: TARGET.timeout });

    // 执行用户任务
    const result = await taskFn(page, network);

    // 提取最终状态
    const finalState = await extractPageState(page);

    return {
      success: true,
      result,
      finalState,
      requests: network.requests,
      responses: network.responses,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      requests: network.requests,
      responses: network.responses,
    };
  } finally {
    await browser.close();
  }
}

// ===================== 使用示例 =====================
/*
import { runBrowserControlledTask, hookFunction } from './puppeteer-stealth-base.mjs';

async function myTask(page, network) {
  // Hook签名函数
  const getSignLogs = await hookFunction(page, 'window._sign', { logArgs: true });

  // 触发目标操作
  await page.click('#submit-button');
  await page.waitForTimeout(2000);

  // 获取hook日志
  const logs = await getSignLogs();

  return { signLogs: logs };
}

const result = await runBrowserControlledTask(myTask);
console.log(JSON.stringify(result, null, 2));
*/
