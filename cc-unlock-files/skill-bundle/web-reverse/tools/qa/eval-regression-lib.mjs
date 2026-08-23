import { readMergedEvalSet } from "./common.mjs";

const baseRouteRules = [
  {
    route: "signature",
    keywords: [
      "signature",
      "canonical string",
      "x-sign",
      "x-t",
      "nonce",
      "timestamp",
      "hmac",
      "sign field",
      "x-bogus",
      "x-gnarly",
      "mstoken",
      "signed request",
      "signer state",
      "signer-state",
      "swap matrix"
    ]
  },
  {
    route: "ast-deobfuscation",
    keywords: ["ast deobfuscation", "ast-deobfuscation", "string array", "string-array", "cfg flatten", "obfuscator.io", "eval(pack)", "dispatcher object", "_0x", "dead code", "unreachable blocks", "control flow flattening", "while-switch", "rotated array", "deobfuscate", "string constants"]
  },
  {
    route: "jsvmp",
    keywords: ["js-vmp", "jsvmp", "vmp", "opcode", "dispatcher", "bytecode", "handler table", "handler cluster", "virtual machine"]
  },
  {
    route: "env",
    keywords: ["first divergence", "descriptor", "queuemicrotask", "typed array", "typedarray", "crypto.getrandomvalues", "browser -> node", "drift matrix", "drift taxonomy", "uint8array", "navigator", "environment", "patched", "env-read"]
  },
  {
    route: "anti-debug",
    keywords: ["anti-debug", "debugger", "devtools", "function(\"debugger\")", "infinite pause", "breakpoint trap"]
  },
  {
    route: "instrumentation-hooking",
    keywords: [
      "runtime hook",
      "preload hook",
      "document.cookie",
      "cookiestore",
      "script.src",
      "appendchild",
      "setattribute",
      "payload builder",
      "sign callsite",
      "request-use",
      "hook events",
      "trace injection",
      "runtime-hooks.js",
      "hooking",
      "writer trace",
      "write chain",
      "cookie setter",
      "signer state write",
      "trace signer state"
    ]
  },
  {
    route: "wasm",
    keywords: ["wasm", "webassembly", "instantiate", "instantiatestreaming", ".wasm", "wasm-bindgen", "emscripten"]
  },
  {
    route: "protocol",
    keywords: [
      "websocket",
      "sse",
      "webtransport",
      "datagram",
      "bidirectional stream",
      "unidirectional stream",
      "protobuf",
      "msgpack",
      "replay",
      "tls",
      "ja3",
      "transport layer"
    ]
  },
  {
    route: "subtlecrypto",
    keywords: ["crypto.subtle", "importkey", "derivekey", "subtlecrypto", "sign()", "digest()"]
  },
  {
    route: "userland-crypto",
    keywords: ["cryptojs", "forge", "jsrsasign", "aes.encrypt", "rsakey", "wordarray", "base64.parse", "pure crypto", "hmac-sha256", "pure python", "algorithm", "tea", "xtea", "xxtea", "sm4", "rc4", "chacha", "s-box", "findcrypt", "signsrch", "algorithm family"]
  },
  {
    route: "binary-codec",
    keywords: ["protobuf", "msgpack", "cbor", "flatbuffers", "varint", "binary schema", "wire format"]
  },
  {
    route: "graphql-rpc",
    keywords: ["graphql", "operationname", "persistedquery", "persisted query", "apq", "sha256hash"]
  },
  {
    route: "grpc-web",
    keywords: ["grpc-web", "connect-web", "application/grpc-web", "x-grpc-web", "grpc-status", "trailers"]
  },
  {
    route: "compression-stream",
    keywords: ["compressionstream", "decompressionstream", "gzip", "deflate", "brotli", "compressed body"]
  },
  {
    route: "dynamic-code",
    keywords: ["eval", "function(", "dynamic import", "blob script", "blob-script", "string timer", "deobf", "cfg flatten", "obfuscator.io", "dynamic loader", "unpacks", "unpack"]
  },
  {
    route: "module-federation",
    keywords: ["remoteentry", "remoteentry.js", "__webpack_init_sharing__", "container.get", "module federation", "share scope", "remote module"]
  },
  {
    route: "microfrontend-runtime",
    keywords: ["single-spa", "qiankun", "system.import", "import map", "importmap", "remote manifest", "subapp mount", "microfrontend"]
  },
  {
    route: "cross-context-coordination",
    keywords: ["broadcastchannel", "sharedarraybuffer", "atomics", "storage event", "audioworklet", "paintworklet", "offscreencanvas", "message graph"]
  },
  {
    route: "streaming-runtime",
    keywords: [
      "readablestream",
      "transformstream",
      "textdecoderstream",
      "incremental decode",
      "stream pipeline",
      "byob reader",
      "bidirectional stream",
      "unidirectional stream",
      "webtransport stream"
    ]
  },
  {
    route: "task-local",
    keywords: [
      "task-local",
      "已有 task-local",
      "artifacts/tasks/",
      "task artifact",
      "route-state.json",
      "route-plan.md",
      "clues.md",
      "progress.md",
      "task-close",
      "task close",
      "workspaceroot",
      "external workspace",
      "existing task-local",
      "skill 项目目录",
      "skill 仓库",
      "外部 workspace",
      "外部任务目录"
    ]
  },
  {
    route: "source-map",
    keywords: ["source map", "sourcemap", "sourcemappingurl", "hidden source map"]
  },
  {
    route: "session",
    keywords: ["session", "bootstrap", "token refresh", "refresh token", "relogin", "csrf", "cookie", "mstoken", "carrier"]
  },
  {
    route: "worker",
    keywords: [
      "service worker",
      "dedicated worker",
      "sharedworker",
      "worker script",
      "importscripts",
      "messagechannel",
      "worker-generated",
      "worker",
      "workbox",
      "fetch event",
      "navigation preload",
      "clients.claim",
      "skipwaiting",
      "precache",
      "runtime cache"
    ]
  },
  {
    route: "frame",
    keywords: ["iframe", "frame tree", "cross-frame", "target frame", "top frame", "child frame"]
  },
  {
    route: "storage",
    keywords: [
      "localstorage",
      "sessionstorage",
      "indexeddb",
      "storage snapshot",
      "storage key",
      "cookie -> memory",
      "storage -> memory",
      "memory signer state",
      "cachestorage",
      "cache storage",
      "precache",
      "runtime cache"
    ]
  },
  {
    route: "fingerprint",
    keywords: [
      "fingerprint",
      "canvas",
      "webgl",
      "audio fingerprint",
      "navigator",
      "anti-bot",
      "anti bot",
      "bot detection",
      "browser-surface",
      "webdriver",
      "useragentdata",
      "user agent data",
      "ua client hints",
      "uach",
      "uahints",
      "chrome runtime",
      "playwright leak",
      "puppeteer leak",
      "headless",
      "akamai",
      "_abck",
      "bm_sz",
      "sensor_data",
      "protection provider",
      "fonts",
      "timezone",
      "languages",
      "device memory"
    ]
  },
  {
    route: "bundle-loader",
    keywords: [
      "bundle-loader",
      "chunk loader",
      "async chunk",
      "webpackjsonp",
      "__webpack_require__.e",
      "preload orchestrator",
      "remoteentry",
      "runtime chunks",
      "framework runtime chunks",
      "modulepreload",
      "import analysis"
    ]
  },
  {
    route: "challenge-orchestration",
    keywords: ["challenge token", "captcha", "turnstile", "silent challenge", "risk route", "challenge route", "bypass strategy", "akamai", "protection provider", "bm_sz", "_abck"]
  },
  {
    route: "webauthn-passkey",
    keywords: ["webauthn", "passkey", "navigator.credentials", "publickeycredential", "webauthn.create", "webauthn.get"]
  },
  {
    route: "behavior-telemetry",
    keywords: ["mousemove", "scroll cadence", "visibilitychange", "input rhythm", "behavior telemetry", "interaction trace", "mouse trajectory", "trajectory", "high frequency", "high-frequency"]
  },
  {
    route: "media-drm",
    keywords: [
      "requestmediakeysystemaccess",
      "mediasource",
      "encrypted event",
      "license request",
      "m3u8",
      "mpd",
      "drm",
      "nal",
      "nalu",
      "pes",
      "mpegts",
      "ts segment",
      "video ts",
      "video frame",
      "decrypt",
      "clearkey",
      "sourcebuffer",
      "key session",
      "sample-aes",
      "sample aes",
      "cenc",
      "cbcs",
      "segment decrypt",
      "frame boundary",
      "content decryption",
      "clear frame",
      "playback decrypt"
    ]
  },
  {
    route: "anti-tamper",
    keywords: ["trusted types", "sri", "csp", "integrity", "hook seal", "self-check", "tostring integrity"]
  },
  {
    route: "framework-runtime",
    keywords: [
      "__next_data__",
      "next.js",
      "nuxt",
      "remix",
      "vite",
      "sveltekit",
      "astro",
      "hydration",
      "framework runtime",
      "ssr/csr",
      "import.meta",
      "modulepreload",
      "islands",
      "partial hydration",
      "server islands",
      "flight payload"
    ]
  },
  {
    route: "webrtc-datachannel",
    keywords: ["rtcpeerconnection", "rtcdatachannel", "createoffer", "setlocaldescription", "ice candidate", "ice", "datachannel"]
  },
  {
    route: "beacon-reporting",
    keywords: ["sendbeacon", "reportingobserver", "report-to", "pagehide", "beacon", "unload report"]
  },
  {
    route: "browser-controlled-reuse",
    keywords: ["browser-controlled", "browser controlled", "browser harness", "accepted request", "session maintenance", "network interception", "stealth", "browser reuse", "playwright interception", "puppeteer stealth"]
  }
];

