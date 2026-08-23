# 协议重建与请求验收

使用场景：签名/加密参数还原、本地请求验收、API 调试、WebSocket/SSE 协议解析。

文件名仍保留 `web-replay.js`，但它的默认职责是“本地请求脚本 / 请求验收脚本”，不是强制追求浏览器端逐字节重放。

## 参数结构还原

- 同操作执行两次，先 diff 请求体，分离静态字段、动态字段、会话字段
- `timestamp / nonce / random seed` 要追踪生成逻辑，不要直接硬写常量
- `HMAC / sign / digest` 要区分“输入边界正确”与“最终字节一致”
- `token / cookie / signer state` 要补生命周期：登录、签发、过期、刷新、失效

## 默认验收原则

- 默认成功条件是“本地能生成必要参数并成功请求接口 / 获得预期响应”
- 只有用户明确要求时，才把“浏览器端最终字节或密文一致”设为主目标
- 对 `RSA / OAEP / PKCS#1 v1.5 / random iv / salt / padding` 场景，应优先验证下游解密、验签或接口验收，而不是比较密文字节

## web-replay.js 模板（Node.js）

```javascript
#!/usr/bin/env node
"use strict";

const https = require("https");
const { URL } = require("url");

const BASE_URL = "https://target.example";
const ENDPOINT = "/api/v1/resource";

function resolveClock() {
  throw new Error("replace with captured clock source");
}

function resolveNonce() {
  throw new Error("replace with captured nonce / random source");
}

function loadSessionState() {
  return {
    cookie: "replace-with-cookie",
    headers: {},
    signerState: {}
  };
}

function buildRequestArtifacts(input, sessionState) {
  const timestamp = resolveClock();
  const nonce = resolveNonce();

  return {
    timestamp,
    nonce,
    headers: {
      ...sessionState.headers
    },
    body: input
  };
}

async function request(method, path, input = {}) {
  const sessionState = loadSessionState();
  const artifacts = buildRequestArtifacts(input, sessionState);
  const body = JSON.stringify(artifacts.body);
  const url = new URL(path, BASE_URL);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionState.cookie,
          ...artifacts.headers,
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: data });
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const result = await request("POST", ENDPOINT, { replace: "me" });
  console.log("[acceptance] status:", result.status);
  console.log("[acceptance] body:", result.body);
})();
```

## 额外说明

- `web-replay.js` 里所有动态输入都应来自已捕获的真实边界，不要默认 `Date.now()` 或 `Math.random()`
- 如果任务确实要求“最小 replay”，也必须先完成输入边界和状态边界映射
- 若本地请求脚本能稳定获得响应，但签名字节与浏览器端不同，优先记录非确定性来源，而不是把任务判成失败
- 如果用户显式要求“本地复现”且目标是 API，`web-replay.js` 必须作为 API 调用示例打印响应数据或响应摘要

## WebSocket / SSE 帧解析

- JSON 字符串: 直接解析
- `0x08 / 0x0A` 开头: 疑似 protobuf，可用 `protoc --decode_raw`
- `0x82` 到 `0x8F` 开头: 疑似 msgpack fixmap / fixarray
- XOR 混淆: 从已知明文推导 key

## 交付物补充

- `crypto_params.json`: 捕获的 key / iv / nonce / ts / 明文 / 密文 / 验证方式
- `token_flow.md`: token 生成、过期、刷新流程
