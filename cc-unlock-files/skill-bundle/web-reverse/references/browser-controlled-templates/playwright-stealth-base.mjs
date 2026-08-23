/**
 * Playwright Stealth 基础模板
 * 用途：浏览器可控复用的最小可运行骨架（Playwright版本）
 *
 * ⚠️ 反检测优先级（2026 现状，与 puppeteer 模板口径一致）：
 *   1. 首选 patchright（npm i patchright，drop-in 替换 playwright 的 chromium）/ rebrowser（CDP 泄漏已修，主流风控未广泛标记）
 *   2. 次选 nodriver / stealth-browser-mcp（CDP-minimal；本环境已挂 stealth-browser-mcp 即基于 nodriver，优先与之对齐）
 *   3. 裸 playwright 仅用于低强度 / 遗留目标 —— 其 CDP 特征已被 Cloudflare / DataDome / Akamai 主动检测，遇到强 anti-bot 直接换上面两项。
 *   本模板保留裸 playwright 写法仅为最小可运行参考，强目标请改用 patchright / rebrowser。
 *
 * 要求：Node.js >= 18
 * 安装依赖（首选）:
 *   npm install patchright            // drop-in 替换 playwright 的 chromium，CDP 泄漏已修
 * 安装依赖（遗留/低强度，本模板示例）:
 *   npm install playwright
 */

// 强目标：import { chromium } from 'patchright';  // 强目标用这一行替换下面一行
import { chromium } from 'playwright';

// ===================== 配置区 =====================
const CONFIG = {
  headless: true,
  slowMo: 0,
  viewport: { width: 1920, height: 1080 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  geolocation: { latitude: 31.2304, longitude: 121.4737 }, // 上海
  permissions: ['geolocation'],
  // 反检测额外参数
  args: [
    // 切到 patchright 后此项可省略（patchright 已内建处理 AutomationControlled），非 stealth 关键参数
    '--disable-blink-features=AutomationControlled',
  ],
  // Preload脚本
  preloadScript: null,
};

const TARGET = {
  url: 'https://example.com',
  waitForSelector: 'body',
  timeout: 30000,
};

// ===================== 核心函数 =====================

export async function launchBrowser(config = CONFIG) {
  const context = await chromium.launchPersistentContext('', {
    headless: config.headless,
    viewport: config.viewport,
    locale: config.locale,
    timezoneId: config.timezoneId,
    geolocation: config.geolocation,
    permissions: config.permissions,
    args: config.args,
    // Playwright的anti-detection
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  });

  const page = context.pages()[0] || await context.newPage();

  // 注入preload
  if (config.preloadScript) {
    const fs = await import('fs');
    const preloadCode = fs.readFileSync(config.preloadScript, 'utf8');
    await page.addInitScript(preloadCode);
  }

  return { context, page };
}

export async function setupNetworkInterception(page, urlPattern = '**/*') {
  const requests = [];
  const responses = [];

  page.on('request', (req) => {
    requests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      postData: req.postData(),
      timestamp: Date.now(),
    });
  });

  page.on('response', async (res) => {
    try {
      const body = await res.text().catch(() => null);
      responses.push({
        url: res.url(),
        status: res.status(),
        headers: res.headers(),
        bodyPreview: body ? body.slice(0, 500) : null,
        timestamp: Date.now(),
      });
    } catch (e) {}
  });

  return { requests, responses };
}

export async function hookFunction(page, globalPath, options = {}) {
  const { logArgs = true, logReturn = true } = options;
  const hookName = `_hook_${globalPath.replace(/\./g, '_')}`;

  await page.addInitScript(({ path, name, opts }) => {
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
      logs.push(entry);
      return result;
    };
  }, { path: globalPath, name: hookName, opts: { logArgs, logReturn } });

  return async () => page.evaluate((name) => window[name] || [], hookName);
}

export async function extractPageState(page) {
  return page.evaluate(() => ({
    url: location.href,
    cookies: document.cookie,
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    title: document.title,
  }));
}

export async function runBrowserControlledTask(taskFn, config = CONFIG) {
  const { context, page } = await launchBrowser(config);
  const network = await setupNetworkInterception(page);

  try {
    await page.goto(TARGET.url, { waitUntil: 'networkidle', timeout: TARGET.timeout });
    await page.waitForSelector(TARGET.waitForSelector, { timeout: TARGET.timeout });

    const result = await taskFn(page, network);
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
    await context.close();
  }
}

// ===================== 使用示例 =====================
/*
import { runBrowserControlledTask, hookFunction } from './playwright-stealth-base.mjs';

async function myTask(page, network) {
  const getLogs = await hookFunction(page, 'window._sign', { logArgs: true });
  await page.click('#submit');
  await page.waitForTimeout(2000);
  return { logs: await getLogs() };
}

const result = await runBrowserControlledTask(myTask);
console.log(JSON.stringify(result, null, 2));
*/
