# Media DRM Playbook

适用场景：

- 命中 `MediaSource / encrypted / requestMediaKeySystemAccess / license / m3u8 / mpd`
- 需要分析播放 token、license request、播放器调度和受保护链路
- 媒体访问控制与风控或 session 强绑定
- **需要恢复视频/音频的明文边界或可复现的解密链（模式 B）**

---

## 任务模式判定

### 模式 A：License 链路分析
- 目标：恢复 license request 的构造逻辑和 token 输入边界
- 适用：用户只需要理解授权链路
- 交付：`run/license-flow.md` + `run/token-inputs.json`

### 模式 B：内容解密 / 帧明文边界恢复
- 目标：恢复加密 segment -> 明文 frame 的转换链
- 适用：用户需要可验证的解密结果或明文样本
- 额外交付：
  - `run/frame-decryption-chain.md`
  - `run/key-session-timeline.json`
  - `run/clear-frame-samples/`
  - `run/verify-decryption.mjs`

**模式判定方法**：首轮必须询问或推断用户目标。若用户明确提到"视频帧""解密""明文""还原内容"，默认走模式 B。

### 合规声明
- 模式 B 仅在用户明确请求且用于本地验证时执行
- 不承诺绕过商业 DRM 的完整保护链（如 Widevine L1 硬件 CDM）
- 交付物不得用于大规模内容提取或分发

---

## 工作顺序

1. 区分 MSE、EME、playlist token 和 license server 四层
2. 识别加密模式（HLS Sample-AES / DASH CENC / CBCS / ClearKey）
3. 记录 manifest、segment、license request 的输入边界
4. 明确播放器 JS 在什么阶段构造 token 或 headers
5. **模式 B 额外：识别密钥来源和明文边界，优先黑盒复用**
6. 最后给出可复验步骤和受限边界

---

## 加密模式识别

| 特征 | 模式 | 后续路径 |
|---|---|---|
| m3u8 + `#EXT-X-KEY` | HLS Sample-AES | 追 key URI + IV |
| mpd + `ContentProtection` | DASH CENC/CBCS | 追 pssh + license |
| direct mp4 + `saio/saiz/senc` box | 裸 CENC | 追 moov/pssh |
| `clearkey://` 或 Key ID 明文 | ClearKey | 直接提取 key |
| `requestMediaKeySystemAccess('com.widevine.alpha')` | Widevine | 标准 EME 流程 |
| `requestMediaKeySystemAccess('com.microsoft.playready')` | PlayReady | 标准 EME 流程 |

---

## 模式 A：License 链路分析

### 1. 区分四层

```
MSE (Media Source Extensions)
  └── EME (Encrypted Media Extensions)
        └── CDM (Content Decryption Module)
              └── License Server
```

### 2. 追踪 EME 事件序列

```javascript
const video = document.querySelector('video');

video.addEventListener('encrypted', e => {
    console.log('[EME] encrypted', {
        initDataType: e.initDataType,
        initDataLength: e.initData.byteLength
    });
});

// MediaKeys 创建后
const mediaKeys = await navigator.requestMediaKeySystemAccess(keySystem, config)
    .then(access => access.createMediaKeys());

const session = mediaKeys.createSession();
session.addEventListener('message', e => {
    console.log('[EME] license request', {
        messageType: e.messageType,
        messageLength: e.message.byteLength
    });
});
session.addEventListener('keystatuseschange', e => {
    for (const [keyId, status] of session.keyStatuses) {
        console.log('[EME] key status', { keyId: bytesToHex(keyId), status });
    }
});
```

### 3. 记录 Token 输入边界

license request 通常携带：
- `authorization` header
- `x-drm-token` / `x-playback-token`
- cookie 中的 session id
- request body 中的 challenge / device info

必须记录：哪个参数是从哪里来的（cookie / storage / JS 生成 / JSVMP 输出）。

---

## 模式 B：内容解密 / 帧明文边界恢复

