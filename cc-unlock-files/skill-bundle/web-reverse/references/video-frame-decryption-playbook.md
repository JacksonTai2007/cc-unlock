# Video Frame Decryption Playbook

Version: 1

适用场景：
- 视频 segment 经过 EME/CDM 加密，需要恢复明文帧或可复现的解密链
- JSVMP 或 WASM 介入密钥派生、license 处理或 segment 解密
- 目标不是"分析 license 链路"，而是"恢复加密 segment -> 明文 frame 的转换边界"

本 playbook 是 `media-drm-playbook.md` 模式 B 的专项展开。当用户目标包含"视频帧""解密""明文""还原内容"时，优先使用本 playbook。

---

## 1. 快速分流（必须先做）

### 1.0 首轮门禁

在进入“猜测算法 / 大规模样本对比 / 纯算法迁移”前，必须先明确：
- `boundaryStatus`：是完整 segment / PES / NAL / frame，还是只有局部切片
- `familyShortlist`：当前优先排查的标准家族 / 编解码家族
- `directCallDecision`：是否已经检查 wasm export / browser internal call / appendBuffer 前后的真实边界
- `searchDecision`：若已拿到样本但模式不透明，是否已做外部搜索纠偏

如果以上任一项缺失，不要把局部字节差异升级成“自定义解密算法”。

### 1.1 识别加密模式

| 特征 | 模式 | 后续路径 |
|---|---|---|
| m3u8 + `#EXT-X-KEY` | HLS Sample-AES | 追 key URI + IV |
| mpd + `ContentProtection` | DASH CENC/CBCS | 追 pssh + license |
| direct mp4 + `saio/saiz/senc` box | 裸 CENC | 追 moov/pssh |
| `clearkey://` 或 Key ID 明文 | ClearKey | 直接提取 key |
| 无 EME，JS/WASM 直接解密 segment | 非 CDM 路径 | 走 Pure Algorithm 路线 |

### 1.2 识别密钥来源

- `MediaKeySession.generateRequest()` 的 initDataType
- JSVMP 是否介入密钥派生（检查 license response 后是否有 VM 执行）
- 是否使用 `SubtleCrypto.decrypt()` 直接解密（非 CDM 路径）
- WASM 模块是否接收加密 segment 并输出解密数据

### 1.3 分流决策树

```
if (黑盒复用可行):
    -> 走 Browser Blackbox 路线（Phase 2）
elif (clear frame boundary 可达):
    -> 走 Clear Frame 路线（Phase 3）
elif (非 CDM 路径，即 SubtleCrypto / JSVMP / WASM 直接解密):
    -> 走 Pure Algorithm 路线（Phase 4）
else:
    -> 走 CDM Message 分析路线（Phase 5）
```

**分流决策必须在首轮完成，不要默认进入深拆。**

---

## 2. Browser Blackbox 路线（最高优先级）

目标：不拆内部，直接在浏览器环境获取解密结果。

### 2.1 最小可行方案

#### 方案 A：`requestVideoFrameCallback`（Chrome 90+）
```javascript
const video = document.querySelector('video');
video.requestVideoFrameCallback(function onFrame(now, metadata) {
    console.log('[clear-frame] metadata', {
        presentationTime: metadata.presentationTime,
        expectedDisplayTime: metadata.expectedDisplayTime,
        width: metadata.width,
        height: metadata.height,
        mediaTime: metadata.mediaTime
    });
    video.requestVideoFrameCallback(onFrame);
});
```

#### 方案 B：Canvas 捕获
```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const video = document.querySelector('video');

function capture() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    console.log('[clear-frame] canvas capture', {
        size: dataUrl.length,
        prefix: dataUrl.slice(0, 80)
    });
    // 可下载验证：createElement('a').href = dataUrl; a.download = 'frame.png';
}

video.addEventListener('play', () => {
    setInterval(capture, 1000); // 每秒捕获一帧
});
```

#### 方案 C：`MediaRecorder` 录制解码流
```javascript
const stream = video.captureStream();
const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
const chunks = [];

recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
};

recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    console.log('[clear-frame] recorded blob', {
        size: blob.size,
        chunks: chunks.length
    });
};

recorder.start(1000);
setTimeout(() => recorder.stop(), 10000);
```

### 2.2 验证判据

- [ ] 视频可正常播放（排除网络/编码问题）
- [ ] 上述任一方案能稳定捕获到非空数据
- [ ] 捕获数据与播放进度同步（时间戳递增，非静态/缓存帧）
- [ ] 若为 canvas capture，肉眼可见与播放内容一致
- [ ] 暂停播放后捕获停止，恢复后捕获继续（证明实时性）

### 2.3 交付

- `run/clear-frame-samples/` 目录下的捕获样本
- `run/frame-decryption-chain.md` 中记录黑盒方案与验证结果

---

## 3. Clear Frame 路线（次优先级）

目标：找到加密数据进入解码器后的"明文边界"。

