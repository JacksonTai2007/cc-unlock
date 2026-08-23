function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
    )
  );
}

export function topWebShellKeys(values = []) {
  return uniqStrings(
    (Array.isArray(values) ? values : []).map((item) =>
      typeof item === "string" ? item : item?.key
    )
  );
}

export function inferDownstreamTopicsFromWebShellResult(result) {
  const runtimes = new Set(topWebShellKeys(result?.summary?.probableRuntimes));
  const frontend = new Set(topWebShellKeys(result?.summary?.probableFrontend));
  const packagers = new Set(topWebShellKeys(result?.summary?.probablePackagers));
  const entryHints = uniqStrings(result?.entryHints || []).join(" ").toLowerCase();

  const topics = new Set(["web-shell-triage"]);

  if (runtimes.size > 0 || result?.summary?.looksLikeWebShell === true) {
    topics.add("static-triage");
  }

  if (
    ["electron", "nwjs", "webview2", "cef", "qt-webengine", "miniblink", "neutralino"].some((key) => runtimes.has(key)) ||
    /preload|qwebchannel|hostobject|ipc|window\.go|tauri/i.test(entryHints)
  ) {
    topics.add("ui-runtime");
  }

  if (
    ["electron", "nwjs", "tauri", "wails", "neutralino", "webview2", "cef", "qt-webengine", "flutter-web-assets"].some((key) =>
      runtimes.has(key)
    ) ||
    frontend.size > 0
  ) {
    topics.add("tls-network");
  }

  if (
    ["electron", "tauri", "wails", "neutralino", "flutter-web-assets"].some((key) => runtimes.has(key)) ||
    /app\.asar|package\.json|config|settings|manifest/i.test(entryHints)
  ) {
    topics.add("config-recovery");
  }

  if (
    ["tauri", "wails", "webview2", "cef", "qt-webengine", "miniblink"].some((key) => runtimes.has(key))
  ) {
    topics.add("mixed-mode-interop");
  }

  if (packagers.has("webpack") || packagers.has("vite") || packagers.has("parcel") || frontend.size > 0) {
    topics.add("config-recovery");
  }

  return Array.from(topics).sort();
}

export function describeWebShellRouting(result) {
  const runtimes = new Set(topWebShellKeys(result?.summary?.probableRuntimes));
  const downstream = inferDownstreamTopicsFromWebShellResult(result).filter((topic) => topic !== "web-shell-triage");

  if (runtimes.has("electron") || runtimes.has("nwjs")) {
    return {
      profile: "electron-like",
      downstreamTopics: downstream,
      nextAction:
        "优先检查 resources/app.asar、package.json、preload.js、ipc/contextBridge，并分流到 config-recovery / ui-runtime / tls-network / static-triage。"
    };
  }

  if (runtimes.has("webview2")) {
    return {
      profile: "webview2-like",
      downstreamTopics: downstream,
      nextAction:
        "优先检查 WebView2 宿主装载、host object / message bridge、HTML/JS 资源落点，并分流到 mixed-mode-interop / ui-runtime / tls-network / static-triage。"
    };
  }

  if (runtimes.has("cef") || runtimes.has("qt-webengine") || runtimes.has("miniblink")) {
    return {
      profile: "embedded-browser-like",
      downstreamTopics: downstream,
      nextAction:
        "优先检查嵌入式浏览器资源目录、subprocess/bridge、HTML 入口与网络 client，并分流到 ui-runtime / tls-network / static-triage / mixed-mode-interop。"
    };
  }

  if (runtimes.has("tauri") || runtimes.has("wails") || runtimes.has("neutralino")) {
    return {
      profile: "native-bridge-web-shell",
      downstreamTopics: downstream,
      nextAction:
        "优先检查前端 dist、invoke/Go/Rust/native bridge、配置文件与 API client，并分流到 mixed-mode-interop / config-recovery / tls-network / static-triage。"
    };
  }

  if (runtimes.has("flutter-web-assets")) {
    return {
      profile: "flutter-web-assets",
      downstreamTopics: downstream,
      nextAction:
        "优先检查 main.dart.js、flutter_assets、配置载体与网络 client，并分流到 config-recovery / tls-network / static-triage。"
    };
  }

  return {
    profile: "generic-web-shell",
    downstreamTopics: downstream,
    nextAction:
      "优先检查主资源入口、bridge API、配置载体与网络 client，并按证据分流到 static-triage / ui-runtime / tls-network / config-recovery。"
  };
}

function summarizeLabels(result) {
  return {
    runtime: topWebShellKeys(result?.summary?.probableRuntimes).join(", "),
    frontend: topWebShellKeys(result?.summary?.probableFrontend).join(", "),
    packager: topWebShellKeys(result?.summary?.probablePackagers).join(", "),
    entryHints: uniqStrings(result?.entryHints || []).slice(0, 10)
  };
}

function renderTemplate(profile, labels, downstreamTopics, blocks) {
  return [
    "# Web Shell Runtime-Specific Next Steps",
    "",
    "## Runtime Profile",
    "",
    `- profile: ${profile}`,
    `- wrapper/runtime: ${labels.runtime}`,
    `- frontend: ${labels.frontend}`,
    `- bundler: ${labels.packager}`,
    "",
    "## Priority Actions",
    "",
    ...blocks.priority.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Files / Anchors To Inspect",
    "",
    ...blocks.files.map((item) => `- ${item}`),
    "",
    "## Bridge / IPC / Host API Focus",
    "",
    ...blocks.bridge.map((item) => `- ${item}`),
    "",
    "## Suggested Downstream Topics",
    "",
    ...downstreamTopics.map((item) => `- ${item}`),
    ""
  ].join("\n");
}

