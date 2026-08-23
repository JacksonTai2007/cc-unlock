# Fingerprint Deep Vectors Playbook

Version: 1

适用场景：需要深入分析特定指纹向量的采集机制、变换方式和对抗策略。本playbook作为 `fingerprint-playbook.md` 的深度补充，聚焦Canvas、WebGL、Audio、Font四个高频且复杂的向量。

---

## 1. Canvas指纹深度分析

### 1.1 采集原理

浏览器通过Canvas API绘制特定图形，然后读取像素数据生成指纹：

```javascript
// 典型Canvas指纹代码
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// 绘制组合图形（抗锯齿、字体渲染、颜色混合都会产生差异）
ctx.textBaseline = 'top';
ctx.font = '14px Arial';
ctx.fillStyle = '#f60';
ctx.fillRect(0, 0, 100, 20);
ctx.fillStyle = '#069';
ctx.fillText('Fingerprint test 😀', 2, 15);

// 读取像素指纹
data = canvas.toDataURL();        // base64 PNG
// 或
pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
```

**为什么不同浏览器/硬件产生不同结果**：
- **字体渲染引擎**：FreeType (Linux) vs DirectWrite (Windows) vs CoreText (macOS)
- **抗锯齿算法**：灰度抗锯齿 vs 子像素抗锯齿（ClearType）
- **颜色管理**：ICC profile差异
- **GPU驱动**：GPU加速的绘制路径不同
- **Emoji渲染**：不同系统使用不同emoji字体
- **浮点精度**：颜色混合的浮点运算精度差异

### 1.2 Hook与取证

**Hook toDataURL**：
```javascript
const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(...args) {
  const result = origToDataURL.apply(this, args);
  console.log('[Canvas:toDataURL]', {
    width: this.width,
    height: this.height,
    dataUrlLength: result.length,
    dataUrlPrefix: result.slice(0, 100)
  });
  // 可选：发送到自己的服务器进行对比分析
  return result;
};
```

**Hook getImageData**：
```javascript
const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
  const result = origGetImageData.apply(this, arguments);
  console.log('[Canvas:getImageData]', {
    sx, sy, sw, sh,
    dataLength: result.data.length,
    sample: Array.from(result.data.slice(0, 16))
  });
  return result;
};
```

**Hook getContext**：
```javascript
const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
  console.log('[Canvas:getContext]', contextType, contextAttributes);
  return origGetContext.apply(this, arguments);
};
```

### 1.3 对抗策略

| 策略 | 方法 | 风险 |
|------|------|------|
| 噪声注入 | 在toDataURL/getImageData返回前修改少量像素 | 一致性检测（多次读取应相同） |
| 固定输出 | 返回预计算的合法指纹 | 熵值过低被标记 |
| 真实浏览器 | 使用真实浏览器（Playwright/Puppeteer不修改canvas） | 无风险，但开销大 |
| 代理画布 | 将canvas操作转发到另一进程/服务 | 复杂度高 |

**推荐做法**：
- 弱风控下 stealth 插件通常可过 canvas；强风控以 rebrowser/patchright + 真实/类真实 GPU 为准
- 如果需要自定义：在preload中精确覆盖toDataURL/getImageData，确保返回值与真实浏览器一致

---

## 2. WebGL指纹深度分析

### 2.1 采集原理

WebGL提供更深层的GPU指纹：

```javascript
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

// 采集参数
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);    // e.g. "Intel Inc."
const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL); // e.g. "Intel Iris Xe"

// 采集其他参数
const params = [
  gl.VENDOR, gl.RENDERER, gl.VERSION, gl.SHADING_LANGUAGE_VERSION,
  gl.MAX_TEXTURE_SIZE, gl.MAX_VIEWPORT_DIMS, gl.MAX_VERTEX_ATTRIBS,
  gl.MAX_VERTEX_UNIFORM_VECTORS, gl.MAX_FRAGMENT_UNIFORM_VECTORS,
  // ... 数十个参数
];
```

**关键指纹来源**：
- **GPU型号**：`UNMASKED_RENDERER_WEBGL` 直接暴露GPU
- **驱动版本**：`VERSION` 字符串中包含驱动信息
- **支持上限**：最大纹理尺寸、属性数量等
- **扩展列表**：`gl.getSupportedExtensions()`
- **压缩纹理支持**：`WEBGL_compressed_texture_*`

### 2.2 Hook与取证

**Hook getParameter**：
```javascript
const origGetParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(pname) {
  const result = origGetParameter.apply(this, arguments);
  if (pname === 37445 || pname === 37446) { // UNMASKED_VENDOR/RENDERER
    console.log('[WebGL:getParameter]', pname, result);
  }
  return result;
};
```

