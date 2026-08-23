# Commercial Protection Identification Playbook

Version: 1

适用场景：目标站点使用商业化前端保护方案，需要快速识别保护提供商、版本特征和保护层级，以选择正确的突破策略。

---

## 1. 常见商业保护方案概览

| 提供商 | 主要产品 | 典型应用场景 | 保护强度 |
|--------|---------|-------------|---------|
| Akamai | Bot Manager, Web Application Firewall | 电商、金融、大型门户网站 | T4-T6 |
| Cloudflare | Turnstile, Bot Management, Challenge Platform | 广泛部署，从小站到企业级 | T3-T5 |
| DataDome | Bot Protection | 电商、票务、旅行 | T4-T6 |
| HUMAN（原 PerimeterX） | Bot Defender, Code Defender | 电商、金融、SaaS | T4-T6 |
| Imperva | Advanced Bot Protection | 金融、政府、企业 | T4-T6 |
| Shape Security (F5) | Shape Defense | 金融、航空、大型电商 | T5-T6 |
| reCAPTCHA | v2, v3, Enterprise | 广泛部署 | T2-T4 |
| hCaptcha | Enterprise | 广泛部署 | T2-T4 |
| Kasada | Bot Defense | 电商、航空、票务 | T4-T6 |
| FingerprintJS | Fingerprint Pro, BotD | 作为组件嵌入其他系统 | T2-T4 |
| ThreatMetrix (LexisNexis) | Device Intelligence | 金融、支付 | T4-T6 |
| 瑞数 (Riversecurity) | 动态安全 / 信息 (`$_ts` VMP) | 国内电商、政企、票务、金融 | T4-T6 |
| 阿里 (Alibaba WAF/Anti-Bot) | acw_sc__v2 / __jsl_clearance | 淘系、阿里云客户、广泛部署 | T3-T6 |
| 腾讯 | 防水墙 (T-Sec captcha) | 腾讯系、社交、游戏 | T3-T5 |
| 网易易盾 (Dun) | 行为式 / 滑块验证码 | 国内电商、社交、内容平台 | T3-T5 |
| 极验 (Geetest) | 行为验证 v3/v4 | 国内广泛部署 | T2-T4 |
| 数美 (Shumei) | 设备指纹 / 风控 SDK | 国内电商、社交、金融 | T3-T5 |

---

## 2. 识别方法

### 2.1 Akamai Bot Manager

**脚本特征：**
- 主脚本常为 `_abck` cookie 生成器
- 存在 `bmak` 全局对象或类似命名空间
- 大量 `sensor_data` 相关字符串
- 使用 `_akamai` 前缀的函数名
- 常见变量：`sensor_data`, `_abck`, `bm_sz`, `akamai-bmsc`

**网络特征：**
- 请求头中可能包含 `akamai` 相关cookie
- 采集数据发送至 `/_bm/` 或类似路径
- 挑战接口常为 `akamai` 子域

**指纹特征：**
- 深度canvas指纹（包括webgl上下文）
- 鼠标轨迹采样频率高（每50-100ms）
- 详细的插件/字体枚举
- 屏幕/窗口尺寸精确测量
- 时区、语言、色彩深度采集

**突破策略：**
- 重点：补环境一致性（descriptor级）
- 鼠标轨迹需要真实或高质量合成
- 会话态强，token有严格有效期
- 参考：`fingerprint-playbook.md` + `behavior-telemetry-playbook.md`

---

### 2.2 Cloudflare

**脚本特征：**
- Turnstile: 明显的 `turnstile` 对象，`cf-turnstile` DOM元素
- Challenge: `__cf_chl_jschl_tk__`, `cf_chl_prog`
- Bot Management: `cf_bm`, `_cfuvid` cookies
- 常见函数：`cf_chl_opt`, `cf_chl_done`, `_cf_chl_enter`

