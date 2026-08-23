# Electron 应用逆向 Playbook

适用：已通过 `web-shell-triage.md` 确认目标是 Electron 的场景。

Electron 应用的核心特点是：宿主 EXE 只是 Chromium 壳，业务逻辑在 JS/V8 层。直接对宿主 EXE 用 IDA 反编译几乎无意义——你需要的是前端资源分析和 Node.js 运行时调试。

## 阶段工作流

```
识别为 Electron
 ├─ 阶段1: 资源解包与入口定位
 │   ├─ asar 解包 → package.json → 入口文件
 │   ├─ 识别代码形态：明文JS / V8字节码(.jsc) / Webpack bundle
 │   └─ 定位 IPC 桥接点(ipcMain/ipcRenderer/contextBridge)
 ├─ 阶段2: 静态分析入口文件
 │   ├─ 明文JS → 直接阅读 / 美化 / 搜索关键字符串
 │   ├─ V8字节码(.jsc) → bytenode 反编译 或 动态提取
 │   └─ Webpack bundle → 美化 + 模块边界识别
 ├─ 阶段3: 动态分析（按需）
 │   ├─ --inspect + Chrome DevTools Protocol
 │   ├─ Node.js crypto / fs / net 模块 hook
 │   └─ 渲染进程 DevTools 调试
 └─ 阶段4: 算法还原 / 补丁 / 复现
```

## 阶段1: 资源解包与入口定位

### asar 解包（必须步骤）

```bash
# 安装工具
npm install -g asar

# 解包 app.asar 到工作目录
asar extract "<install-dir>/resources/app.asar" "<task-id>/run/app_extracted"

# 如果存在 app.asar.unpacked 目录，也要复制
xcopy "<install-dir>/resources/app.asar.unpacked" "<task-id>/run/app_unpacked" /E /I
```

注意：只检查"有没有 app.asar"是不够的，必须实际解包。即使目录中已有 `app_extracted` 目录，也要确认它是最新解包（对比 asar 的修改时间）。

### asar 完整性校验绕过

#### 1. 宿主外壳层（EXE 级/Framework 级）

Electron 12+ 支持 `embeddedAsarIntegrityValidation`，会在启动时校验 asar 哈希。绕过方式：

```
方法1 - 修改 electron.fuses.json 或 app.ini:
  将 AsarIntegrity 到 enabled=0 或删除对应行

方法2 - 二进制 Fuses 哨兵改写战术 (最通用、跨应用普适):
  无需官方编译工具，直接读取主 EXE 的二进制 Buffer，在文件中全局搜索 Electron 框架层硬编码的 32 字节通用哨兵标记（ASCII 字符串）：
  "dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"

  该哨兵标记在所有 Electron 12+ 编译的二进制外壳中 100% 存在。找到该标记后，其紧邻的后方字节流中每一位代表一个熔丝开关（0x30 表示禁用，0x31 表示启用）。
  通过直接修改特定相对偏移的熔丝字节，即可物理实现逆向调试解锁：
  - OnlyLoadAppFromAsar (相对偏移 5 字节): 将启用位 0x31 物理修改为 0x30 (禁用)，直接解除 Electron 仅能从 asar 加载的限制。从此可以安全解包并以 resources/app/ 明文目录回退加载运行，彻底废掉 ASAR 文件校验！
  - EnableNodeCliInspectArguments (相对偏移 3 字节): 将禁用位 0x30 物理修改为 0x31 (启用)，即使在 Packaged 混淆打包状态下，也能强制开启主进程的 --inspect 调试端口！

方法3 - 替换 resources 目录：
  删除 app.asar，将解包后的 app 目录重命名为 app（Electron 会优先加载 app 目录，需配合 Fuses 禁用 OnlyLoadAppFromAsar 熔丝）
```

##### 🛠️ 通用 Fuses 哨兵物理补丁 JS 模板：