const routeKeywordAliases = {
  signature: ["签名", "签名参数", "签名链路", "验签", "时间戳", "随机串", "归一化规则", "请求验收", "签名器", "签名状态"],
  "ast-deobfuscation": ["去混淆", "反混淆", "控制流平坦化", "字符串数组", "调度器对象", "还原常量", "混淆代码", "死代码", "不可达块", "控制流还原"],
  jsvmp: ["虚拟机保护", "虚拟机", "操作码", "字节码", "处理器表", "调度分发", "解释器保护"],
  env: ["补环境", "环境补齐", "第一处偏差", "首个偏差", "环境漂移", "浏览器补环境", "宿主差异"],
  "anti-debug": ["反调试", "调试陷阱", "开发者工具检测", "无限暂停", "断点陷阱"],
  "instrumentation-hooking": [
    "插桩",
    "预加载注入",
    "运行时注入",
    "写入链",
    "读写链",
    "统一事件流",
    "状态写入链",
    "请求使用",
    "链路取证",
    "高语义 hook",
    "payload 边界",
    "dispatch",
    "sign callsite",
    "低层 hook",
    "script.src",
    "appendchild",
    "document.cookie"
  ],
  wasm: ["webassembly", "实例化", "胶水代码", "wasm 保护"],
  protocol: ["长连接", "协议重放", "重放脚本", "消息格式", "消息边界", "字段边界", "接口重放", "协议重建", "消息流"],
  subtlecrypto: ["浏览器密码接口", "密钥导入", "派生密钥", "摘要计算", "浏览器签名接口"],
  "userland-crypto": ["用户态密码", "前端密码库", "明密文", "纯算法实现", "加密边界"],
  "binary-codec": ["二进制消息", "二进制协议", "字段编码", "变长整数", "线格式", "schema 恢复"],
  "graphql-rpc": ["持久化查询", "操作名", "查询哈希", "图查询接口"],
  "grpc-web": ["帧边界", "尾部状态", "grpc 协议"],
  "compression-stream": ["压缩流", "解压流", "压缩边界", "压缩消息"],
  "dynamic-code": ["动态代码", "动态导入", "字符串定时器", "blob 脚本", "动态加载代码"],
  "module-federation": ["模块联邦", "远程入口", "共享作用域"],
  "microfrontend-runtime": ["微前端", "子应用", "远程清单", "加载顺序"],
  "cross-context-coordination": ["跨上下文", "广播通道", "共享内存", "消息图"],
  "streaming-runtime": ["流式运行时", "增量解码", "流管线"],
  "task-local": ["任务目录", "状态文件", "路线状态", "续跑任务", "已有任务"],
  "source-map": ["源码映射", "映射文件", "隐藏映射"],
  session: ["登录态", "会话态", "续签", "刷新令牌", "会话引导"],
  worker: ["工作线程", "共享线程", "服务工作线程", "导航预加载", "消息泵"],
  frame: ["框架树", "跨 frame", "子 frame", "跨窗口消息"],
  storage: ["本地存储", "会话存储", "索引数据库", "缓存存储", "关键键位", "存储快照", "存储到内存", "内存签名状态"],
  fingerprint: ["浏览器指纹", "自动化检测", "无头痕迹", "字体", "时区", "画布", "音频指纹"],
  "bundle-loader": ["分包加载", "异步分块", "chunk 加载", "预加载顺序"],
  "challenge-orchestration": ["挑战状态机", "风控挑战", "验证码", "静默挑战", "挑战链路"],
  "webauthn-passkey": ["通行密钥", "凭证流程", "公钥凭证"],
  "behavior-telemetry": ["行为遥测", "鼠标轨迹", "滚动节奏", "焦点切换", "输入节奏"],
  "media-drm": ["版权保护", "license 请求", "媒体密钥", "加密事件", "视频帧", "内容解密", "明文边界", "drm 解密", "帧解密", "nal 单元", "pes", "ts 视频", "视频 ts", "视频分片"],
  "anti-tamper": ["完整性自检", "自校验", "hook 封印", "篡改检测"],
  "framework-runtime": ["框架运行时", "水合边界", "同构边界", "岛屿架构", "flight 数据"],
  "webrtc-datachannel": ["rtc 数据通道", "信令流程", "ice 候选"],
  "beacon-reporting": ["信标上报", "隐藏上报", "页面卸载上报"],
  "browser-controlled-reuse": ["浏览器控制复用", "puppeteer 复用", "playwright 复用", "会话维持", "网络拦截", "浏览器 harness", "浏览器内 harness", "浏览器内可控复用", "accepted request", "稳定重放"]
};

const routeRules = baseRouteRules.map((rule) => ({
  ...rule,
  keywords: [...rule.keywords, ...(routeKeywordAliases[rule.route] || [])]
}));