### 核心原则：优先黑盒，次发明文边界，最后才拆内部

与 `SKILL.md` 的 VM/WASM/DRM 特别规则一致：
1. **浏览器黑盒复用**（最高优先级）
2. **明文边界 / clear boundary / requestVideoFrameCallback / canvas capture**
3. **Node 复用原始 worker / wasm**
4. **纯算法提取**
5. **最后才是 dispatcher / slot / bytecode 深拆**

### B1. 黑盒复用路线

目标：不拆内部，直接在浏览器环境获取解密结果。

#### 方案 A：`requestVideoFrameCallback`（Chrome 90+）
```javascript
const video = document.querySelector('video');
video.requestVideoFrameCallback((now, metadata) => {
    // metadata 证明解密发生（含 presentationTime / expectedDisplayTime / width / height）
    console.log('[clear-frame] metadata', metadata);
});
```

#### 方案 B：Canvas 捕获可见帧
```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const video = document.querySelector('video');

video.addEventListener('play', () => {
    const capture = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        console.log('[clear-frame] canvas capture', dataUrl.slice(0, 100));
    };
    setInterval(capture, 1000);
});
```

#### 方案 C：`MediaRecorder` 录制解码流
```javascript
const stream = video.captureStream();
const recorder = new MediaRecorder(stream);
const chunks = [];

recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
};
recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    console.log('[clear-frame] recorded blob', blob.size);
};

recorder.start(1000);
setTimeout(() => recorder.stop(), 5000);
```

#### 黑盒验证判据
- [ ] 视频可正常播放（排除网络/编码问题）
- [ ] 上述任一方案能稳定捕获到非空数据
- [ ] 捕获数据与播放进度同步（时间戳递增，非静态帧）
- [ ] 若为 canvas capture，肉眼可见与播放内容一致

### B2. 明文边界路线

当黑盒无法直接获取可用输出时，定位"加密数据进入解码器后的明文边界"。

#### B2.1 追踪 SourceBuffer 操作
```javascript
const origAppend = SourceBuffer.prototype.appendBuffer;
SourceBuffer.prototype.appendBuffer = function(data) {
    console.log('[MSE] appendBuffer', {
        timestampOffset: this.timestampOffset,
        updating: this.updating,
        bufferedStart: this.buffered.length > 0 ? this.buffered.start(0) : null,
        byteLength: data.byteLength,
        first16Bytes: Array.from(new Uint8Array(data.slice(0, 16)))
            .map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    return origAppend.call(this, data);
};

const origRemove = SourceBuffer.prototype.remove;
SourceBuffer.prototype.remove = function(start, end) {
    console.log('[MSE] remove', { start, end });
    return origRemove.call(this, start, end);
};
```

#### B2.2 追踪解码就绪信号
```javascript
session.addEventListener('keystatuseschange', () => {
    for (const [keyId, status] of session.keyStatuses) {
        if (status === 'usable') {
            console.log('[EME] key usable', bytesToHex(keyId));
            // 此后 appendBuffer 的 segment 可被解密解码
        }
    }
});
```

**明文边界判定**：当 `keyStatus === 'usable'` 且后续 `appendBuffer()` 的 segment 能被正常解码播放时，**该 segment 经解码器输出即为明文边界**。

### B3. 非 CDM 路径（Pure Algorithm）

适用于：JS/WASM 直接解密 segment，不经过 EME/CDM。

#### 识别特征
- 没有 `requestMediaKeySystemAccess` 调用
- 有 `SubtleCrypto.decrypt()` 或 `CryptoJS.AES.decrypt()`
- 解密后数据直接 `appendBuffer()` 到 MSE
- WASM 模块接收加密 segment、输出解密 segment

#### 追踪方法
与 `signature` / `userland-crypto` / `wasm` 专题一致：
1. hook `crypto.subtle.decrypt()` 或 WASM exports
2. 捕获 key / iv / algorithm 参数
3. 捕获 ciphertext / plaintext 样本对
4. 本地复现解密