export function buildRuntimeSpecificNextSteps(result) {
  const routing = describeWebShellRouting(result);
  const labels = summarizeLabels(result);
  const downstreamTopics = routing.downstreamTopics.length > 0 ? routing.downstreamTopics : ["static-triage"];
  const commonFiles = labels.entryHints.length > 0 ? labels.entryHints : ["主资源入口", "配置文件", "网络 client 入口"];

  if (routing.profile === "electron-like") {
    return renderTemplate("electron-like", labels, downstreamTopics, {
      priority: [
        "解包或枚举 resources/app.asar、app.asar.unpacked，并确认 renderer/main/preload 三侧入口。",
        "优先阅读 package.json 的 main / build 字段、preload.js，以及 BrowserWindow/webPreferences 配置。",
        "建立 ipcMain / ipcRenderer / contextBridge API 清单，再把 API client、配置载体和网络流量入口分别分流。"
      ],
      files: uniqStrings([
        "resources/app.asar",
        "resources/app.asar.unpacked",
        "package.json",
        "main.js / index.js",
        "preload.js",
        ...commonFiles
      ]),
      bridge: [
        "contextBridge.exposeInMainWorld",
        "ipcRenderer.invoke / send / on",
        "ipcMain.handle / on",
        "BrowserWindow.webContents / session"
      ]
    });
  }

  if (routing.profile === "webview2-like") {
    return renderTemplate("webview2-like", labels, downstreamTopics, {
      priority: [
        "定位宿主侧 WebView2 初始化链：CreateCoreWebView2EnvironmentWithOptions -> controller -> Navigate。",
        "确认 HTML/JS 资源来自本地文件、嵌入资源还是远端 URL，并建立资源落点清单。",
        "梳理 host object / postMessage / WebMessageReceived 等桥接接口，再把 native handler 分流到 mixed-mode-interop 或 ui-runtime。"
      ],
      files: uniqStrings([
        "WebView2Loader.dll",
        "Microsoft.Web.WebView2.Core.dll",
        "宿主 EXE 的 WebView2 初始化函数",
        ...commonFiles
      ]),
      bridge: [
        "AddHostObjectToScript / host object",
        "PostWebMessageAsJson / WebMessageReceived",
        "NavigationStarting / NavigationCompleted",
        "资源映射与本地文件装载"
      ]
    });
  }

  if (routing.profile === "embedded-browser-like") {
    return renderTemplate("embedded-browser-like", labels, downstreamTopics, {
      priority: [
        "确认资源目录、HTML 入口、subprocess 模式和浏览器多进程边界。",
        "优先建立 JS <-> native bridge、消息分发、URL/协议处理器清单。",
        "把主资源、网络 client 和 native 宿主边界分别分流到 ui-runtime / tls-network / static-triage / mixed-mode-interop。"
      ],
      files: uniqStrings([
        "libcef.dll / cef.pak / devtools_resources.pak",
        "Qt5WebEngineCore.dll / Qt6WebEngineCore.dll",
        "browser subprocess 启动参数",
        ...commonFiles
      ]),
      bridge: [
        "CEF message router / JS bindings",
        "QWebChannel / Qt bridge",
        "自定义 scheme handler / resource handler",
        "subprocess IPC"
      ]
    });
  }

  if (routing.profile === "native-bridge-web-shell") {
    return renderTemplate("native-bridge-web-shell", labels, downstreamTopics, {
      priority: [
        "优先定位前端 dist 与 native bridge：Tauri invoke、Wails window.go、Neutralino API。",
        "建立前端 API 调用点与 Rust/Go/native handler 的映射清单。",
        "把命中的 bridge、配置、网络和原生模块分别分流到 mixed-mode-interop / config-recovery / tls-network / static-triage。"
      ],
      files: uniqStrings([
        "tauri.conf.json / src-tauri",
        "wails.json / wailsjs",
        "neutralino.config.json",
        "前端 dist/assets",
        ...commonFiles
      ]),
      bridge: [
        "__TAURI__ / @tauri-apps/api / invoke",
        "window.go.*",
        "Neutralino.*",
        "Rust command / Go binding / native command handler"
      ]
    });
  }

  if (routing.profile === "flutter-web-assets") {
    return renderTemplate("flutter-web-assets", labels, downstreamTopics, {
      priority: [
        "先检查 main.dart.js、flutter_assets 和 HTML 入口，确认业务逻辑是否主要在 Web 资产侧。",
        "梳理配置载体、环境变量、API client 与网络请求入口。",
        "根据配置和网络证据分流到 config-recovery / tls-network / static-triage。"
      ],
      files: uniqStrings([
        "flutter_assets",
        "main.dart.js",
        "index.html",
        ...commonFiles
      ]),
      bridge: [
        "Flutter Web 资源装载",
        "JS bootstrap / service worker",
        "配置初始化与网络 client"
      ]
    });
  }

  return renderTemplate("generic-web-shell", labels, downstreamTopics, {
    priority: [
      "先锁定主资源入口、前端 bundle、配置文件和网络 client。",
      "再建立 bridge / preload / host API 与 native 宿主边界。",
      "根据命中的证据，把任务分流到 static-triage / ui-runtime / tls-network / config-recovery / mixed-mode-interop。"
    ],
    files: uniqStrings([
      ...commonFiles
    ]),
    bridge: [
      "preload / bridge / host object",
      "自定义 IPC / message 通道",
      "native 资源装载与配置初始化"
    ]
  });
}