const englishInvestigativeHints = [
  "reverse",
  "recover",
  "replay",
  "signer",
  "capture",
  "trace",
  "triage",
  "deobfuscate",
  "profile the",
  "locate",
  "reconstruct",
  "snapshot",
  "bypass",
  "pivot",
  "confirm the",
  "continue",
  "task-local",
  "first divergence",
  "drift matrix",
  "beacon log",
  "reporting map",
  "state machine",
  "credential flow",
  "schema map",
  "opcode mapping",
  "message graph",
  "x-bogus",
  "x-gnarly",
  "mstoken",
  "swap matrix"
];
const chineseInvestigativeHints = [
  "逆向",
  "还原",
  "重放",
  "取证",
  "追踪",
  "定位",
  "重建",
  "排查",
  "补环境",
  "复现",
  "去混淆",
  "抓包",
  "续跑",
  "继续任务",
  "切入点",
  "第一处偏差",
  "首个偏差",
  "状态机",
  "消息图",
  "探针顺序",
  "风控挑战",
  "签名链路",
  "签名状态"
];
const investigativeHints = [...englishInvestigativeHints, ...chineseInvestigativeHints];

const englishConstructiveHints = [
  "smoke test",
  "e2e test",
  "ui test",
  "design a backend",
  "graphql client",
  "grpc-web client",
  "chat demo",
  "dashboard app",
  "image-processing module",
  "performance in vite",
  "login page ui",
  "sidebar menu",
  "avatar visible",
  "help debug",
  "ui bug",
  "toolkit",
  "from scratch",
  "bundle size",
  "reduce binary size",
  "compiled from rust",
  "improve instantiation speed",
  "profile memory growth",
  "ui state",
  "theory",
  "common use cases"
];
const chineseConstructiveHints = [
  "冒烟测试",
  "端到端测试",
  "自动化测试",
  "设计一个后端",
  "设计后端",
  "封装客户端",
  "管理后台",
  "聊天演示",
  "侧边菜单",
  "用户头像",
  "界面交互",
  "登录页",
  "教学例子",
  "原理",
  "通用用法",
  "性能优化",
  "从零实现",
  "做一个小工具",
  "页面 ui",
  "表单交互"
];
const constructiveHints = [...englishConstructiveHints, ...chineseConstructiveHints];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[，。；：！？（）【】《》、]/g, " ")
    .replace(/\s*->\s*/g, " -> ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(query, keywords) {
  return keywords.some((keyword) => query.includes(keyword));
}

function hasProtocolReplaySignals(query) {
  return includesAny(query, [
    "websocket",
    "sse",
    "webtransport",
    "datagram",
    "bidirectional stream",
    "unidirectional stream",
    "protobuf",
    "msgpack",
    "grpc-web",
    "connect-web",
    "replay",
    "长连接",
    "重放",
    "消息格式",
    "二进制消息",
    "协议重建",
    "协议重放"
  ]);
}

function requiresLocalReproduction(query) {
  return includesAny(query, [
    "local reproduction",
    "local repro",
    "local rebuild",
    "run locally",
    "本地复现",
    "本地实现",
    "本地重放",
    "脱离浏览器",
    "离线复现"
  ]);
}

export function inferRoutes(query) {
  const normalized = normalize(query);
  const routes = new Set();
  for (const rule of routeRules) {
    if (includesAny(normalized, rule.keywords)) {
      routes.add(rule.route);
    }
  }
  if (routes.has("jsvmp") && normalized.includes("wasm")) {
    routes.add("wasm");
  }
  if (
    routes.has("task-local") &&
    (normalized.includes("first divergence") ||
      normalized.includes("第一处偏差") ||
      normalized.includes("首个偏差"))
  ) {
    routes.add("env");
  }
  if (
    (normalized.includes("签名状态") || normalized.includes("签名器状态")) &&
    (normalized.includes("存储") || normalized.includes("内存"))
  ) {
    routes.add("storage");
  }
  if (
    normalized.includes("请求使用") ||
    normalized.includes("状态写入链") ||
    normalized.includes("链路取证")
  ) {
    routes.add("instrumentation-hooking");
  }
  if (
    normalized.includes("artifacttruthroot") ||
    normalized.includes("tasklocalroot") ||
    normalized.includes("workspacekind") ||
    normalized.includes("activeentrypoints") ||
    normalized.includes("entrypointstatuses") ||
    normalized.includes("nextentrypointid") ||
    normalized.includes("nextexecutableaction") ||
    normalized.includes("acceptancegap") ||
    normalized.includes("nextevidencegate") ||
    normalized.includes("replygatedecision") ||
    normalized.includes("requireduseraction") ||
    normalized.includes("resumecondition") ||
    normalized.includes("deliveryadoptionstatus") ||
    normalized.includes("usedartifacts") ||
    normalized.includes("unusedartifacts")
  ) {
    routes.add("task-local");
  }
  return Array.from(routes).sort();
}