### B4. CDM Message 分析路线（受限路径）

适用于：必须使用硬件/软件 CDM，且黑盒/明文边界均不可行。

#### 追踪 license request/response
```javascript
session.addEventListener('message', async e => {
    console.log('[EME] CDM message', {
        messageType: e.messageType,
        length: e.message.byteLength,
        firstBytes: new Uint8Array(e.message.slice(0, 32))
    });

    const response = await fetch(licenseServerUrl, {
        method: 'POST',
        body: e.message,
        headers: { 'Content-Type': 'application/octet-stream' }
    });
    const license = await response.arrayBuffer();
    console.log('[EME] license response', { length: license.byteLength });
    await session.update(license);
});
```

#### B4.1 EME 全链 hook 片段（抓 keySystem / challenge / response）

对 ClearKey / Sample-AES / CENC CBCS 这类**可在浏览器内拿到 key 提取边界**的场景，比"只追 key URI / pssh"更直接的是在页面加载前 hook 整条 EME 链，把 keySystem 配置、license challenge 与 response 全抓下来（key 提取的输入边界都在这三处）：

```javascript
// preload / add_script_to_evaluate_on_new_document 注入：在播放器拿到 EME 前埋好 hook
const b2h = (buf) => Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');

// 1) keySystem 与 robustness 配置（决定 L1/L3、CENC/CBCS 选择）
const _rmksa = navigator.requestMediaKeySystemAccess;
navigator.requestMediaKeySystemAccess = function (keySystem, configs) {
    console.log('[EME] requestMediaKeySystemAccess', {
        keySystem,
        // robustness / 加密方案常决定能否走 ClearKey 软解
        configs: configs?.map(c => ({
            initDataTypes: c.initDataTypes,
            videoRobustness: c.videoCapabilities?.map(v => v.robustness),
            audioRobustness: c.audioCapabilities?.map(a => a.robustness)
        }))
    });
    return _rmksa.apply(this, arguments);
};

// 2) session 创建（拿到 sessionType：temporary / persistent-license）
//    message 监听在此一次性挂到 session，避免 persistent-license / renewal 下
//    同一 session 多次 generateRequest 重复绑定、同一条 message 被打印多次。
const _createSession = MediaKeys.prototype.createSession;
MediaKeys.prototype.createSession = function (sessionType) {
    console.log('[EME] createSession', { sessionType });
    const session = _createSession.apply(this, arguments);
    // 关键：CDM 在 session 的 message 事件里才产出真正出网的 challenge body，必须挂监听才能抓到。
    // 用 __msgHooked 去重保护，确保每个 session 只绑定一次（防御性兜底，即便创建路径有变也不会重复绑）。
    if (session && !session.__msgHooked) {
        session.__msgHooked = 1;
        session.addEventListener('message', function (e) {
            console.log('[EME] session.message (出网 challenge)', {
                messageType: e.messageType,   // license-request / license-renewal / individualization-request
                challengeHex: b2h(e.message)  // 真正 POST 给 license server 的 body
            });
        });
    }
    return session;
};

// 3) license challenge（generateRequest 的 initData 即 challenge 输入边界）
const _genReq = MediaKeySession.prototype.generateRequest;
MediaKeySession.prototype.generateRequest = function (initDataType, initData) {
    console.log('[EME] generateRequest', {
        initDataType,
        initDataHex: b2h(initData)   // CENC 下含 pssh；ClearKey 下含 keyId
    });
    // 注意：generateRequest.initData 只是输入边界（pssh/keyId），不是发往 license server 的 body；
    // 真正出网的 challenge body 由上面 createSession 处一次性挂的 message 监听抓取。
    return _genReq.apply(this, arguments);
};

// 4) license response（update 的入参即 license server 返回；ClearKey 下直接含明文 key/JWK）
const _update = MediaKeySession.prototype.update;
MediaKeySession.prototype.update = function (response) {
    let preview = b2h(response).slice(0, 128);
    // ClearKey license 是 JSON（含 base64url 的 k/kid），尝试当文本读一眼
    try { preview = new TextDecoder().decode(response).slice(0, 256); } catch {}
    console.log('[EME] session.update (license response)', { preview });
    return _update.apply(this, arguments);
};
```