```javascript
const fs = require("fs");
const path = require("path");

function patchElectronFuses(exePath) {
  const bytes = fs.readFileSync(exePath);
  // Electron 12+ 统一硬编码的 32 字节 Fuses 哨兵标记
  const SENTINEL = Buffer.from("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX", "ascii");
  const sentinelIdx = bytes.indexOf(SENTINEL);

  if (sentinelIdx === -1) {
    console.error(
      "未在主 EXE 中找到 Fuses 哨兵标记，该程序可能未启用 Fuses 或版本低于 v12。",
    );
    return false;
  }

  const fusesStartIdx = sentinelIdx + SENTINEL.length;
  console.log(
    `已成功定位 Fuses 哨兵，数据段起始偏移: 0x${fusesStartIdx.toString(16)}`,
  );

  // 执行通用熔丝硬补丁：
  // 偏移 +3: EnableNodeCliInspectArguments (禁用 0x30 -> 启用 0x31)
  if (bytes[fusesStartIdx + 3] === 0x30) {
    bytes[fusesStartIdx + 3] = 0x31;
    console.log("-> 成功解锁主进程 --inspect 调试支持！");
  }

  // 偏移 +5: OnlyLoadAppFromAsar (启用 0x31 -> 禁用 0x30)
  if (bytes[fusesStartIdx + 5] === 0x31) {
    bytes[fusesStartIdx + 5] = 0x30;
    console.log(
      "-> 成功解除 OnlyLoadAppFromAsar 限制！可直接以 resources/app/ 目录解包加载运行。",
    );
  }

  fs.writeFileSync(exePath, bytes);
  console.log("主外壳 Fuses 二进制补丁完美打入！");
  return true;
}
```

#### 2. 应用层 / V8 字节码层（JSC 级 / 二次校验级）

**特征**：即使绕过了外壳层校验，某些高度保护的应用会在其编译的 **V8 字节码（.jsc/.bin）** 内部，使用 `crypto.createHash('sha256')` 读取并计算加载文件（如 `launch.dist.js`）的 SHA256，与编译时嵌入的哈希值做对比。不匹配时直接抛出 `"checksum failed"` 或静默退出。

**自愈式哈希 Hook 战术（通用避障）**：
无需硬改复杂的二进制字节码，直接在入口明文 JS 中 Hook 底层的 `crypto.createHash`。当检测到当前的 hash 运算是针对已被我们修改的脚本时，物理返回原始文件的硬编码 SHA256 哈希值，完美欺骗 JSC。

```javascript
// 通用自愈式哈希 Hook 模板 (注入至入口加载脚本最前端)
const crypto = require("crypto");
const origCreateHash = crypto.createHash;

crypto.createHash = function (algorithm, options) {
  const hashObj = origCreateHash.call(this, algorithm, options);
  if (algorithm.toLowerCase() === "sha256") {
    const origUpdate = hashObj.update;
    hashObj.update = function (data, inputEncoding) {
      // 通过检测修改文件中特有的独占字段/标记，来识别当前校验是否针对修改后的目标
      const dataStr = typeof data === "string" ? data : data.toString("utf8");
      if (dataStr.includes("_my_injected_hook_marker_")) {
        // 1. 如果匹配修改标记，说明 JSC 正在对被修改的目标进行完整性哈希校验
        // 2. 拦截并伪装：直接在 final 阶段物理返回未修改前的原始 launch 脚本哈希值
        const origDigest = hashObj.digest;
        hashObj.digest = function (encoding) {
          const originalLaunchHash =
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // 原始 launch.js 的 SHA256
          return encoding === "hex"
            ? originalLaunchHash
            : Buffer.from(originalLaunchHash, "hex");
        };
      }
      return origUpdate.call(this, data, inputEncoding);
    };
  }
  return hashObj;
};
```

### 入口定位

解包后检查：