export function inferArtifacts(query, routes = inferRoutes(query)) {
  const normalized = normalize(query);
  const artifacts = new Set(["artifacts/tasks/<task-id>/report.md"]);
  const localReproductionRequired = requiresLocalReproduction(normalized);

  if (routes.includes("protocol") || hasProtocolReplaySignals(normalized)) {
    artifacts.add("run/protocol-notes.md");
    artifacts.add("run/web-replay.js");
    artifacts.add("run/tls-http-fingerprint-notes.md");
    artifacts.add("run/tls-http-fingerprint-profile.json");
  }
  if (
    normalized.includes("closeout") ||
    normalized.includes("task-close") ||
    normalized.includes("task close") ||
    normalized.includes("verify-once.mjs") ||
    normalized.includes("fixtures") ||
    normalized.includes("已进入 close")
  ) {
    artifacts.add("run/verify-once.mjs");
    artifacts.add("run/fixtures.json");
  }
  if (routes.includes("signature")) {
    artifacts.add("run/signature-input-map.md");
    artifacts.add("run/signature-fixtures.json");
    artifacts.add("run/verify-once.mjs");
    if (
      localReproductionRequired ||
      normalized.includes("pure python") ||
      normalized.includes("pure algorithm") ||
      normalized.includes("脱离浏览器") ||
      normalized.includes("纯算法")
    ) {
      artifacts.add("run/pure-sign.py");
    }
  }
  if (
    normalized.includes("signer state") ||
    normalized.includes("签名器状态") ||
    normalized.includes("签名状态") ||
    normalized.includes("内存签名状态") ||
    normalized.includes("swap matrix") ||
    normalized.includes("200 空体") ||
    normalized.includes("一换签名器就失败") ||
    normalized.includes("x-bogus") ||
    normalized.includes("x-gnarly") ||
    (routes.includes("signature") &&
      (routes.includes("session") || routes.includes("storage")) &&
      routes.includes("instrumentation-hooking"))
  ) {
    artifacts.add("run/signer-state-map.md");
  }
  if (routes.includes("ast-deobfuscation")) {
    artifacts.add("run/before.js");
    artifacts.add("run/after.js");
    artifacts.add("run/deobf-rules.md");
    artifacts.add("run/ast-transform.mjs");
    artifacts.add("run/dead-code-analysis.md");
    artifacts.add("run/dead-code-eliminated.js");
    artifacts.add("run/dead-code-stats.json");
    artifacts.add("run/cff-dispatcher-var.md");
    artifacts.add("run/cff-block-map.json");
    artifacts.add("run/cff-cfg.json");
    artifacts.add("run/cff-deobfuscated.js");
    artifacts.add("run/string-array-mapping.json");
    artifacts.add("run/string-array-deobfuscated.js");
  }
  if (routes.includes("subtlecrypto")) {
    artifacts.add("run/subtlecrypto-notes.md");
    artifacts.add("run/subtlecrypto-keyflow.json");
  }
  if (routes.includes("userland-crypto")) {
    artifacts.add("run/crypto-callgraph.md");
    artifacts.add("run/plain-cipher-pairs.json");
    artifacts.add("run/pure-crypto.js");
  }
  if (routes.includes("binary-codec")) {
    artifacts.add("run/binary-codec-notes.md");
    artifacts.add("run/binary-samples.json");
  }
  if (routes.includes("graphql-rpc")) {
    artifacts.add("run/graphql-ops.json");
    artifacts.add("run/query-map.md");
  }
  if (routes.includes("grpc-web")) {
    artifacts.add("run/grpc-frame-notes.md");
    artifacts.add("run/grpc-schema-map.md");
    artifacts.add("run/grpc-replay.js");
  }
  if (routes.includes("compression-stream")) {
    artifacts.add("run/compression-stream-notes.md");
    artifacts.add("run/compression-samples.json");
  }
  if (routes.includes("jsvmp")) {
    artifacts.add("run/vm-opcodes.txt");
    artifacts.add("run/dispatcher-map.md");
    artifacts.add("run/vm-trace.jsonl");
    artifacts.add("run/vm-opcode-patterns.json");
    artifacts.add("run/vm-dataflow-analysis.json");
    artifacts.add("run/vm-algorithm-identification.md");
    artifacts.add("run/vm-lifted-semantics.js");
    artifacts.add("run/vm-semantic-verification.md");
    artifacts.add("run/vm-env-reads.json");
    artifacts.add("run/vm-decode-notes.md");
    if (
      normalized.includes("bytecode lifecycle") ||
      normalized.includes("动态字节码") ||
      normalized.includes("decode chain")
    ) {
      artifacts.add("run/vm-bytecode-lifecycle.md");
    }
    if (
      normalized.includes("nesting map") ||
      normalized.includes("嵌套 vm") ||
      normalized.includes("多层 js-vmp") ||
      normalized.includes("多层 vm") ||
      normalized.includes("外层 dispatcher 会调内层 handler table")
    ) {
      artifacts.add("run/vm-nesting-map.md");
    }
    if (
      normalized.includes("通用模板") ||
      normalized.includes("可迁移模板") ||
      normalized.includes("sop") ||
      normalized.includes("checklist") ||
      normalized.includes("tooling baseline") ||
      normalized.includes("template profile") ||
      normalized.includes("profile")
    ) {
      artifacts.add("run/vm-template-profile.json");
    }
  }
  if (routes.includes("env")) {
    artifacts.add("run/env-drift-matrix.md");
    artifacts.add("run/env-conformance-notes.md");
    artifacts.add("run/browser-env-snapshot.json");
    artifacts.add("run/env-as-algorithm-input.md");
    artifacts.add("run/env-algorithm-input-map.json");
  }
  if (routes.includes("anti-debug")) {
    artifacts.add("run/anti-debug-preload.js");
    artifacts.add("run/anti-debug-runtime.js");
  }
  if (routes.includes("instrumentation-hooking")) {
    artifacts.add("run/preload.js");
    artifacts.add("run/runtime-hooks.js");
    artifacts.add("run/hook-events.jsonl");
    artifacts.add("run/hook-safety-notes.md");
  }
  if (routes.includes("wasm")) {
    artifacts.add("run/wasm-analysis.wat");
    artifacts.add("run/wasm-imports-exports.json");
    artifacts.add("run/wasm-notes.md");
    artifacts.add("run/wasm-section-analysis.md");
    artifacts.add("run/wasm-data-segments.json");
    artifacts.add("run/wasm-algorithm-identification.md");
    artifacts.add("run/wasm-memory-layout.md");
    artifacts.add("run/wasm-binary-samples/");
    artifacts.add("run/wasm-jsvmp-bridge.md");
  }
  if (routes.includes("dynamic-code")) {
    artifacts.add("run/dynamic-code-capture-template.js");
    artifacts.add("run/dynamic-code-notes.md");
  }
  if (routes.includes("task-local") || normalized.includes("pure extraction") || normalized.includes("纯提取") || localReproductionRequired) {
    artifacts.add("run/pure-*.js");
  }
  if (localReproductionRequired) {
    artifacts.add("run/local-repro-example.js");
  }
  if (routes.includes("source-map")) {
    artifacts.add("run/source-map-notes.md");
  }
  if (routes.includes("session")) {
    artifacts.add("run/session-notes.md");
  }
  if (routes.includes("worker")) {
    artifacts.add("run/worker-notes.md");
  }
  if (routes.includes("frame")) {
    artifacts.add("run/frame-notes.md");
  }
  if (routes.includes("storage")) {
    artifacts.add("run/storage-snapshot.json");
    artifacts.add("run/storage-notes.md");
  }
  if (routes.includes("fingerprint")) {
    artifacts.add("run/fingerprint-profile.json");
    artifacts.add("run/fingerprint-notes.md");
    artifacts.add("run/fingerprint-inspector-template.js");
    artifacts.add("run/fingerprint-canvas-profile.json");
    artifacts.add("run/fingerprint-webgl-profile.json");
    artifacts.add("run/fingerprint-audio-profile.json");
  }
  if (routes.includes("bundle-loader")) {
    artifacts.add("run/chunk-loader-notes.md");
    artifacts.add("run/preload-orchestrator.js");
  }
  if (routes.includes("module-federation")) {
    artifacts.add("run/module-federation-notes.md");
    artifacts.add("run/remote-entry-map.json");
  }
  if (routes.includes("microfrontend-runtime")) {
    artifacts.add("run/runtime-map.json");
    artifacts.add("run/remote-deps.md");
  }
  if (routes.includes("cross-context-coordination")) {
    artifacts.add("run/context-map.md");
    artifacts.add("run/message-graph.json");
  }
  if (routes.includes("streaming-runtime")) {
    artifacts.add("run/streaming-runtime-notes.md");
    artifacts.add("run/stream-pipeline.json");
  }
  if (routes.includes("challenge-orchestration")) {
    artifacts.add("run/challenge-route-notes.md");
    artifacts.add("run/challenge-state-machine.json");
    artifacts.add("run/commercial-protection-identification.json");
    artifacts.add("run/commercial-protection-notes.md");
  }
  if (routes.includes("behavior-telemetry")) {
    artifacts.add("run/behavior-telemetry-notes.md");
    artifacts.add("run/telemetry-profile.json");
  }
  if (routes.includes("webauthn-passkey")) {
    artifacts.add("run/credential-flow.md");
    artifacts.add("run/request-response-samples.json");
  }
  if (routes.includes("anti-tamper")) {
    artifacts.add("run/anti-tamper-notes.md");
    artifacts.add("run/integrity-surface.json");
  }
  if (routes.includes("media-drm")) {
    artifacts.add("run/license-flow.md");
    artifacts.add("run/token-inputs.json");
    artifacts.add("run/frame-decryption-chain.md");
    artifacts.add("run/key-session-timeline.json");
    artifacts.add("run/clear-frame-samples/");
  }
  if (routes.includes("framework-runtime")) {
    artifacts.add("run/framework-runtime-notes.md");
    artifacts.add("run/framework-payload-map.json");
  }
  if (routes.includes("webrtc-datachannel")) {
    artifacts.add("run/signaling-map.md");
    artifacts.add("run/channel-frames.jsonl");
  }
  if (routes.includes("beacon-reporting")) {
    artifacts.add("run/beacon-log.jsonl");
    artifacts.add("run/reporting-map.md");
  }
  if (routes.includes("browser-controlled-reuse")) {
    artifacts.add("run/browser-controlled-repro.md");
    artifacts.add("run/browser-repro-script.js");
    artifacts.add("run/browser-env-override.js");
  }
  if (
    normalized.includes("web search") ||
    normalized.includes("websearch") ||
    normalized.includes("外部搜索") ||
    normalized.includes("github issue") ||
    normalized.includes("官方文档") ||
    normalized.includes("搜 github") ||
    normalized.includes("查资料") ||
    normalized.includes("existing research") ||
    normalized.includes("已有研究") ||
    normalized.includes("公开分析")
  ) {
    artifacts.add("state/external-research.md");
    artifacts.add("state/external-research.json");
  }
  if (
    normalized.includes("retrospective") ||
    normalized.includes("复盘") ||
    normalized.includes("park the stale route") ||
    normalized.includes("两轮") ||
    normalized.includes("two rounds") ||
    normalized.includes("several scripts") ||
    normalized.includes("多个脚本") ||
    normalized.includes("close this deep-dive permit") ||
    normalized.includes("关闭 deep-dive permit") ||
    normalized.includes("停止该深层 microroute") ||
    normalized.includes("stop the microroute")
  ) {
    artifacts.add("run/retrospective.md");
  }
  if (
    (routes.includes("anti-debug") && routes.includes("dynamic-code")) ||
    (routes.includes("anti-tamper") && routes.includes("dynamic-code")) ||
    (routes.includes("jsvmp") && routes.includes("anti-debug")) ||
    normalized.includes("composite protection") ||
    normalized.includes("cascade diagnosis")
  ) {
    artifacts.add("run/composite-protection-map.md");
  }

  return Array.from(artifacts).sort();
}