**Hook getExtension**：
```javascript
const origGetExtension = WebGLRenderingContext.prototype.getExtension;
WebGLRenderingContext.prototype.getExtension = function(name) {
  console.log('[WebGL:getExtension]', name);
  return origGetExtension.apply(this, arguments);
};
```

**Hook getSupportedExtensions**：
```javascript
const orig = WebGLRenderingContext.prototype.getSupportedExtensions;
WebGLRenderingContext.prototype.getSupportedExtensions = function() {
  const result = orig.apply(this);
  console.log('[WebGL:extensions]', result);
  return result;
};
```

### 2.3 对抗策略

| 策略 | 方法 |
|------|------|
| 修改renderer info | 覆盖getParameter（37445/37446），返回**匹配目标人群真实 GPU** 的 vendor/renderer 字符串 |
| 限制扩展列表 | 过滤掉headless特有的扩展 |
| 真实/类真实 GPU 渲染（首选） | 真实机器跑，或 `--use-gl=angle --use-angle=gl` 走 ANGLE GL 后端 |
| ~~SwiftShader~~（避免） | 软件渲染会暴露 `UNMASKED_RENDERER=SwiftShader`，是 headless 强特征；**仅目标不检测 WebGL 时**可接受 |

**Puppeteer/Playwright配置**：

> ⚠️ **反例（会自曝）**：`--disable-gpu` / `--disable-software-rasterizer` 会让 WebGL `UNMASKED_RENDERER` 回落到 **SwiftShader / 软件渲染**，这本身就是 **headless 的强特征**，等于主动告诉风控"我是无头机"。不要用它来"伪装 GPU"。仅当目标根本不检测 WebGL 时才可接受。

**前置条件**：`--use-angle=gl` 仅当存在可用 GL 栈/显示时有效；纯 headless 服务器无 GPU/显示时仍会回落 SwiftShader，需 `Xvfb` + 真实 GPU，或直接走下方 preload 覆盖 `UNMASKED_RENDERER`。`--use-angle` 合法值：`gl` / `gles` / `vulkan` / `d3d11on12` / `swiftshader` / `metal`（平台相关，按宿主选）。

正确方向（让 WebGL 走真实/类真实 GPU 渲染）：
```javascript
const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    // 走 ANGLE + 真实 GL 后端，避免回落 SwiftShader
    '--use-gl=angle',
    '--use-angle=gl',        // 合法值 gl/gles/vulkan/d3d11on12/swiftshader/metal；有真实 GPU 时也可用 'd3d11on12'/'metal'
    '--enable-gpu-rasterization',
  ]
});

// 无真实 GPU 或仍回落软件渲染时，用 preload 覆盖 UNMASKED_VENDOR/RENDERER
// 为「匹配目标人群真实 GPU」的字符串（覆盖 getParameter 37445/37446），
// 而不是放任 SwiftShader 暴露。覆盖值要与 UA/平台自洽，避免组合矛盾。
```

---

## 3. Audio指纹深度分析

### 3.1 采集原理

AudioContext指纹利用音频处理管道的差异：

```javascript
const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
const ctx = new AudioContext(1, 44100, 44100);

const osc = ctx.createOscillator();
osc.type = 'triangle';
osc.frequency.value = 10000;

const compressor = ctx.createDynamicsCompressor();
// 设置各种压缩参数...

osc.connect(compressor);
compressor.connect(ctx.destination);
osc.start();

ctx.startRendering().then(buffer => {
  const data = buffer.getChannelData(0);
  const fingerprint = hash(data);  // 对音频样本哈希
});
```

**为什么产生差异**：
- **浮点精度**：不同CPU/编译器的浮点运算结果微有不同
- **FFT实现**：不同浏览器的FFT算法实现差异
- **采样率转换**：音频重采样的滤波器差异
- **压缩器实现**：DynamicsCompressor的内部算法差异

### 3.2 Hook与取证

**Hook OfflineAudioContext**：
```javascript
const OrigOfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
window.OfflineAudioContext = function(...args) {
  console.log('[AudioContext:constructor]', args);
  return new OrigOfflineAudioContext(...args);
};
```

**Hook startRendering**：
```javascript
const origStartRendering = OfflineAudioContext.prototype.startRendering;
OfflineAudioContext.prototype.startRendering = function() {
  console.log('[AudioContext:startRendering]');
  return origStartRendering.apply(this).then(buffer => {
    const data = buffer.getChannelData(0);
    console.log('[AudioContext:result]', {
      sampleCount: data.length,
      samplePrefix: Array.from(data.slice(0, 10)),
      hash: simpleHash(data)
    });
    return buffer;
  });
};
```