**网络特征：**
- `__cf_bm` cookie（bot管理）
- `cf_clearance` cookie（挑战通过）
- 挑战页URL包含 `__cf_chl_jschl_tk__`
- 可能的503/403响应后接挑战页

**指纹特征（Turnstile）：**
- 轻量级环境采集
- 侧重：webdriver检测、headless特征
- 行为特征较少（相比Akamai）
- 更依赖服务端ML模型

**突破策略：**
- Turnstile：stealth浏览器通常可过，注意iframe隔离
- Challenge：需要解析JS challenge并计算答案
- `cf_clearance` cookie 是关键，需维持会话
- 参考：`challenge-orchestration-playbook.md` + `browser-controlled-reuse-playbook.md`

---

### 2.3 DataDome

**脚本特征：**
- 主脚本常动态加载，URL含 `datadome`
- 全局对象 `DataDome`
- Cookie名：`datadome`, `dd_cookie_test`
- 常见字符串：`antipattern`, `fingerprint`, `interstitial`

**网络特征：**
- API端点：`/js/` 或 `/captcha/` 路径下
- 响应头可能包含 `x-dd-b` 或类似标识
- 拦截时返回 403 + HTML 挑战页

**指纹特征：**
- 非常详细的浏览器指纹
- 自动化检测强度高（对CDP痕迹敏感）
- 设备一致性检查严格
- 行为生物特征采集（鼠标、键盘节奏）

**突破策略：**
- CDP痕迹清理至关重要
- 环境一致性要求高
- 可能需要真实浏览器+精细操控
- 会话绑定强，cookie和localStorage需同步
- 参考：`fingerprint-playbook.md` + `session-lifecycle-playbook.md`

---

### 2.4 HUMAN（原 PerimeterX）

> 命名说明：PerimeterX 已并入 **HUMAN Security**，产品线现为 **HUMAN Bot Defender**；旧称 PerimeterX 仍常见于脚本/文档，cookie 标识仍为 `_px2`/`_px3`/`_pxhd` 等不变。

**脚本特征：**
- 主脚本URL常含 `perimeterx` 或 `px`
- 全局对象 `_pxAppId`, `_px`, `window._pxVid`
- Cookie：`pxcts`, `_px2`, `_px3`, `_pxff`, `_pxde`
- 常见字符串：`collector`, `challenge`, `sensor`

**网络特征：**
- 收集器端点：`/px/xhr/` 或 `/api/v1/collector`
- 挑战接口：`/captcha/` 或 `/challenge/`
- 响应头可能含 `x-px-challenge`

**指纹特征：**
- 多层次检测：静态指纹 + 行为 + 请求签名
- 对 `Function.prototype.toString` 检测严格
- 频繁的自校验（anti-tamper）
- 深度DOM结构分析

**突破策略：**
- toString伪装必须完美
- 自校验绕过优先（preload注入优于运行时patch）
- 请求签名分析是关键（X-px-header系列）
- 参考：`anti-tamper-playbook.md` + `signature-playbook.md`

---

### 2.5 reCAPTCHA / hCaptcha

**reCAPTCHA特征：**
- `grecaptcha` 全局对象
- `<div class="g-recaptcha">`
- 企业版可能有额外脚本加载
- 令牌：`g-recaptcha-response`

**hCaptcha特征：**
- `hcaptcha` 全局对象
- `<div class="h-captcha">`
- 企业版有自定义配置
- 令牌：`h-captcha-response`

**突破策略：**
- 验证码自动化不在本技能范围内（需专门服务）
- 但分析token生成和验证链是相关的
- 参考：`challenge-orchestration-playbook.md`

---

### 2.6 Kasada

**脚本特征：**
- 脚本URL动态生成，含 `kasada`
- 全局对象特征不明显（有意隐藏）
- 使用 WebAssembly 进行核心检测
- 强烈的代码虚拟化特征

**网络特征：**
- 端点：`/api/` 或 `/kp2/` 路径
- 响应头可能含 `x-kpsdk-...`
- 拦截时返回 429 或重定向到挑战页