export function inferReasoningTags(query, routes = inferRoutes(query)) {
  const normalized = normalize(query);
  const tags = new Set();

  if (inferTrigger(query)) {
    tags.add("entrypoint-loop");
    tags.add("probe-before-expansion");
  }

  if (
    normalized.includes("continue") ||
    normalized.includes("继续昨天的") ||
    normalized.includes("继续现有") ||
    normalized.includes("继续已有任务") ||
    normalized.includes("继续已有 task-local") ||
    normalized.includes("继续这个已有 task-local") ||
    normalized.includes("继续执行前") ||
    normalized.includes("继续执行") ||
    normalized.includes("当前已有 task-local") ||
    normalized.includes("读取状态文件") ||
    normalized.includes("自动推进下一阶段") ||
    normalized.includes("按 nextexecutableaction 继续") ||
    normalized.includes("existing task-local") ||
    normalized.includes("yesterday's task-local") ||
    normalized.includes("read task.json") ||
    normalized.includes("state/route-state.json")
  ) {
    tags.add("resume-then-advance");
  }

  if (
    (normalized.includes("已加载") || normalized.includes("已登录") || normalized.includes("resume-from-user")) &&
    (normalized.includes("blocked-on-user") || normalized.includes("pause-category=none") || normalized.includes("clear pause"))
  ) {
    tags.add("resume-after-user-collab");
    tags.add("clear-user-pause-first");
  }

  if (
    normalized.includes("external workspace") ||
    normalized.includes("workspaceroot") ||
    normalized.includes("skill 项目目录") ||
    normalized.includes("skill 仓库") ||
    normalized.includes("外部 workspace") ||
    normalized.includes("外部任务目录")
  ) {
    tags.add("external-workspace-awareness");
  }

  if (
    normalized.includes("artifacttruthroot") ||
    normalized.includes("tasklocalroot") ||
    normalized.includes("workspacekind") ||
    normalized.includes("truth root") ||
    normalized.includes("路径真源")
  ) {
    tags.add("truth-root-reporting");
  }

  if (
    normalized.includes("不要停止") ||
    normalized.includes("不准停止") ||
    normalized.includes("不要只汇报状态") ||
    normalized.includes("除非拿到新证据") ||
    normalized.includes("没有成功前不准停止") ||
    normalized.includes("until success") ||
    normalized.includes("do not stop before success") ||
    normalized.includes("no status-only response")
  ) {
    tags.add("continuous-execution-discipline");
  }

  if (
    normalized.includes("new task") ||
    normalized.includes("新任务") ||
    normalized.includes("没有历史数据文件") ||
    normalized.includes("任务目录初始化") ||
    normalized.includes("new web reverse task") ||
    normalized.includes("no history data files") ||
    normalized.includes("before task-local initialization")
  ) {
    tags.add("new-task-init-first");
  }

  if (
    normalized.includes("retrospective") ||
    normalized.includes("复盘") ||
    normalized.includes("切入点都已耗尽") ||
    normalized.includes("全部已停放") ||
    normalized.includes("pivot if it fails") ||
    normalized.includes("pivot when it fails") ||
    normalized.includes("all current entrypoints are parked") ||
    normalized.includes("all current entrypoints are exhausted") ||
    normalized.includes("all entrypoints are parked") ||
    normalized.includes("all entrypoints are exhausted") ||
    normalized.includes("parked / exhausted") ||
    normalized.includes("parked") ||
    normalized.includes("exhausted")
  ) {
    tags.add("retrospective-on-exhaustion");
  }

  if (
    normalized.includes("two rounds") ||
    normalized.includes("两轮") ||
    normalized.includes("same hypothesis") ||
    normalized.includes("同一假说") ||
    normalized.includes("stale route") ||
    normalized.includes("停损")
  ) {
    tags.add("retrospective-on-stall");
  }

  if (
    normalized.includes("deep-dive permit") ||
    normalized.includes("deep dive permit") ||
    normalized.includes("deepdivepermit") ||
    normalized.includes("深挖许可") ||
    normalized.includes("继续深入") ||
    normalized.includes("continue this wasm microroute") ||
    normalized.includes("开启 deep-dive permit")
  ) {
    tags.add("deep-dive-permit");
  }

  if (
    normalized.includes("close this deep-dive permit") ||
    normalized.includes("close the deep-dive permit") ||
    normalized.includes("停止该深层 microroute") ||
    normalized.includes("结束 deep-dive permit") ||
    normalized.includes("关闭 deep-dive permit")
  ) {
    tags.add("deep-dive-permit-close");
  }

  if (
    normalized.includes("microroute") ||
    normalized.includes("micro route") ||
    normalized.includes("微路线")
  ) {
    tags.add("micro-route-budgeting");
  }

  if (
    (normalized.includes("microroute") || normalized.includes("micro route") || normalized.includes("微路线")) &&
    (normalized.includes("stop") || normalized.includes("停掉") || normalized.includes("关闭") || normalized.includes("exhausted") || normalized.includes("低价值"))
  ) {
    tags.add("micro-route-stop-loss");
  }

  if (
    normalized.includes("不要直接放弃整个 vm 专题") ||
    normalized.includes("不要直接放弃整个专题") ||
    normalized.includes("不要停掉整个 vm 专题") ||
    normalized.includes("stop the microroute") ||
    normalized.includes("not the whole vm topic") ||
    normalized.includes("不该停整个专题")
  ) {
    tags.add("stop-micro-route-not-topic");
    tags.add("no-mechanical-topic-abandon");
  }

  if (
    normalized.includes("high value evidence") ||
    normalized.includes("高价值证据") ||
    normalized.includes("semantic bridge") ||
    normalized.includes("语义桥接") ||
    normalized.includes("each round adds") ||
    normalized.includes("每一轮都新增") ||
    normalized.includes("每轮都恢复")
  ) {
    tags.add("high-value-evidence-growth");
  }

  if (
    normalized.includes("更高价值路线") ||
    normalized.includes("higher-value route") ||
    normalized.includes("高价值证据增长更快")
  ) {
    tags.add("high-value-evidence-priority");
  }

  if (
    normalized.includes("dispatcher -> handler family") ||
    normalized.includes("语义桥接") ||
    normalized.includes("semantic boundary") ||
    normalized.includes("handler clustering")
  ) {
    tags.add("semantic-boundary-growth");
  }

  if (
    normalized.includes("export -> thunk -> table") ||
    normalized.includes("table mapping") ||
    normalized.includes("table slot")
  ) {
    tags.add("table-mapping");
  }

  if (normalized.includes("first divergence") || normalized.includes("第一处有效分歧")) {
    tags.add("first-divergence-growth");
  }

  if (
    normalized.includes("internal-call relation") ||
    normalized.includes("internal call") ||
    normalized.includes("browser internal direct-call")
  ) {
    tags.add("internal-call-mapping");
  }

  if (
    normalized.includes("helper functions") ||
    normalized.includes("reformatted the wat") ||
    normalized.includes("prettier formatting") ||
    normalized.includes("代码看起来更干净")
  ) {
    tags.add("pretty-output-not-high-value");
  }

  if (
    normalized.includes("string decoder") &&
    (normalized.includes("sign-call") || normalized.includes("canonical payload"))
  ) {
    tags.add("string-chain-to-sign-call");
    if (normalized.includes("semantic lifting") || normalized.includes("语义提升")) {
      tags.add("semantic-lifting");
    }
  }

  if (
    normalized.includes("allow only that route to hold a deep-dive permit") ||
    normalized.includes("single deep permit") ||
    normalized.includes("only that route to hold") ||
    normalized.includes("只允许一条")
  ) {
    tags.add("single-deep-permit");
  }

  if (
    normalized.includes("代码看起来更干净了") ||
    normalized.includes("prettier formatting") ||
    normalized.includes("业务 action") ||
    normalized.includes("request-use") ||
    normalized.includes("sign-call")
  ) {
    tags.add("business-boundary-before-pretty-code");
  }

  if (normalized.includes("acceptance-first") || normalized.includes("只要可交付 harness") || normalized.includes("当前只要可交付 harness")) {
    tags.add("acceptance-first");
  }

  if (
    normalized.includes("deliverabletier") ||
    normalized.includes("deliverable tier") ||
    normalized.includes("do not overbuild") ||
    normalized.includes("不要过度建设") ||
    normalized.includes("不要提前升级") ||
    normalized.includes("only needs a browser-controlled harness") ||
    normalized.includes("可交付 harness") ||
    normalized.includes("只需要浏览器内可控复用") ||
    normalized.includes("pure extraction") ||
    normalized.includes("降级到浏览器内可控复用") ||
    normalized.includes("暂停纯算法路线")
  ) {
    tags.add("deliverable-tier-control");
  }

  if (
    (normalized.includes("纯 python") || normalized.includes("纯 node") || normalized.includes("不依赖 playwright") || normalized.includes("不依赖 浏览器框架") || normalized.includes("不依赖浏览器框架")) &&
    (normalized.includes("browser harness") || normalized.includes("playwright poc") || normalized.includes("browser-controlled") || normalized.includes("浏览器框架"))
  ) {
    tags.add("pure-local-target-guard");
    tags.add("browser-tier-not-final");
  }

  if (
    normalized.includes("browser-controlled harness") ||
    normalized.includes("browser-controlled reuse") ||
    normalized.includes("浏览器内可控复用")
  ) {
    tags.add("browser-before-pure-extraction");
  }

  if (
    normalized.includes("primary topic") ||
    normalized.includes("secondary topics") ||
    normalized.includes("主专题") ||
    normalized.includes("辅助专题") ||
    normalized.includes("one primary microroute") ||
    normalized.includes("at most two secondary topics") ||
    normalized.includes("最多 2 个辅助专题")
  ) {
    tags.add("topic-budgeting");
  }

  if (
    normalized.includes("do not bulk-load") ||
    normalized.includes("不要批量加载") ||
    normalized.includes("不要一次性") ||
    normalized.includes("不要批量通读") ||
    normalized.includes("bulk-load every playbook")
  ) {
    tags.add("focused-reference-loading");
  }

  if (
    normalized.includes("provisional") ||
    normalized.includes("route-ready") ||
    normalized.includes("acceptance-ready") ||
    normalized.includes("delivered") ||
    normalized.includes("不要宣称") ||
    normalized.includes("结论标成")
  ) {
    tags.add("claim-precision");
  }

  if (
    normalized.includes("acceptancegap") ||
    normalized.includes("nextevidencegate") ||
    normalized.includes("还差哪条直接证据") ||
    normalized.includes("下一证据门") ||
    normalized.includes("whynotdeliveredyet")
  ) {
    tags.add("evidence-frontier");
  }

  if (
    normalized.includes("activeentrypoints") ||
    normalized.includes("entrypointstatuses") ||
    normalized.includes("nextentrypointid") ||
    normalized.includes("ep-") ||
    normalized.includes("切入点循环")
  ) {
    tags.add("entrypoint-ledger");
  }

  if (
    normalized.includes("do not lock onto one topic") ||
    normalized.includes("不要锁定单一专题") ||
    normalized.includes("多个切入点") ||
    normalized.includes("先试成本最低") ||
    normalized.includes("复合场景") ||
    normalized.includes("composite scene") ||
    normalized.includes("multiple entrypoints") ||
    normalized.includes("cheapest one first") ||
    normalized.includes("triage the composite scene") ||
    routes.length >= 4
  ) {
    tags.add("multi-entrypoint-triage");
  }

  if (routes.includes("env")) {
    tags.add("first-divergence-before-broad-patch");
  }

  if (routes.includes("anti-debug")) {
    tags.add("hook-before-breakpoint");
  }

  if (routes.includes("protocol") && routes.includes("binary-codec")) {
    tags.add("schema-before-replay");
  }

  if (routes.includes("behavior-telemetry") && routes.includes("challenge-orchestration")) {
    tags.add("telemetry-before-challenge-routing");
  }

  if (
    routes.includes("signature") &&
    routes.includes("instrumentation-hooking") &&
    (routes.includes("session") || routes.includes("storage") || normalized.includes("signer state"))
  ) {
    tags.add("stateful-signer-pivot");
    tags.add("carrier-chain-before-patch");
    tags.add("avoid-broad-env-patching");
    tags.add("high-semantic-hook-first");
    tags.add("acceptance-boundary-first");
  }

  if (
    normalized.includes("document.cookie") ||
    normalized.includes("cookiestore") ||
    normalized.includes("script.src") ||
    normalized.includes("appendchild") ||
    normalized.includes("setattribute") ||
    normalized.includes("低层 hook") ||
    normalized.includes("低层 surface") ||
    normalized.includes("hook 死循环") ||
    normalized.includes("hook 钻牛角尖") ||
    normalized.includes("一直尝试 hook") ||
    normalized.includes("repeated hook") ||
    normalized.includes("wrong hook layer")
  ) {
    tags.add("high-semantic-hook-first");
    tags.add("same-family-hook-retry-cap");
    tags.add("acceptance-boundary-first");
  }

  if (routes.includes("anti-tamper") && routes.includes("dynamic-code")) {
    tags.add("integrity-before-loader-patch");
  }

  if (routes.includes("jsvmp") && routes.includes("media-drm")) {
    tags.add("compound-protection-tier-T7");
    tags.add("drm-mode-content-decryption");
    tags.add("jsvmp-after-license-response");
    tags.add("clear-frame-boundary-first");
    tags.add("blackbox-before-deep-analysis");
  }

  if (routes.includes("media-drm") && normalized.includes("sample-aes")) {
    tags.add("encryption-scheme-sample-aes");
    tags.add("key-uri-recovery");
    tags.add("segment-decryption-verification");
  }

  if (routes.includes("wasm") && routes.includes("media-drm") && (normalized.includes("does not use eme") || normalized.includes("not use cdm") || normalized.includes("directly decrypts") || normalized.includes("non-cdm"))) {
    tags.add("non-cdm-decryption-path");
    tags.add("wasm-memory-bridge");
    tags.add("ciphertext-plaintext-pairs");
  }

  if (
    normalized.includes("first 256 bytes") ||
    normalized.includes("前 256 字节") ||
    normalized.includes("前256字节") ||
    normalized.includes("partial sample") ||
    normalized.includes("局部样本") ||
    normalized.includes("offset 64-67") ||
    normalized.includes("offset 64 67")
  ) {
    tags.add("partial-sample-provisional");
    tags.add("full-payload-diff-before-custom-theory");
  }

  if (
    normalized.includes("s-box") ||
    normalized.includes("标准家族") ||
    normalized.includes("standard family") ||
    normalized.includes("algorithm family") ||
    normalized.includes("tea") ||
    normalized.includes("xtea") ||
    normalized.includes("xxtea") ||
    normalized.includes("aes") ||
    normalized.includes("sm4") ||
    normalized.includes("rc4") ||
    normalized.includes("chacha") ||
    normalized.includes("findcrypt") ||
    normalized.includes("signsrch")
  ) {
    tags.add("algorithm-family-triage");
    tags.add("standard-before-custom");
  }

  if (
    normalized.includes("direct-call") ||
    normalized.includes("direct call") ||
    normalized.includes("browser internal") ||
    normalized.includes("func60") ||
    normalized.includes("wasm2wat") ||
    normalized.includes("table/thunk") ||
    normalized.includes("table slot") ||
    normalized.includes("export returns the original byte length") ||
    normalized.includes("unchanged bytes") ||
    normalized.includes("未修改") ||
    normalized.includes("side effects") ||
    normalized.includes("side effect") ||
    normalized.includes("vmptag") ||
    normalized.includes("staticcallmodulevod")
  ) {
    tags.add("direct-internal-call-before-sample-mining");
  }

  if (
    normalized.includes("10 sample-analysis scripts") ||
    normalized.includes("10 sample analysis scripts") ||
    normalized.includes("thousands of statistical samples") ||
    normalized.includes("65536") ||
    normalized.includes("script sprawl") ||
    normalized.includes("同一假说") ||
    normalized.includes("10 个脚本") ||
    normalized.includes("多个脚本") ||
    normalized.includes("several scripts")
  ) {
    tags.add("hypothesis-stop-loss");
  }

  if (routes.includes("media-drm") && (normalized.includes("clear frame") || normalized.includes("frame boundary") || normalized.includes("video frame"))) {
    tags.add("clear-frame-boundary-first");
    tags.add("blackbox-before-deep-analysis");
  }

  if (normalized.includes("dead code") || normalized.includes("unreachable blocks") || normalized.includes("side-effect")) {
    tags.add("dead-code-elimination");
    tags.add("reachability-analysis");
    tags.add("side-effect-detection");
  }

  if (routes.includes("jsvmp") && routes.includes("wasm")) {
    tags.add("vm-wasm-bridge");
    tags.add("cross-boundary-trace");
    tags.add("hybrid-decomposition");
  }

  if (routes.includes("env") && routes.includes("signature")) {
    tags.add("env-as-algorithm-input");
    tags.add("detection-pass-vs-algorithm-pass");
    tags.add("swap-verification");
    tags.add("sign-field-tracing");
  }

  if (normalized.includes("pure python") || normalized.includes("migrate it to pure python") || normalized.includes("pure algorithm")) {
    tags.add("pure-extraction");
    tags.add("python-port");
    tags.add("algorithm-boundary-lock");
  }

  if (normalized.includes("verify") && (normalized.includes("before close") || normalized.includes("closeout"))) {
    tags.add("verify-before-close");
  }

  if (
    routes.includes("anti-debug") &&
    (routes.includes("dynamic-code") || routes.includes("anti-tamper") || routes.includes("jsvmp"))
  ) {
    tags.add("composite-protection");
    tags.add("cascade-diagnosis");
    tags.add("trigger-dependency");
    tags.add("integrity-vs-state");
    tags.add("minimal-breakpoint");
  }

  if (normalized.includes("control flow flattening") || normalized.includes("while-switch") || normalized.includes("rotated array")) {
    tags.add("control-flow-flattening");
    tags.add("string-array-deobfuscation");
    tags.add("cfg-reconstruction");
    tags.add("block-clustering");
  }

  if (normalized.includes("akamai") || normalized.includes("protection provider") || normalized.includes("_abck") || normalized.includes("bm_sz")) {
    tags.add("commercial-protection-identification");
    tags.add("provider-fingerprint");
    tags.add("high-frequency-telemetry");
    tags.add("behavior-synthesis");
  }

  if (normalized.includes("ja3") || normalized.includes("tls fingerprint") || normalized.includes("transport layer")) {
    tags.add("tls-fingerprint");
    tags.add("ja3-matching");
    tags.add("transport-layer-evasion");
    tags.add("curl-cffi");
  }

  if (
    routes.includes("fingerprint") &&
    (normalized.includes("canvas") || normalized.includes("webgl") || normalized.includes("offlineaudiocontext") || normalized.includes("audio"))
  ) {
    tags.add("deep-vector-analysis");
    tags.add("canvas-hook");
    tags.add("webgl-renderer-spoof");
    tags.add("audio-fingerprint");
    tags.add("minimal-patch-surface");
  }

  if (routes.includes("jsvmp") && (normalized.includes("semantic") || normalized.includes("lift"))) {
    tags.add("semantic-lifting");
    tags.add("pattern-recognition");
    tags.add("algorithm-identification");
    tags.add("def-use-chain");
    tags.add("magic-number-matching");
  }

  if (routes.includes("wasm") && (normalized.includes("binary structure") || normalized.includes("data segment") || normalized.includes("section"))) {
    tags.add("wasm-binary-analysis");
    tags.add("section-inspection");
    tags.add("data-segment-extraction");
    tags.add("algorithm-pattern-matching");
    tags.add("memory-layout-mapping");
  }

  if (routes.includes("browser-controlled-reuse")) {
    tags.add("browser-controlled-reuse");
    tags.add("puppeteer-stealth");
    tags.add("network-interception");
    tags.add("session-maintenance");
  }

  if (
    normalized.includes("web search") ||
    normalized.includes("websearch") ||
    normalized.includes("外部搜索") ||
    normalized.includes("github issue") ||
    normalized.includes("官方文档") ||
    normalized.includes("搜 github") ||
    normalized.includes("查资料") ||
    normalized.includes("provider") ||
    normalized.includes("sdk family") ||
    normalized.includes("existing research") ||
    normalized.includes("已有研究") ||
    normalized.includes("公开分析")
  ) {
    tags.add("websearch-escalation");
    tags.add("source-triangulation");
    tags.add("hypothesis-correction");
  }

  if (
    normalized.includes("recover from") ||
    normalized.includes("wrong conclusion") ||
    normalized.includes("corrected you") ||
    normalized.includes("status-only") ||
    normalized.includes("status only") ||
    normalized.includes("misplaced") ||
    normalized.includes("workspace root") ||
    normalized.includes("premature") ||
    (normalized.includes("declared") && normalized.includes("completed")) ||
    normalized.includes("cycling through") ||
    normalized.includes("hook cycle") ||
    normalized.includes("repeated hook")
  ) {
    tags.add("execution-drift-recovery");
  }

  if (
    normalized.includes("cycling through") ||
    normalized.includes("repeated hook") ||
    normalized.includes("hook cycle") ||
    (normalized.includes("low-level hook") && normalized.includes("rounds"))
  ) {
    tags.add("same-family-hook-retry-cap-exceeded");
  }

  if (
    normalized.includes("pivot to") &&
    (normalized.includes("high-semantic") || normalized.includes("dispatch") || normalized.includes("payload"))
  ) {
    tags.add("pivot-to-high-semantic");
  }

  if (
    normalized.includes("wrong conclusion") ||
    normalized.includes("corrected you") ||
    normalized.includes("ffprobe")
  ) {
    tags.add("wrong-conclusion-correction");
  }

  if (
    normalized.includes("content-layer") ||
    normalized.includes("content layer") ||
    normalized.includes("内容层")
  ) {
    tags.add("content-layer-verification-required");
  }

  if (
    normalized.includes("ffprobe") ||
    normalized.includes("sync byte") ||
    normalized.includes("0x47") ||
    normalized.includes("unencrypted")
  ) {
    tags.add("container-readable-not-content-decrypted");
  }

  if (
    normalized.includes("workspace root") ||
    normalized.includes("instead of artifacts/tasks")
  ) {
    tags.add("artifact-misplacement-correction");
  }

  if (
    normalized.includes("status-only") ||
    normalized.includes("status only") ||
    normalized.includes("status updates")
  ) {
    tags.add("status-only-reply-correction");
  }

  if (
    normalized.includes("stop status-only") ||
    normalized.includes("without status") ||
    normalized.includes("instead of actually continuing")
  ) {
    tags.add("assert-can-reply-discipline");
  }

  if (
    normalized.includes("immediately execute") ||
    normalized.includes("without status-only") ||
    normalized.includes("立即执行")
  ) {
    tags.add("execute-before-report");
  }

  if (
    normalized.includes("declared completed") ||
    normalized.includes("premature") ||
    normalized.includes("has not been run")
  ) {
    tags.add("premature-closeout-correction");
  }

  if (
    normalized.includes("verification passes") ||
    normalized.includes("not been validated")
  ) {
    tags.add("verify-before-claim");
  }

  if (
    normalized.includes("verify-once.mjs") ||
    normalized.includes("assert-can-reply") ||
    normalized.includes("validated deliverable") ||
    normalized.includes("task-close") ||
    normalized.includes("task close")
  ) {
    tags.add("assert-can-reply-require-validated-deliverable");
  }

  if (
    normalized.includes("task-close") ||
    normalized.includes("task close") ||
    normalized.includes("最后执行 task-close") ||
    normalized.includes("不要只停在") ||
    normalized.includes("closeout")
  ) {
    tags.add("closeout-after-validation");
  }

  if (
    normalized.includes("replygatedecision") ||
    normalized.includes("requireduseraction") ||
    normalized.includes("resumecondition") ||
    normalized.includes("blockingaction") ||
    normalized.includes("现在请登录")
  ) {
    tags.add("pause-gate-precision");
  }

  if (
    normalized.includes("deliveryadoptionstatus") ||
    normalized.includes("acceptancepath") ||
    normalized.includes("usedartifacts") ||
    normalized.includes("unusedartifacts") ||
    normalized.includes("真实使用路径")
  ) {
    tags.add("delivery-adoption-evidence");
  }

  return Array.from(tags).sort();
}