1. **package.json** 的 `main` 字段 → 入口文件路径
2. 入口文件的代码形态：
   - `.js` → 明文 JavaScript，直接阅读
   - `.jsc` → V8 字节码，需要反编译（见阶段2）
   - 无扩展名 → 检查文件头，V8 字节码以 `0xC0DE` 开头
3. **preload 脚本**: `BrowserWindow` 创建时的 `webPreferences.preload` 字段指定的文件
4. **IPC 注册**: 搜索 `ipcMain.handle`、`ipcMain.on`、`ipcRenderer.invoke`、`ipcRenderer.send`

### 常见 IPC 模式映射

```
ipcMain.handle("channel", handler)  →  双向 IPC，renderer 用 invoke 调用
ipcMain.on("channel", handler)      →  单向 IPC，renderer 用 send 调用
contextBridge.exposeInMainWorld      →  暴露到渲染进程 window 的 API
remote.require / remote.getGlobal    →  遗留 remote 模块（不安全，新版已弃用）
```

## 阶段2: 静态分析入口文件

### 明文 JS 分析

```bash
# 美化压缩代码
npx prettier --write "<file>.js" --print-width 120
# 或
npx js-beautify "<file>.js" -o "<file>.beautified.js"

# 搜索关键字符串
grep -r "license\|activate\|token\|decrypt\|verify\|sign" "<extracted-dir>/"
```

### V8 字节码 (.jsc) 分析

V8 字节码是通过 `bytenode` 或 `v8.Script` 编译的代码缓存。静态提取困难，建议优先走动态分析。

```
文件格式:
  前4字节: 0xC0DE + 版本号（如 0x0687）
  中间: 源码哈希头（launch.dist.js 中的 setFlagHashHeader/getSourceHashHeader 管理）
  主体: V8 序列化的字节码 + 常量池

字符串常量提取（有限）:
  用 strings 命令或二进制搜索可以提取部分可读字符串
  但密钥等数据可能以非文本形式存在（BigInt、ArrayBuffer）

反编译方案:
  1. 使用 Node.js 对应版本加载 .jsc 并通过 inspector 探查（推荐）
  2. 使用 v8-to-istanbul 转换为 coverage 格式（信息有限）
  3. 直接阅读 launch.dist.js 的加载逻辑，理解字节码如何被执行
```

#### 🛠️ JSC 二进制常量池反调试“等长混淆补丁”战术

**特征**：编译后的 V8 字节码中，其常量池（String Pool）仍保留了完整的 UTF-8 明文字符串。许多高度保护的 JSC 字节码会在 webpack 模块的初始化首部，读取 `process.execArgv` 判定是否包含 `"--inspect"` 或 `"--inspect-brk"`。一旦检测到说明用户正在挂调试器，从而抛出异常或退出进程。

**避障战术（二进制等长热混淆）**：

- 由于直接反编译修改字节码难度过高，我们甚至不需要反编译 JSC 文件。
- 既然明文字符串硬编码在二进制常量池中，我们可以**直接以二进制字节读写（latin1/hex）方式打开 .jsc 文件**，在文件中定位到 `"--inspect"` 的位置。
- **等长混淆替换**：在对应的字节位置，将其替换为同样长度但不再能通过原本检测的混淆字符串，例如 `"--xnspect"`。
- **优点**：由于替换前后的**字符长度完全相同，绝对不会破坏 V8 序列化字节码的偏移结构**，无需重构任何二进制索引；同时在模型使用 `--inspect` 端口启动 Chromium 调试时，JSC 常量池中检测的字符已被替换，反调试匹配逻辑彻底失效！