**Hook createOscillator/createDynamicsCompressor**：
```javascript
const origCreateOsc = AudioContext.prototype.createOscillator;
AudioContext.prototype.createOscillator = function() {
  console.log('[AudioContext:createOscillator]');
  return origCreateOsc.apply(this);
};
```

### 3.3 对抗策略

| 策略 | 方法 | 风险 |
|------|------|------|
| 返回固定音频指纹 | 覆盖startRendering返回预计算结果 | 需与目标浏览器完全匹配 |
| 引入微噪声 | 在音频样本中加入微小随机噪声 | 一致性检测 |
| 禁用AudioContext | 让构造器返回null或抛出异常 | 明显异常 |
| 使用真实浏览器 | 不修改音频处理 | 最安全 |

**注意**：AudioContext指纹对**一致性**要求极高。同一浏览器多次运行的结果应该完全相同（同一版本、同一机器）。

---

## 4. Font指纹深度分析

### 4.1 采集原理

通过测量不同字体渲染后的元素尺寸生成指纹：

```javascript
function measureFont(fontName) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '72px ' + fontName;
  const metrics = ctx.measureText('mmmmmmmmmmlli');
  return {
    width: metrics.width,
    actualBoundingBoxLeft: metrics.actualBoundingBoxLeft,
    actualBoundingBoxRight: metrics.actualBoundingBoxRight
  };
}

// 测试系统字体列表
const fonts = ['Arial', 'Times New Roman', 'Courier New', ...];
const fingerprint = {};
for (const font of fonts) {
  fingerprint[font] = measureFont(font);
}
```

**差异来源**：
- **字体版本**：同一字体名在不同系统可能有不同版本
- **字距调整（Kerning）**：不同渲染引擎的字距算法
- **度量精度**：actualBoundingBox的精度差异
- **备用字体**：当请求字体不存在时的fallback行为

### 4.2 Hook与取证

**Hook measureText**：
```javascript
const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
CanvasRenderingContext2D.prototype.measureText = function(text) {
  const result = origMeasureText.apply(this, arguments);
  console.log('[Font:measureText]', {
    font: this.font,
    text,
    width: result.width
  });
  return result;
};
```

**Hook FontFace/FontFaceSet**：
```javascript
const origLoad = FontFace.prototype.load;
FontFace.prototype.load = function() {
  console.log('[FontFace:load]', this.family, this.source);
  return origLoad.apply(this);
};
```

### 4.3 对抗策略

| 策略 | 方法 |
|------|------|
| 固定measureText返回值 | 返回与目标浏览器匹配的width |
| 限制可检测字体 | 让某些字体检测"不存在" |
| 使用标准字体栈 | 确保系统字体与常见配置一致 |

---

## 5. 综合取证脚本

```javascript
(function deepFingerprintProbe() {
  const report = {
    timestamp: Date.now(),
    canvas: {},
    webgl: {},
    audio: {},
    font: {}
  };

  // Canvas probe
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f60';
    ctx.fillRect(0,0,100,20);
    report.canvas.toDataURL = c.toDataURL().slice(0, 100);
    report.canvas.getImageData = !!ctx.getImageData;
  } catch(e) { report.canvas.error = e.message; }

  // WebGL probe
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      report.webgl.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      report.webgl.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    }
    report.webgl.extensions = gl.getSupportedExtensions().slice(0, 20);
  } catch(e) { report.webgl.error = e.message; }

  // Audio probe
  try {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    report.audio.available = !!AC;
  } catch(e) { report.audio.error = e.message; }

  // Font probe
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = '72px Arial';
    report.font.arialWidth = ctx.measureText('mmmmmmmmmmlli').width;
  } catch(e) { report.font.error = e.message; }

  console.log('[DeepFingerprintProbe]', JSON.stringify(report, null, 2));
  return report;
})();
```

---

## 6. 交付要求

深度指纹分析时，除 `fingerprint-playbook.md` 要求外，额外补充：

- `run/fingerprint-canvas-profile.json` — Canvas采集细节
- `run/fingerprint-webgl-profile.json` — WebGL参数列表
- `run/fingerprint-audio-profile.json` — AudioContext测试结果
- `run/fingerprint-font-profile.json` — 字体测量结果
- `run/fingerprint-vector-hooks.log` — Hook采集日志

---

## 7. 常见误区

- 认为Canvas指纹只是"图片对比"，忽略了抗锯齿和字体渲染的复杂性
- 忽略WebGL的`UNMASKED_VENDOR/RENDERER`是最强指纹之一
- Audio指纹一致性要求极高，微小的环境差异（CPU负载）都可能改变结果
- Font指纹检测中，混淆"字体存在"和"字体渲染尺寸"
- 使用虚拟机时未考虑虚拟GPU与物理GPU的指纹差异
- 对Puppeteer的`--disable-gpu`等参数的实际效果缺乏验证