### 3.1 追踪 SourceBuffer.appendBuffer()

```javascript
const origAppend = SourceBuffer.prototype.appendBuffer;
SourceBuffer.prototype.appendBuffer = function(data) {
    const isEncrypted = detectEncryptedSegment(data); // 检查 senc/saiz box 或 HLS key tag
    console.log('[MSE] appendBuffer', {
        timestampOffset: this.timestampOffset,
        updating: this.updating,
        bufferedRanges: Array.from({length: this.buffered.length}, (_, i) => ({
            start: this.buffered.start(i),
            end: this.buffered.end(i)
        })),
        byteLength: data.byteLength,
        encrypted: isEncrypted,
        first16Bytes: Array.from(new Uint8Array(data.slice(0, 16)))
            .map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    return origAppend.call(this, data);
};
```

### 3.2 追踪 EME 事件序列

```javascript
video.addEventListener('encrypted', e => {
    console.log('[EME] encrypted event', {
        initDataType: e.initDataType,
        initDataLength: e.initData.byteLength
    });
});

const session = mediaKeys.createSession();
session.addEventListener('message', e => {
    console.log('[EME] CDM message', {
        messageType: e.messageType,
        length: e.message.byteLength
    });
});

session.addEventListener('keystatuseschange', () => {
    for (const [keyId, status] of session.keyStatuses) {
        console.log('[EME] key status change', {
            keyId: bytesToHex(keyId),
            status // 'usable' | 'expired' | 'output-downscaled' | 'output-not-allowed' | 'released' | 'internal-error'
        });
    }
});
```

### 3.3 明文边界判定

当同时满足以下条件时，**解码器输出即为明文边界**：
1. `keyStatus` 变为 `'usable'`
2. 后续 `appendBuffer()` 的 segment 能被正常解码播放
3. `video.readyState >= HAVE_CURRENT_DATA`
4. 视频画面可见（非黑屏/花屏）

**关键证据**：
- `keystatuseschange` 事件时间戳
- 第一个成功 `appendBuffer` 后的 `updateend` 事件时间戳
- `video.requestVideoFrameCallback` 首次回调时间戳

### 3.4 交付

- `run/key-session-timeline.json`：EME 事件时间线
- `run/frame-decryption-chain.md`：明文边界定位过程

---

## 4. Pure Algorithm 路线（非 CDM 路径）

适用于：JS/WASM 直接解密 segment，不经过 EME/CDM。

### 4.1 识别特征
- 没有 `requestMediaKeySystemAccess` 调用
- 有 `SubtleCrypto.decrypt()` 或 `CryptoJS.AES.decrypt()`
- 解密后数据直接 `appendBuffer()` 到 MSE
- WASM 模块接收加密 segment、输出解密 segment

### 4.2 JS 直接解密追踪

```javascript
// Hook SubtleCrypto
crypto.subtle.decrypt = new Proxy(crypto.subtle.decrypt, {
    apply(target, thisArg, args) {
        const [algorithm, key, data] = args;
        console.log('[pure-algo] decrypt', {
            algorithm: JSON.stringify(algorithm),
            dataLength: data.byteLength,
            first16Bytes: new Uint8Array(data.slice(0, 16))
        });
        return Reflect.apply(target, thisArg, args);
    }
});

// Hook CryptoJS
defineProperty(window, 'CryptoJS', {
    set(v) {
        v.AES.decrypt = new Proxy(v.AES.decrypt, {
            apply(target, thisArg, args) {
                console.log('[pure-algo] CryptoJS.AES.decrypt', {
                    ciphertext: args[0]?.toString?.()?.slice(0, 50),
                    key: args[1]?.toString?.()?.slice(0, 50)
                });
                return Reflect.apply(target, thisArg, args);
            }
        });
    }
});
```

### 4.3 WASM 解密追踪

参见 `wasm-runtime-playbook.md`，重点关注：
- 输入：加密 segment 如何写入 WASM memory
- 输出：解密后数据如何从 memory 读出
- 参数：key / iv 是否作为 imports 或 memory 中的常量

### 4.4 交付

- `run/frame-decryption-chain.md`
- `run/ciphertext-plaintext-pairs.json`
- `run/verify-decryption.mjs`

---

## 5. CDM Message 分析路线（受限路径）

适用于：必须使用硬件/软件 CDM，且黑盒/明文边界均不可行。

### 5.1 追踪 license request/response

```javascript
session.addEventListener('message', async e => {
    console.log('[EME] CDM license request', {
        messageType: e.messageType,
        length: e.message.byteLength,
        // 常见格式：JSON (ClearKey) / protobuf (Widevine/PlayReady)
        preview: new Uint8Array(e.message.slice(0, 64))
    });

    const response = await fetch(licenseServerUrl, {
        method: 'POST',
        body: e.message,
        headers: {
            'Content-Type': 'application/octet-stream',
            ...customHeaders // 记录自定义 header 来源
        }
    });

    const license = await response.arrayBuffer();
    console.log('[EME] license response', {
        status: response.status,
        length: license.byteLength
    });

    await session.update(license);
    console.log('[EME] session updated');
});
```

