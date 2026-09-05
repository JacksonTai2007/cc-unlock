# TLS / HTTP Fingerprint Playbook

Version: 1

适用场景：目标站点的风控系统不仅检测浏览器侧特征，还检测传输层和应用层的客户端指纹，包括：
- TLS指纹（JA4 为现代浏览器主用，JA3/JA3S 仅用于旧客户端/库识别）
- HTTP/2指纹（h2指纹、SETTINGS帧、WINDOW_UPDATE）
- HTTP Header顺序和组合特征
- TCP/IP栈行为特征

这些指纹常与前端保护协同工作，构成完整的客户端画像。

---

## 1. TLS指纹（JA4 主轴，JA3 / JA3S 仅旧客户端识别）

> **2026 现实，先记住这条**：Chrome 自启用 **TLS 扩展乱序（extension shuffling）** 后，同一浏览器每次握手的扩展顺序都变，导致 **JA3 对现代浏览器近乎失效**（哈希漂移）。当前风控主用 **JA4**（扩展排序后再哈希，对乱序稳定）。因此**默认以 JA4 为一等公民**，JA3 仅用于识别旧客户端、命令行库（curl/python）这类扩展顺序固定的目标。

### 1.1 基本概念

**JA4**（当前主用）：JA4+ 指纹族，对 TLS Client Hello 的协议版本、密码套件、扩展（**排序后**）、ALPN、签名算法等做结构化摘要。因对扩展乱序稳定，是识别现代浏览器的主指纹；其族成员还覆盖 JA4S（服务端）、JA4H（HTTP）、JA4T（TCP）等。

**JA3**（仅旧客户端/库）：对 TLS Client Hello 的 SSLVersion、Cipher Suites、Extensions（**按原始顺序**）、Elliptic Curves、Point Formats 做 MD5。因扩展顺序敏感，对现代浏览器漂移、失效；仍可用于识别扩展顺序固定的 curl/python/Go 等库。

**JA3S / JA4S**：服务器端对应的 Server Hello 指纹。

### 1.2 识别信号

- 使用真实浏览器访问成功，但使用脚本（Python requests、curl）访问被拦截
- 同一脚本在不同机器上表现不同（TLS库版本不同导致JA3不同）
- 更换HTTP库（requests → urllib → httpx）后访问结果不同
- 响应头包含 `ja3_hash` 相关调试信息（部分站点开启调试时可见）

### 1.3 采集方法

**浏览器端 JA4/JA3**：
```
浏览器访问 https://tls.peet.ws/api/all
→ 同时返回 JA3 与 JA4（以及 JA4H/H2 指纹），直接读现成结果，无需自建解析
→ 需要原始 Client Hello 时再在代理层抓包，用 JA4 工具（排序后）计算
```

**脚本端指纹**：
```python
# requests/urllib3 的扩展顺序固定，JA3 稳定但与浏览器不同 → 易被风控判为"非浏览器"
# 直接访问 https://tls.peet.ws/api/all 对比脚本与浏览器的 JA4/JA3 差异
```

**在线检测服务（已剔除失效项）**：
- `https://tls.peet.ws/`（**首选**，同时给 JA3 + JA4 + JA4H + H2 指纹）
- `https://browserleaks.com/tls`（浏览器 TLS 信息，含 JA3/JA4）
- Cloudflare JA3/JA4 公开文档（核对各浏览器基准指纹）
- ⚠️ 不要再用 `ja3er.com`：长期不可用，且丢弃 ALPS 扩展产出无效 JA3。

### 1.4 对抗策略

| 场景 | 策略 |
|------|------|
| Python脚本被拦截 | **首选 `curl_cffi`**：`impersonate="chrome"`（或 pin 具体版本）一并覆盖 JA3/JA4/HTTP2 framing，当前 Python 侧主流 |
| 需要自定义指纹 | Go 用 `utls`（支持 JA3/JA4 伪装与扩展乱序）；`ja3transport` 仅旧 JA3 场景 |
| Node 脚本被拦截 | **优先 Playwright/Puppeteer 真实浏览器栈**（JA3/JA4/H2 自动一致）。纯 Node 脚本需 TLS 伪装时：Node 原生 `tls`/`https` 模块**无法改 ClientHello 扩展顺序与扩展集**，做不到浏览器级 JA3/JA4 伪装 → 走**外部代理中转**（如 `curl_cffi` 起本地服务，或 Go `utls` 代理层），Node 侧只发普通请求经该代理出网 |
| Playwright/Puppeteer | 走真实浏览器 TLS 栈，JA3/JA4 自动一致，通常无需处理 |
| 移动端模拟 | 注意移动端 TLS 栈与桌面端不同，`curl_cffi` 也提供移动端 profile |

**推荐工具**：
- `curl_cffi`（**2026 主流**）：Python 库，`impersonate="chrome"` 或 pin 版本，覆盖 JA3/JA4/HTTP2 framing；建议 pin 版本 + 季度审计（浏览器基准指纹会随版本漂移）
- `utls`：Go TLS 库，支持 JA3/JA4 伪装与扩展乱序
- `ja3transport`：Go，仅自定义旧 JA3

---

## 2. HTTP/2指纹

### 2.1 基本概念

HTTP/2连接建立时，客户端发送的初始帧序列具有特征性：
- SETTINGS帧（客户端设置参数）
- WINDOW_UPDATE帧（流控窗口更新）
- 首部压缩表（HPACK）的动态表行为

不同客户端（Chrome、Firefox、Safari、cURL、Python requests）的H2指纹不同。