export function inferTrigger(query) {
  const normalized = normalize(query);
  const routes = inferRoutes(normalized);
  if (routes.length === 0) {
    return false;
  }
  const hasInvestigativeIntent = investigativeHints.some((hint) => normalized.includes(hint));
  const hasConstructiveIntent = constructiveHints.some((hint) => normalized.includes(hint));
  if (hasConstructiveIntent && !hasInvestigativeIntent) {
    return false;
  }
  return true;
}

function overlap(expected = [], actual = []) {
  const actualSet = new Set(actual);
  const hits = expected.filter((item) => actualSet.has(item));
  return {
    hits,
    passed: expected.length === 0 ? actual.length === 0 : hits.length === expected.length,
    ratio: expected.length === 0 ? (actual.length === 0 ? 1 : 0) : hits.length / expected.length
  };
}

export function readEvalSet() {
  const raw = readMergedEvalSet();
  return raw.map((item, index) => ({
    id: item.id || `eval-${String(index + 1).padStart(2, "0")}`,
    query: item.query,
    shouldTrigger: item.shouldTrigger ?? item.should_trigger ?? false,
    expectedRoutes: item.expectedRoutes || [],
    expectedArtifacts: item.expectedArtifacts || [],
    expectedReasoningTags: item.expectedReasoningTags || [],
    forbiddenReasoningTags: item.forbiddenReasoningTags || []
  }));
}