**指纹特征：**
- 重度使用WASM进行指纹计算
- JS侧代码高度虚拟化（JSVMP）
- 动态令牌生成，与WASM输出绑定

**突破策略：**
- WASM分析优先（见 `wasm-runtime-playbook.md`）
- JSVMP黑盒复用优先
- 浏览器可控复用是最可行路径
- 参考：`wasm-runtime-playbook.md` + `jsvmp` + `browser-controlled-reuse-playbook.md`

---

### 2.7 瑞数 (Riversecurity)

**脚本特征：**
- 全局对象 `window.$_ts`（核心动态混淆状态），及 `$_ts.nsd`/`$_ts.cd` 等子字段
- 大量动态生成的混淆变量名（如 `MSR`、`HMqg` 之类随会话变化的随机标识符）
- 外链脚本路径含随机串，主逻辑为 JSVMP / 自定义 VM（动态 VMP）
- meta/script 中常见 `content` cookie 相关注入逻辑

**网络特征：**
- 关键 cookie：`$_ts` 系列与 content cookie（首个 HTML 内 `<meta>` 或脚本写入）
- **典型二次请求重放特征**：首个请求返回 **412**（含挑战脚本），执行后带 content cookie 重放才放行
- 动态 token 随请求变化，强时效

**指纹/突破策略：**
- 核心是还原 `$_ts` VMP 的 cookie 生成逻辑（动态 VMP，JSVMP 黑盒复用优先）
- 浏览器可控复用最稳；扣代码需处理动态混淆变量名漂移
- 参考：`vmp-playbook.md` + `wasm-jsvmp-bridge-playbook.md` + `browser-controlled-reuse-playbook.md`

---

### 2.8 阿里系 (Alibaba WAF / Anti-Bot)

**脚本特征：**
- 滑块/JS 挑战脚本常含 `/aliwaf` 路径或 `umsdk`/`um.js` 设备指纹采集
- cookie 生成逻辑由混淆 JS 计算

**网络特征：**
- 关键 cookie：`acw_sc__v2`（Anti-Bot JS 计算）、`acw_tc`、`__jsl_clearance`（JS 挑战放行）、`cdn_sec_tc`
- 命中 WAF 时返回挑战页（含计算 `acw_sc__v2` 的混淆脚本），计算回填后重放放行
- `/aliwaf` 或滑块验证接口行为

**指纹/突破策略：**
- `acw_sc__v2` / `__jsl_clearance` 的生成是纯 JS 计算，**扣代码 / 补环境**可行（依赖较轻时优先）
- 重混淆或绑设备指纹时转浏览器可控复用
- 参考：`closure-extraction-playbook.md` + `vmp-playbook.md`

---

### 2.9 极验 / 数美 / 网易易盾

**极验 (Geetest)：**
- 全局对象 `window.initGeetest`（v3）/ `initGeetest4`（v4）、`gt`/`challenge` 参数
- 脚本 URL 含 `geetest`（如 `static.geetest.com`），滑块/点选/无感验证
- 突破：行为验证码，自动化不在本技能范围（需专门服务）；但 `gt`/`challenge`/`validate`/`seccode` 链路分析相关

**数美 (Shumei)：**
- 全局对象 / SDK 命名含 `SMSdk`、`smdeviceid`；cookie/字段含 `smid`（设备指纹）
- 脚本 URL 含 `fp.shumei` / `castle` 等；核心是设备指纹采集 + 服务端风控
- 突破：设备指纹一致性（`smid` 稳定回填）+ 行为；指纹层参考 `fingerprint-playbook.md`

**网易易盾 (Dun)：**
- 全局对象 `window.NECaptcha` / `initNECaptcha`；脚本 URL 含 `dun.163.com` / `nstatic.dun.163.com`
- 滑块/智能无感验证码，参数含 `captchaId`/`validate`
- 突破：行为验证码（同上自动化需专门服务），链路分析参考 `challenge-orchestration-playbook.md`