### 2.2 识别信号

- HTTP/2连接被服务器拒绝或降级到HTTP/1.1
- 仅当使用HTTP/2时才会触发拦截
- 抓包发现H2 SETTINGS帧参数与浏览器不一致

### 2.3 采集方法

使用 `nghttp` 或 Wireshark 抓包分析：
```bash
# 使用nghttp查看H2细节
nghttp -v https://www.example.com

# 使用curl查看协议版本
curl -I --http2 https://www.example.com
```

### 2.4 对抗策略

- 使用支持H2的库（`httpx[http2]`, `hyper`）
- 确保H2 SETTINGS帧与目标浏览器一致
- Playwright/Puppeteer自动使用浏览器H2栈，通常无需处理
- 注意HTTP/2 Prior Knowledge vs Upgrade的差异

---

## 3. HTTP Header指纹

### 3.1 常见指纹向量

**Header集合**：
- 真实浏览器发送的默认header（`Accept`, `Accept-Language`, `Accept-Encoding`, `User-Agent`）
- 脚本库通常缺少某些header或顺序不同

**Header顺序**：
- Chrome: `:authority`, `:method`, `:path`, `:scheme`
- 然后是 `user-agent`, `accept`, `accept-encoding`, `accept-language`
- 不同客户端顺序不同

**Cookie行为**：
- `SameSite` 策略处理
- `Secure`/`HttpOnly` 标记的遵守情况
- 第三方cookie策略

### 3.2 识别与对抗

**采集基准**：

H2 header 顺序 / 伪首部（`:method` `:path` `:scheme` `:authority`）顺序是 datadome/akamai 的强判据，**必须拿到真实顺序而非手填占位**。来源（任选其一，优先第一条）：

```
1. 浏览器访问 https://tls.peet.ws/api/all，直接读 http2.sent_frames[] 里
   type=HEADERS 的 .headers 数组——它就是浏览器实际上线的 header 顺序（含伪首部），
   照抄进 run/tls-http-fingerprint-profile.json 的 browserOrder
2. 没有外网时用 Wireshark 抓目标域 H2 流量，过滤 http2.header，
   按帧内出现顺序读 header name 序列
```

```javascript
// 脚本侧自查发送顺序（与上面浏览器基准对比，找出缺失/错序的 header）
// 注意 fetch/XHR 无法读到底层 H2 帧顺序，需在代理层或用上面两种手段采集
```

> 把 §6 工具表里 tls.peet.ws 的产出（JA4+JA3+H2+H2 header 顺序）当作 `browserOrder` 的唯一真值来源，不要凭印象手填。

**对抗策略**：
- 完全复制浏览器的header集合和顺序
- 不要添加脚本库特有的header（如 `python-requests/...`）
- 处理cookie时遵循与浏览器相同的策略

---

## 4. 综合检测思路

现代风控系统通常组合多层指纹：

```
TCP/IP层：TTL、窗口大小、DF标志、时间戳行为
TLS层：JA4（现代浏览器主用）/ JA3（旧客户端识别）、SNI、ALPN
HTTP/2层：SETTINGS、WINDOW_UPDATE、优先级帧
HTTP层：Header集合、顺序、cookie策略
JS层：浏览器指纹、行为遥测、挑战响应
```

**突破原则**：
1. 先确认哪一层触发了拦截（逐层排除）
2. 如果JS层已通过但请求仍失败，重点检查TLS/H2层
3. 使用浏览器可控复用（Puppeteer/Playwright）可自动解决TLS/H2问题
4. 纯脚本请求需要额外处理TLS指纹

---

## 5. 交付要求

命中传输层指纹问题时，至少补充：

- `run/tls-http-fingerprint-notes.md`
- `run/tls-http-fingerprint-profile.json`
  ```json
  {
    "ja4": {
      "browser": "t13d1516h2_8daaf6152771_...",
      "script": "t13d1234h1_aaaa_...",
      "mismatch": true,
      "note": "现代浏览器以 JA4 为准；JA3 仅作旧客户端识别"
    },
    "ja3": {
      "browser": "769,47-53-5-10-...",
      "script": "769,49195-49196-...",
      "mismatch": true
    },
    "http2": {
      "browserSettings": { "HEADER_TABLE_SIZE": 65536, ... },
      "scriptSettings": null,
      "mismatch": true
    },
    "headers": {
      "browserOrder": ["user-agent", "accept", "accept-encoding"],
      "browserOrderSource": "tls.peet.ws http2.sent_frames[].headers（勿手填占位）",
      "scriptOrder": ["accept", "user-agent"],
      "mismatch": true
    }
  }
  ```

---

## 6. 工具推荐

| 用途 | 工具 |
|------|------|
| JA4/JA3 查看 | **tls.peet.ws（首选，给 JA4+JA3+H2）**, browserleaks.com/tls, Cloudflare JA3/JA4 文档（不再用 ja3er.com） |
| 指纹模拟（Python） | **curl_cffi（主流，impersonate="chrome"，覆盖 JA3/JA4/H2）** |
| 指纹模拟（Go） | utls（JA3/JA4 + 扩展乱序）, ja3transport（仅旧 JA3） |
| 指纹模拟（Node） | **优先 Playwright/Puppeteer 真实浏览器栈**；纯 Node 脚本无法改 ClientHello（原生 `tls` 限制），需经 `curl_cffi`/`utls` 外部代理中转出网 |
| H2分析 | nghttp, Wireshark |
| 全栈指纹 | fingerprintjs.com（对比用） |
| 自动化浏览器 | Playwright with H2 enabled |