export function evaluateEvalSet(outputContractText) {
  const items = readEvalSet();
  const results = items.map((item) => {
    const predictedTrigger = inferTrigger(item.query);
    const predictedRoutes = inferRoutes(item.query);
    const predictedArtifacts = predictedTrigger ? inferArtifacts(item.query, predictedRoutes) : [];
    const predictedReasoningTags = predictedTrigger ? inferReasoningTags(item.query, predictedRoutes) : [];
    const routeCheck = overlap(item.expectedRoutes, predictedRoutes);
    const artifactInferenceCheck = overlap(item.expectedArtifacts, predictedArtifacts);
    const artifactContractCheck = overlap(
      item.expectedArtifacts,
      item.expectedArtifacts.filter((artifact) => outputContractText.includes(artifact))
    );
    const reasoningCheck = overlap(item.expectedReasoningTags, predictedReasoningTags);
    const forbiddenReasoningHits = (item.forbiddenReasoningTags || []).filter((tag) =>
      predictedReasoningTags.includes(tag)
    );
    return {
      ...item,
      predictedTrigger,
      predictedRoutes,
      predictedArtifacts,
      predictedReasoningTags,
      triggerPassed: predictedTrigger === item.shouldTrigger,
      routeCheck,
      artifactInferenceCheck,
      artifactContractCheck,
      reasoningCheck,
      forbiddenReasoningHits,
      forbiddenReasoningPassed: forbiddenReasoningHits.length === 0
    };
  });

  const positives = results.filter((item) => item.shouldTrigger);
  const reasoningItems = results.filter(
    (item) => item.expectedReasoningTags.length > 0 || item.forbiddenReasoningTags.length > 0
  );
  return {
    items: results,
    summary: {
      total: results.length,
      positives: positives.length,
      reasoningItems: reasoningItems.length,
      triggerAccuracy: results.filter((item) => item.triggerPassed).length / Math.max(results.length, 1),
      routeAccuracy: positives.filter((item) => item.routeCheck.passed).length / Math.max(positives.length, 1),
      artifactInferenceAccuracy:
        positives.filter((item) => item.artifactInferenceCheck.passed).length / Math.max(positives.length, 1),
      artifactContractAccuracy:
        positives.filter((item) => item.artifactContractCheck.passed).length / Math.max(positives.length, 1),
      reasoningAccuracy:
        reasoningItems.filter((item) => item.reasoningCheck.passed).length / Math.max(reasoningItems.length, 1),
      forbiddenReasoningAccuracy:
        reasoningItems.filter((item) => item.forbiddenReasoningPassed).length / Math.max(reasoningItems.length, 1)
    }
  };
}