```javascript
// 通用 JSC 调试检测等长混淆补丁逻辑
const fs = require("fs");
const jscBytes = fs.readFileSync("atom.compiled.dist.jsc");

// V8 字节码常量池中的目标匹配字符串
const oldTarget = "--inspect";
const newTarget = "--xnspect"; // 保持等长，避免破坏 V8 字节偏移

const view = jscBytes.toString("latin1");
let idx = view.indexOf(oldTarget);
let count = 0;

while (idx >= 0) {
  Buffer.from(newTarget, "latin1").copy(jscBytes, idx);
  console.log(
    `成功热补丁 JSC 反调试常量: 0x${idx.toString(16)} [${oldTarget} -> ${newTarget}]`,
  );
  count++;
  idx = view.indexOf(oldTarget, idx + oldTarget.length);
}

if (count > 0) {
  fs.writeFileSync("atom.compiled.dist.jsc", jscBytes);
  console.log(`JSC 字节码常量池补丁注入完毕，共修改 ${count} 处反调试标记。`);
}
```

### Webpack bundle 分析

```
特征: 文件以 (window.webpackJsonp= 或 __webpack_require__ 开头
方法:
  1. 美化后搜索模块边界（function(module, exports, __webpack_require__)）
  2. 按字符串搜索定位目标模块
  3. 提取单个模块单独分析
```

## 阶段3: 动态分析

### Electron 进程模型

Electron 有两类进程，分析目标决定了你要 hook 哪个：

| 进程             | 职责                                            | 调试方式                        |
| ---------------- | ----------------------------------------------- | ------------------------------- |
| Main Process     | Node.js 环境；管理窗口、IPC、文件系统、原生模块 | `--inspect` + Node.js Inspector |
| Renderer Process | Chromium 环境；运行前端页面、DOM、Web API       | Chrome DevTools (F12)           |

关键区别：`require('crypto')` 在 Main Process 中可用，在 Renderer 中不可用。许可证验证等核心逻辑通常在 Main Process 中运行。

### 方案A: Node.js Inspector（推荐用于 Main Process 分析）

```bash
# 启动 Typora 并开启 inspector 端口
Typora.exe --inspect=19222

# 用 Node.js 自带的 inspector 客户端连接
node -e "const ins = require('inspector'); ins.open(19222, '127.0.0.1');"

# 或用 chrome://inspect → Configure... → 添加 127.0.0.1:19222
```

连接后可以：

- 在 Console 中执行任意 JS（Main Process 上下文）
- 访问 `require('crypto')`、`require('fs')` 等 Node.js 模块
- 搜索 `require.cache` 查看已加载模块
- 通过 `process.mainModule` 遍历模块树
- 在 Sources 面板设置断点（包括 .jsc 编译的代码）

### 方案B: asar 重打包 + Hook 注入

适用于需要持久化 hook 的场景（如自动捕获 crypto 调用参数）。

```bash
# 1. 解包 asar
asar extract "resources/app.asar" "resources/_app_work"

# 2. 修改入口文件（launch.dist.js 或 main.js），在 .jsc 加载前注入 hook
#    在 require("./atom.compiled.dist.jsc") 之前添加:
#    const origCrypto = require('crypto');
#    const origPublicDecrypt = origCrypto.publicDecrypt;
#    origCrypto.publicDecrypt = function(...args) {
#      const key = args[0];
#      const data = args[1];
#      fs.appendFileSync('crypto_capture.log',
#        `[${new Date().toISOString()}] publicDecrypt called\n` +
#        `  key: ${JSON.stringify(key)}\n` +
#        `  data length: ${data.length}\n`);
#      return origPublicDecrypt.apply(this, args);
#    };

# 3. 重新打包（注意：如果启用了 integrity check，需要先绕过）
asar pack "resources/_app_work" "resources/app.asar"

# 4. 启动 Typora，触发目标功能，检查 crypto_capture.log
```

### 方案C: ELECTRON_RUN_AS_NODE（独立测试 Node.js 逻辑）

```bash
# 以纯 Node.js 模式运行 Typora 二进制
set ELECTRON_RUN_AS_NODE=1
"C:\Program Files\Typora\Typora.exe" -e "console.log(process.version)"

# 可用于直接 require .jsc 模块进行测试（需 V8 版本匹配）
# 注意：此模式下无 BrowserWindow、无 IPC，只有 Node.js 运行时
```

