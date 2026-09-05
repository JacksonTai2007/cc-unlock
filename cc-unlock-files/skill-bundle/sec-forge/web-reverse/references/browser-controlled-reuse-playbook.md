# Browser Controlled Reuse Playbook

Version: 1

适用场景：

- 黑盒复用（直接调用目标 JS/WASM 函数）不可行，因为需要持续会话态、动态令牌或复杂环境状态
- 纯算法提取（将算法迁移到 Node/Python）成本过高或不可行（如深度 VM/WASM 混合、强环境绑定）
- 需要在浏览器环境中进行精细化操控，同时规避检测、维持会话、稳定复现请求

本 playbook 填补"黑盒复用"和"纯算法提取"之间的空白层。

---

## 核心定位

浏览器可控复用不是"用 Puppeteer 打开页面就完了"，而是：

1. **精确控制执行环境**：在真实浏览器中，按需修改环境值、维持一致性
2. **精确控制执行流程**：按需求触发目标操作（点击、滚动、输入），并拦截关键数据
3. **规避检测**：让目标站认为请求来自"真实用户"而非"自动化工具"
4. **稳定复现**：同一套操控流程能重复产生相同结果

**适用判定**：

| 条件 | 黑盒 | 浏览器可控 | 纯算法 |
|------|------|-----------|--------|
| 是否需要持续会话态 | 否 | 是 | 否 |
| 是否深度依赖环境值 | 低 | 高 | 中 |
| WASM/VM 复杂度 | 低 | 高 | 极高 |
| 是否可接受浏览器开销 | 否 | 是 | 否 |
| 目标是否强 anti-bot | 否 | 是 | 是 |

当"黑盒不可行"且"纯算法成本过高"时，选择浏览器可控复用。

---

## 技术栈选择（2026 反检测优先级）

强 anti-bot（Cloudflare / DataDome / Akamai）下，技术栈选择直接决定能否落地，按下列优先级选：

### 1. rebrowser-patches / patchright（主流首选）

- CDP 泄漏（`Runtime.enable`、`navigator.webdriver`、CDP 痕迹）已在底层修补
- `rebrowser-puppeteer` 可作为 `puppeteer` 的 drop-in 替换，迁移成本低
- 当前未被主流风控广泛标记，是强目标的默认选择

### 2. nodriver（CDP-minimal）

- 最小化 CDP 暴露面，无 Selenium/WebDriver 痕迹
- **本环境已挂 `stealth-browser-mcp`（基于 nodriver）**，浏览器可控复用应优先与之对齐，而非另起 Puppeteer 进程

### 3. puppeteer-extra-plugin-stealth（仅低强度 / 遗留）

- 该插件约 3 年无更新，特征已被 Cloudflare / DataDome / Akamai **主动检测**
- 仅用于弱风控或已有遗留脚本；遇到强 anti-bot 直接升级到上面两项
- 配合 `rebrowser-patches` 底层时仍可用其指纹补丁，但不要单独依赖它对抗现代风控

### Selenium（不推荐新任务）

- 检测面最大（WebDriver 特征明显）
- 仅当目标明确要求时使用

---

## 环境控制策略

### 基础规避

1. **headless 掩盖**
   - 首选用 rebrowser-patches / patchright / nodriver 的内建修补（见上「技术栈选择」）
   - 遗留链路才退回 `puppeteer-extra-plugin-stealth`
   - 或使用 Playwright 的 `args: ['--disable-blink-features=AutomationControlled']`
   - 注入 `navigator.webdriver = undefined`

2. **指纹一致性**
   - viewport 与 `window.screen` 一致
   - `devicePixelRatio` 与实际显示一致
   - `navigator.languages` 与 IP 地理位置匹配
   - `timezone` 与 IP 地理位置匹配

3. **CDP 痕迹清理**
   - `chrome.runtime` 存在性控制
   - `cdc_` 变量清理（Selenium 特有，但 Puppeteer 也要注意）
   - `document.$cdc_` 等注入标记清理

### 精细化环境操控

当目标算法强依赖特定环境值时：

1. **目标环境值读取拦截**
   - 在页面加载前注入 preload 脚本
   - 使用 `Object.defineProperty` 精确覆盖目标属性
   - 只覆盖算法需要的值，不过度 patch

2. **环境值一致性维持**
   - 确保所有同源 iframe、worker 看到相同的环境值
   - 拦截 `postMessage`、BroadcastChannel，防止跨上下文泄漏真实环境
   - 对 `Function.prototype.toString` 返回原生字符串

3. **时序控制**
   - 控制 `Date.now()` / `performance.now()` 的返回值
   - 控制 `setTimeout` / `setInterval` 的触发时机
   - 避免时间异常触发 timing 检测

---

## 执行流程控制

### 阶段 1：页面初始化

1. 启动浏览器（带 stealth 配置）
2. 注入 preload 脚本（反反调试、环境覆盖、hook 模板）
3. 加载目标页面
4. 等待关键脚本加载完成（通过 `page.waitForFunction` 检测全局变量）

### 阶段 2：会话建立

1. 执行登录/认证流程（如需）
2. 拦截并保存关键凭证（cookie、localStorage、token）
3. 验证会话有效性（发起一次测试请求）

### 阶段 3：目标操作触发