判读：
- `requestMediaKeySystemAccess` 的 `keySystem === 'org.w3.clearkey'` 或 robustness 为空/`SW_SECURE_*` → 大概率可在浏览器内拿到 key（走 ClearKey / 软解边界）。
- `generateRequest` 的 `initData` 是 challenge 的输入边界（CENC 含 pssh，ClearKey 含 keyId）。
- **三者别混**：`generateRequest.initData` = 输入边界（pssh/keyId）／`session` 的 `message` 事件 `e.message` = 真正出网的 challenge body（POST 给 license server）／`update(response)` = license server 回包。只 hook `generateRequest` 抓不到出网 body，必须监听 `message` 事件。
- `session.update` 的 `response`：**ClearKey 下直接是含 `k`/`kid`（base64url）的 JSON license**，hook 即可取到 content key，无需再追 license server。
- 与 §B2.1 的 `appendBuffer` hook 配合，可把"key 可用时间点"与"加密 segment"对齐，定位明文边界。

#### 受限说明
- Widevine L1 / PlayReady Hardware 的 CDM 内部解密逻辑不可见
- 本路线的交付上限是"license 完整链路 + 密钥派生边界"，不是"content key 提取"
- 若 license response 经过 JSVMP 处理，结合 `jsvmp` 专题分析处理逻辑

---

## 与 JSVMP 专题的联动

当同时命中 JSVMP 和 DRM 时（复合保护层级 T7）：

### 优先级判定
```
if (JSVMP 在 license response 之后执行):
    -> 优先处理 media-drm（获取 license）
    -> 然后处理 jsvmp（分析 license 后处理逻辑）
elif (JSVMP 在 generateRequest 之前执行):
    -> 优先处理 jsvmp（分析 initData 构造）
    -> 然后处理 media-drm（标准 EME 流程）
elif (JSVMP 直接替代 CDM，做纯算法解密):
    -> 按模式 B3（非 CDM 路径）处理
    -> jsvmp 分析密钥派生，media-drm 验证明文输出
```

### 复合追踪模板
```javascript
// 同时 hook EME 和 VM boundary
hookMediaKeys();
hookVmConstructor(window, 'VM');

// 关联分析：VM 执行时机与 EME 事件的时序关系
// 产出：timeline showing encrypted -> VM execute -> session.update -> key usable
```

---

## 最低交付

### 模式 A
- `run/license-flow.md`
- `run/token-inputs.json`
- `run/verify-once.mjs`

### 模式 B
- `run/license-flow.md`（license 链路仍需要）
- `run/token-inputs.json`
- `run/frame-decryption-chain.md`
- `run/key-session-timeline.json`
- `run/clear-frame-samples/`（至少一个明文帧样本）
- `run/verify-decryption.mjs`

命中 JSVMP 时，额外补充：
- `run/vm-trace.jsonl`
- `run/dispatcher-map.md`（若进入深拆）

---

## 注意事项

- 首轮必须判定模式 A 还是模式 B，不要默认只做 license 分析
- 模式 B 下优先黑盒复用，不要一上来就深拆 CDM 或 JSVMP
- 不要忽略 `video.requestVideoFrameCallback` 和 `canvas.drawImage(video)` 的价值
- 含 JSVMP 时，注意 license response 处理链路的 VM 介入点
- 不要把"container 可识别、ffprobe 可读"误判为整体已解密；需验证实际帧数据
- 请求失败时先回看加密模式识别和 key status，不要直接怀疑算法本体
- 若 swap matrix 已证明"只换本地环境就失败"，优先追 signer state / key session 写入链