### 方案D: Frida Hook Node.js 原生层

当 JS 层面 hook 不够时（如密钥通过 V8 内部反序列化创建，不经过 JS 构造函数），可以 hook Node.js 底层：

```javascript
// Frida: Hook Node.js 的 crypto 模块原生实现
// 目标: node.exe 内部的 EVP_PKEY_verify / RSA_public_decrypt

// 定位 Electron 中的 OpenSSL 符号
var modules = Process.enumerateModules();
var electronModule = modules.find((m) =>
  m.name.toLowerCase().includes("typora"),
);

// 搜索 RSA 相关导出
var rsaDecrypt = Module.findExportByName(null, "RSA_public_decrypt");
if (rsaDecrypt) {
  Interceptor.attach(rsaDecrypt, {
    onEnter: function (args) {
      var flen = args[1].readU32();
      var from = args[2];
      var to = args[3];
      var padding = args[5].readU32();
      console.log("[RSA_public_decrypt] flen=" + flen + " padding=" + padding);
      console.log(
        "  from (hex): " + hexdump(from, { length: Math.min(flen, 256) }),
      );
    },
    onLeave: function (retval) {
      console.log("[RSA_public_decrypt] ret=" + retval);
    },
  });
}
```

## 常见 Electron 逆向场景速查

### 许可证/激活验证

```
线索: "license\|activate\|machineCode\|publicDecrypt\|offlineActivation"
入口: ipcMain.handle("offlineActivation", handler)
流程: 前端收集输入 → IPC → Main Process 验证 → 返回结果
验证方式通常是:
  - RSA: crypto.publicDecrypt / crypto.verify（公钥在 .jsc 常量池）
  - AES: crypto.createDecipheriv（密钥硬编码或派生）
关键: 公钥/密钥在 V8 字节码常量池中，静态提取困难，建议用方案A(inspector)或方案B(asar hook)
```

#### 🛡️ 战术扩充 1：本地联网续期时间窗口特征（lastRetry 校验）与时间欺骗

**特征**：离线激活后，应用通常会在本地存储激活的时间戳（如 `lastRetry`）。每次启动时，主进程会计算当前时间与上次校验时间的差值（`now - lastRetry`）。若超出预设的时间窗口阈值，则自动触发后台静静默联网续期验证。联网失败时，会立即清除本地许可证并将应用退回“未激活”状态。

**避障战术（通用远未来日期欺骗）**：
无需尝试物理破坏联网校验逻辑。在向本地注册表或配置文件（如 JSON/XML）写入激活 Token 时，**将校验日期物理修改并硬编码为“远未来日期”（如 10 年后）**。

- 效果：每次应用启动计算 `now - lastRetry` 时，由于 `lastRetry` 处于遥远的未来，差值恒为**负数或极小值**。
- 结果：时间差永远小于本地触发联网续期的窗口阈值，应用会判定“刚在极短时间内完成过在线校验”，从而**终身免联网、零网络请求地长久保持激活状态**。

#### 🛡️ 战术扩充 2：纯 JS 与 Node 原生双轨制解密回退截击战术

**特征**：现代 Electron 应用常采用 Webpack 闭包内的纯 JS（如基于原生 BigInt 反序列化）来执行高强度的 RSA 密文解密（`jsDecrypt`），其公钥硬编码在字节码闭包常量池中，静态极其难提取。然而，许多应用为了保障兼容性，在其纯 JS 解密模块外设计了**“双轨制回退路径”**：若 `jsDecrypt` 抛出异常，系统会自动回退调用 Node.js 原生的 `crypto.publicDecrypt` 进行尝试。

**避障战术（原生回退终端截击）**：
无需与闭包内的 `jsDecrypt` 正面交锋。我们只需在入口 JS 中 Hook 底层原生的 `crypto.publicDecrypt`。当其被回退调用时，直接拦截输入并将伪造的明文 JSON 缓冲区作为解密结果返回，实现以弱胜强的降维打击。