> 上述三家均为行为/设备验证码 + 服务端风控为主，核心信号在**全局对象 / cookie / 脚本 URL 域名**；命中 VMP / WASM 加固时进一步走 `vmp-playbook.md` / `wasm-runtime-playbook.md`。

---

## 3. 快速识别流程

```
Step 1: 检查全局对象
  - window.bmak → Akamai
  - window.turnstile → Cloudflare Turnstile
  - window.DataDome → DataDome
  - window._px / _pxAppId → PerimeterX
  - window.grecaptcha → reCAPTCHA
  - window.hcaptcha → hCaptcha
  - window.$_ts → 瑞数 (Riversecurity)
  - window.initGeetest / initGeetest4 → 极验
  - window.initNECaptcha / NECaptcha → 网易易盾
  - window.SMSdk / smdeviceid → 数美

Step 2: 检查Cookie
  - _abck, bm_sz, akamai → Akamai
  - __cf_bm, cf_clearance → Cloudflare
  - datadome, dd_ → DataDome
  - pxcts, _px2, _px3 → PerimeterX
  - $_ts 系列 + content cookie + 首请求 412 重放 → 瑞数
  - acw_sc__v2, acw_tc, __jsl_clearance → 阿里系
  - smid → 数美

Step 3: 检查脚本URL/内容
  - 含 "akamai" / "bmak" → Akamai
  - 含 "turnstile" / "challenges.cloudflare" → Cloudflare
  - 含 "datadome" → DataDome
  - 含 "perimeterx" / "px" → PerimeterX
  - 含 "kasada" → Kasada

Step 4: 检查响应头
  - x-akamai-... → Akamai
  - cf-ray → Cloudflare CDN（不一定开bot管理）
  - x-dd-... → DataDome
  - x-px-... → PerimeterX

Step 5: 检查挑战页面结构
  - Turnstile widget DOM → Cloudflare
  - reCAPTCHA badge → Google
  - hCaptcha iframe → hCaptcha
  - 自定义JS challenge → 可能是Cloudflare/Akamai/其他
```

---

## 4. 保护强度评估

根据识别的保护方案，快速评估任务难度：

| 保护方案 | 基础保护 | 中级保护 | 高级保护 |
|---------|---------|---------|---------|
| Cloudflare | 纯Turnstile | Turnstile + BM | Enterprise + 自定义规则 |
| Akamai | 基础sensor | Bot Manager | Advanced + 自定义脚本 |
| DataDome | 基础指纹 | 完整指纹+行为 | 高级+ ML风控 |
| PerimeterX | 基础PX | Bot Defender | Code Defender + 高级 |
| Kasada | 基础WASM | JSVMP+WASM | 多层+动态 |

---

## 5. 交付要求

命中商业保护时，至少补充：

- `run/commercial-protection-identification.json`
  ```json
  {
    "identified": true,
    "provider": "DataDome",
    "confidence": "high",
    "evidence": {
      "globalObjects": ["DataDome"],
      "cookies": ["datadome"],
      "scriptUrls": ["https://.../datadome..."],
      "responseHeaders": ["x-dd-b"]
    },
    "protectionTier": "T5",
    "combinationTopics": ["fingerprint", "behavior-telemetry", "challenge-orchestration"]
  }
  ```
- `run/commercial-protection-notes.md`

---

## 6. 常见误区

- 看到 `cf-ray` 头就断定有Cloudflare Bot Management（可能只是CDN）
- 混淆 Akamai CDN 和 Akamai Bot Manager（前者只加速，后者才有bot检测）
- 忽略保护方案的版本演进（旧版特征可能不适用）
- 将基础验证码（reCAPTCHA v2）误认为高级保护
- 未识别多保护方案共存（如Cloudflare + DataDome同时使用）