### 5.2 分析密钥派生（若 JSVMP 介入）

若 license response 先经过 JSVMP 处理再 `session.update()`：
1. 记录 VM 执行前后的数据差异
2. 建立 license raw -> VM output -> update input 的映射
3. 结合 `jsvmp` 专题的 deep-analysis 还原处理逻辑

### 5.3 受限说明

- Widevine L1 / PlayReady Hardware 的 CDM 内部解密逻辑不可见
- 本路线的交付上限是"license 完整链路 + 密钥派生边界"
- 不要承诺提取 content key 或解密算法

---

## 6. 与 JSVMP 专题的联动（T7 复合场景）

当同时命中 JSVMP 和 DRM 时：

### 6.1 执行时序分析（首轮必须完成）

绘制时间线：
```
[encrypted event]
    |
[generateRequest] --?> [JSVMP 执行?] --> [session.update]
    |                                    |
[license request] <--------------------- [license response]
    |
[keystatuseschange: usable]
    |
[appendBuffer(segment)] --> [解码器] --> [明文帧]
```

### 6.2 优先级判定

```
if (JSVMP 在 license response 之后、session.update 之前执行):
    -> 优先 media-drm：获取 license response 样本
    -> 然后 jsvmp：分析 license 后处理逻辑
    -> 最后验证：处理后的数据是否能成功 update

elif (JSVMP 在 generateRequest 之前执行，构造 initData):
    -> 优先 jsvmp：分析 initData 构造逻辑
    -> 然后 media-drm：标准 EME 流程

elif (JSVMP 直接替代 CDM，做纯算法解密):
    -> 按 Phase 4（非 CDM 路径）处理
    -> jsvmp 分析密钥派生，media-drm 验证明文输出
```

### 6.3 复合追踪模板

```javascript
// EME 标准 hook
hookMediaKeys();

// JSVMP 标准 hook（来自 vmp-instrumentation-snippets.md）
hookVmConstructor(window, 'VM');
traceDispatcher(vmInstance, { dispatchName: '_dispatch' });
wrapBridgeCalls(window, ['atob', 'btoa', 'CryptoJS.AES.decrypt']);

// 时序关联：产出 timeline.jsonl
// 格式：{ts, event, phase, dataPreview}
```

---

## 7. 默认两轮停损 + 媒体链 permit 例外

视频帧解密场景下，以下情况不算有效推进：
- "又定位了一个 EME 事件回调"
- "SourceBuffer 的 updating 状态更清晰了"
- "license request 的 header 又多分析了一个"
- "JSVMP 的 dispatcher 又多识别了一个 handler"

**有效推进标准**：
- 新的明文帧样本
- 新的 ciphertext/plaintext 样本对
- 新的可复现解密脚本
- 新的 key 来源证据
- 请求验收成功（视频可播放且帧可捕获）
- 新的完整边界证据 / family 识别证据 / direct-call 证据 / 搜索纠偏证据

若命中 JSVMP / WASM 且当前 microRoute 已开启 `deepDivePermit`，则：
- 默认只停当前 microRoute，不停整个媒体解密专题
- 只有在当前 microRoute 连续两轮没有新增高价值证据，或达到 `maxRounds / exitCondition` 时，才关闭 permit
- 高价值证据包括：新的 clear-boundary 桥接、新的 wasm internal mapping、新的 direct-call 命中、新的 ciphertext/plaintext 复现链

---

## 8. 最低交付

### 8.1 全部路线通用
- `run/frame-decryption-chain.md`
- `run/key-session-timeline.json`

### 8.2 黑盒路线
- `run/clear-frame-samples/`（canvas 截图或 MediaRecorder 输出）

### 8.3 明文边界路线
- `run/key-session-timeline.json`（含 usable key 时间戳）

### 8.4 Pure Algorithm 路线
- `run/ciphertext-plaintext-pairs.json`
- `run/verify-decryption.mjs`

### 8.5 CDM 路线
- `run/license-flow.md`
- `run/frame-decryption-chain.md`（受限说明）

### 8.6 命中 JSVMP 时额外补充
- `run/vm-trace.jsonl`
- `run/vm-decode-notes.md`（若 VM 处理 license）
- `run/dispatcher-map.md`（若进入深拆）

---

## 9. 禁止事项

- 模式 B 下未尝试黑盒就进入深拆
- 未识别加密模式就开始猜测算法
- 只凭前 256 字节或单个 offset diff 就宣布“算法只改 4 字节 / 8 字节”
- 把"license 链路已分析清楚"当作模式 B 的交付
- 未验证 key status usable 就声称帧已解密
- JSVMP 和 DRM 未做时序关联就独立分析
- 把 canvas 黑屏截图当作解密成功证据
- 忽略 `output-downscaled` / `output-not-allowed` 等受限 key status