```javascript
// 通用双轨解密回退劫持 JS 模板
const crypto = require("crypto");
const origPublicDecrypt = crypto.publicDecrypt;

crypto.publicDecrypt = function (key, buffer) {
  try {
    // 1. 大模型伪造的离线激活 Token，在进入 publicDecrypt 前已被 application 解码为明文 Buffer
    // 2. 检查 Buffer 是否符合我们伪造的激活 JSON 特征
    const decryptedJson = JSON.parse(buffer.toString("utf8"));
    if (decryptedJson && decryptedJson.license && decryptedJson.deviceId) {
      console.log(
        "-> 成功拦截双轨解密回退路径！直接物理返回伪造的许可证明文 Buffer。",
      );
      return buffer; // 拦截解密，直接将明文 Buffer 原样返回作为解密结果
    }
  } catch (e) {
    // 忽略异常，继续执行原始 publicDecrypt
  }
  return origPublicDecrypt.apply(this, arguments);
};
```

### 网络请求拦截

```
方法1 - Node.js 层 hook:
  require('http').prototype.request / require('https').prototype.request

方法2 - Hosts 文件 / 代理:
  修改 C:\Windows\System32\drivers\etc\hosts 指向本地服务器
  或启动 mitmproxy 拦截 HTTPS（需要处理证书问题）

方法3 - Electron session:
  session.defaultSession.webRequest.onBeforeRequest
```

#### 🛡️ 战术扩充：联网续期的“网络错误宽容陷阱”与 `Promise.reject` 彻底阻断战术

**特征**：在许多优秀的商业软件激活续期流程中，存在一个极其违反直觉的**“网络错误宽容设计”**。
当离线激活成功的软件在后台向服务器发起联网续期网络请求时，JSC 字节码逻辑对待以下两种网络响应的态度截然不同：

- **伪造成功响应（大忌）**：如果您尝试 Hook 请求并伪造返回一个空的 200 HTTP 响应，应用的 V8 字节码会严肃地解析并比对 JSON 数据字段。一旦发现字段格式不对，判定在线校验失败，从而狠辣启动 **`unfill`（物理清除本地注册表 SLicense 激活数据）** 撤回激活。
- **物理断网错误（黄金通道）**：如果应用直接发生了 **DNS 解析失败**、**连接超时**或 **物理断网故障**，V8 字节码层通常会采取极其宽容的“容错策略”：仅在 Console 记录 `Failed to Renew License` 警告并允许此次续期失败，**绝对不会执行 unfill 动作**，无害保留本地 SLicense，从而继续使用！

**避障战术（模拟物理网络连接失败）**：
在网络拦截中，切勿自作聪明去伪造返回 200 JSON 响应。而是应该**利用 Promise.reject() 彻底拒绝或抛出连接失败异常**，完美模拟物理断网状态，安全保住本地激活状态。

```javascript
// 针对 electron-fetch / fetch 请求的“物理断网”模拟 Hook
const Module = require("module");
const origLoad = Module._load;

Module._load = function (request, parent, isMain) {
  const exports = origLoad.apply(this, arguments);
  // electron-fetch 导出的 default 是它的 fetch 函数
  if (request === "electron-fetch" || request === "node-fetch") {
    const origFetch = exports.default;
    exports.default = function (url, options) {
      if (/target-verify-domain\.com/i.test(url)) {
        console.log(
          "-> 拦截许可证续期网络请求！强行模拟物理断网故障（Promise.reject）。",
        );
        // 彻底拒绝 Promise，抛出网络连接失败异常，激活免受 unfill 危害
        return Promise.reject(new Error("ENOTFOUND target-verify-domain.com"));
      }
      return origFetch.apply(this, arguments);
    };
  }
  return exports;
};
```