1. 按需求触发用户操作（导航、点击、输入、滚动）
2. 监听网络请求，拦截目标 API 的请求和响应
3. 同时 hook 关键函数（sign、encrypt、token refresh），捕获中间值

#### on-new-document 注入 hook 抓签名函数入参/返回（把浏览器当 sign-oracle）

这是 SKILL.md「sign-call 取证用钩函数抓入参/返回，不要盲注 `evaluate_script`」的落地范式。核心是**在页面任何 JS 执行前**就埋好 hook（抢在 signer 定义/调用之前），把浏览器变成一个能反复喂输入、读真实签名输出的 oracle，而不是一次次 `evaluate_script` 盲试。

落到 stealth-browser（nodriver）/ patchright 的具体 API：

- **stealth-browser**：`add_script_to_evaluate_on_new_document`
- **js-reverse / 同类**：`inject_before_load`
- **通用 CDP**：`Page.addScriptToEvaluateOnNewDocument`

注入脚本两种钩法（按是否已知 signer 选）：

```javascript
// 注入到 add_script_to_evaluate_on_new_document / inject_before_load 的脚本：

// 法一（已知 signer 位置）：直接包住目标 sign 函数，抓明文入参 + 签名返回
//   适用于 signer 挂在某全局/模块对象上、名字已定位
(function hookSigner() {
  const tryHook = () => {
    const obj = window.JSEncrypt && window.JSEncrypt.prototype; // 举例，替换成目标
    if (!obj || obj.__hooked) return false;
    const _sign = obj.sign;
    obj.sign = function (...args) {
      const ret = _sign.apply(this, args);
      window.__signLog = window.__signLog || [];
      window.__signLog.push({ args, ret, stack: new Error().stack });
      return ret;
    };
    obj.__hooked = true;
    return true;
  };
  // signer 可能晚于注入才定义：轮询直到挂上
  if (!tryHook()) {
    const t = setInterval(() => { if (tryHook()) clearInterval(t); }, 30);
  }
})();

// 法二（signer 未定位）：钩通用序列化/加密入口，从明文边界倒推 signer
//   JSON.stringify 常是「明文进签名前」的最后一站；CryptoJS/aes 入口能抓 key+明文
(function hookSerializeBoundary() {
  const _stringify = JSON.stringify;
  JSON.stringify = function (...args) {
    const out = _stringify.apply(this, args);
    // 命中目标字段才记录，避免噪声淹没
    if (/timestamp|nonce|payload|sign/i.test(out)) {
      (window.__plainLog = window.__plainLog || []).push({ plain: out, stack: new Error().stack });
    }
    return out;
  };
  // 同理可钩 window.crypto.subtle.encrypt / CryptoJS.AES.encrypt 抓 key/iv/明文
})();
```

取证后：通过控制操作触发签名，再 `evaluate` 读回 `window.__signLog` / `window.__plainLog`。这样**入参（明文）、返回（签名）、调用栈**一次拿齐——把浏览器当 sign-oracle，比反复盲注 `evaluate_script` 试探稳得多。能力映射（哪个工具用哪个 API）见 `browser-mcp-capability-map.md`「页面 JS 执行前注入 hook」与「钩函数·抓入参/返回」两行。

> 纪律：法二的 `JSON.stringify` 钩子务必加字段过滤 + 用完即解钩，避免污染页面正常序列化；法一的轮询挂钩要设上限轮次，挂不上就回退到断点/`trace_function`。

### 阶段 4：数据提取

1. 从网络拦截中获取请求参数
2. 从函数 hook 中获取签名/加密过程的输入输出
3. 从页面状态中获取关键状态值

### 阶段 5：复现验证

1. 使用相同流程再次执行
2. 对比两次的输出（签名值、请求参数、响应结果）
3. 评估稳定性（是否受时间、随机数、会话影响）

---

## 与黑盒/纯算法的衔接

浏览器可控复用不是终点，而是中间态：

### 降级到黑盒

当通过浏览器可控复用理解了目标算法的输入输出契约后：

- 若能分离出稳定的"纯算法部分"，可尝试在 Node 中复用
- 若 WASM  export 的输入输出边界清晰，可直接在 Node 中加载 WASM

### 升级为纯算法

当浏览器可控复用稳定运行后：

1. 捕获大量输入输出样本
2. 分析样本规律，尝试还原算法逻辑
3. 逐步用纯代码替代浏览器内的执行
4. 验证纯代码输出与浏览器内输出的一致性

---

## 交付要求

- `run/browser-controlled-repro.md`
  - 浏览器配置（版本、启动参数、插件）
  - 环境覆盖清单
  - 执行流程脚本路径
  - 稳定性评估（成功次数/总次数）
  - 与黑盒/纯算法的衔接计划

- `run/browser-repro-script.js`
  - 可运行的复现脚本

- `run/browser-env-override.js`
  - 环境覆盖的 preload 脚本

---

## 禁止事项

- 用"打开页面+截图"当成浏览器可控复用
- 过度 patch 环境导致 descriptor 异常被检测
- 忽略 iframe/worker 上下文的环境一致性
- 把浏览器可控复用当成最终交付，而不尝试向黑盒/纯算法迁移
- 在浏览器可控复用稳定前，就宣称"已完成本地复现"