#### 🛡️ 战术扩充：多网络库立体域名拦截范式

**特征**：Electron 应用的网络通信栈极其复杂。某些高对抗应用为了防范常规 Hook，会**混杂使用多种不同的网络库与层级进行请求**：

1. 底层 Node.js 级（使用 `dns.lookup` 解析域名，通过原生 `http`/`https` 发起包）
2. 上层 Chromium 内核特供级（使用 `electron-fetch` 或 `electron.net.request`）

如果只 Hook 常规的 `http` 模块，上层的 `fetch` 请求依旧能完美逃逸并连通服务器，从而清空激活状态。

**避障战术（多网络栈联合拦截）**：
必须使用立体劫持手段，同时在 JS 入口将以下三层网络通道一并死锁拦截：

```javascript
// 1. 底层 DNS 层级重定向劫持 (硬阻断或重定向)
const dns = require("dns");
const origLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  const targetHost = typeof options === "string" ? options : hostname;
  // 匹配特定域名，物理重定向至 127.0.0.1 阻断其外发
  if (/target-verify-domain\.com/i.test(targetHost)) {
    const cb = typeof options === "function" ? options : callback;
    return cb(null, "127.0.0.1", 4);
  }
  return origLookup.apply(this, arguments);
};

// 2. Electron 原生 net.request 拦截 (代理 _load)
const Module = require("module");
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const exports = origLoad.apply(this, arguments);
  if (request === "electron") {
    // 拦截 electron 原生 net 模块的请求
    const origNet = exports.net;
    if (origNet && origNet.request) {
      const origNetRequest = origNet.request;
      origNet.request = function (options) {
        const url = typeof options === "string" ? options : options.url || "";
        if (/target-verify-domain\.com/i.test(url)) {
          // 返回一个被代理的、无法连通的模拟 Request 对象
          return { on: () => {}, end: () => {}, write: () => {} };
        }
        return origNetRequest.apply(this, arguments);
      };
    }
  }
  return exports;
};
```

### 多实例限制

```
常见实现: app.requestSingleInstanceLock() 或 named mutex
绕过:
  1. 搜索 app.requestSingleInstanceLock 或 app.makeSingleInstance
  2. 补丁：将返回值改为 false（允许第二个实例）
  3. 或修改 mutex 名称（通过 IPC hook 或 asar 重打包）
```

#### 🛡️ 战术扩充：单实例锁代理代理劫持（多开支持）

**特征**：Electron 默认通过 `app.requestSingleInstanceLock()` 申请单实例锁，一旦锁已被占用，后续进程会触发 `second-instance` 事件通知主实例并自动退出。

**避障战术（通用多开 Hook 模板）**：
在 Main 进程中，重写并代理 `Module._load` 中加载的 `electron.app` 模块，拦截其单实例锁申请函数并恒返回 `true`（谎报已成功获取新锁），即可解除单实例锁定限制，完美支持多开。

```javascript
// 通用多实例锁代理 Hook 模板
const Module = require("module");
const origLoad = Module._load;

Module._load = function (request, parent, isMain) {
  const exports = origLoad.apply(this, arguments);
  if (request === "electron") {
    const app = exports.app;
    if (app && app.requestSingleInstanceLock) {
      // 强行重写单实例锁申请：让每个启动的实例都认为自己是第一个实例并成功拿锁
      app.requestSingleInstanceLock = function () {
        return true;
      };
    }
  }
  return exports;
};
```

## 什么时候才需要 IDA

只有以下场景才值得对 Electron 宿主 EXE 或 native addon 用 IDA：

- 需要分析 `.node` 原生模块（C++ addon）
- 需要还原 asar 完整性校验的二进制 fuses
- 需要分析 Electron 框架层的自定义修改
- 需要分析 V8 snapshot 反序列化逻辑

如果业务逻辑在 JS/V8 层（大多数 Electron 应用都是如此），IDA 不是主要工具。
