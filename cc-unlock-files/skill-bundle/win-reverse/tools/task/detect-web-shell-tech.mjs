import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const maxDepthDefault = 6;
const maxFilesDefault = 12000;
const maxReadBytesDefault = 512 * 1024;
const interestingTextExts = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".html",
  ".htm",
  ".css",
  ".map",
  ".txt",
  ".md"
]);
const binaryExts = new Set([".exe", ".dll", ".node"]);

const fileRules = [
  { id: "electron.asar", runtime: "electron", type: "file", needle: "app.asar", weight: 6 },
  { id: "electron.preload", runtime: "electron", type: "file", needle: "preload.js", weight: 3 },
  { id: "electron.resources", runtime: "electron", type: "file", needle: "app.asar.unpacked", weight: 4 },
  { id: "electron.chrome_elf", runtime: "electron", type: "file", needle: "chrome_elf.dll", weight: 2 },
  { id: "electron.snapshot", runtime: "electron", type: "file", needle: "v8_context_snapshot.bin", weight: 2 },
  { id: "cef.libcef", runtime: "cef", type: "file", needle: "libcef.dll", weight: 6 },
  { id: "cef.pak", runtime: "cef", type: "file", needle: "cef.pak", weight: 3 },
  { id: "cef.devtools", runtime: "cef", type: "file", needle: "devtools_resources.pak", weight: 3 },
  { id: "cef.locales", runtime: "cef", type: "file", needle: "locales", weight: 1 },
  { id: "webview2.loader", runtime: "webview2", type: "file", needle: "WebView2Loader.dll", weight: 6 },
  { id: "webview2.dotnet", runtime: "webview2", type: "file", needle: "Microsoft.Web.WebView2.Core.dll", weight: 4 },
  { id: "qt.webengine", runtime: "qt-webengine", type: "file", needle: "Qt5WebEngineCore.dll", weight: 6 },
  { id: "qt6.webengine", runtime: "qt-webengine", type: "file", needle: "Qt6WebEngineCore.dll", weight: 6 },
  { id: "qt.resources", runtime: "qt-webengine", type: "file", needle: "qtwebengine_resources.pak", weight: 3 },
  { id: "nw.dll", runtime: "nwjs", type: "file", needle: "nw.dll", weight: 6 },
  { id: "nw.pak", runtime: "nwjs", type: "file", needle: "nw_100_percent.pak", weight: 3 },
  { id: "tauri.conf", runtime: "tauri", type: "file", needle: "tauri.conf.json", weight: 6 },
  { id: "wails.json", runtime: "wails", type: "file", needle: "wails.json", weight: 6 },
  { id: "wailsjs", runtime: "wails", type: "file", needle: "wailsjs", weight: 5 },
  { id: "neutralino.conf", runtime: "neutralino", type: "file", needle: "neutralino.config.json", weight: 6 },
  { id: "flutter.assets", runtime: "flutter-web-assets", type: "file", needle: "flutter_assets", weight: 5 },
  { id: "flutter.main", runtime: "flutter-web-assets", type: "file", needle: "main.dart.js", weight: 4 },
  { id: "miniblink", runtime: "miniblink", type: "file", needle: "miniblink", weight: 5 }
];

const textRules = [
  { id: "electron.contextBridge", runtime: "electron", needle: "contextBridge.exposeInMainWorld", weight: 4 },
  { id: "electron.ipc", runtime: "electron", needle: "ipcRenderer", weight: 3 },
  { id: "tauri.api", runtime: "tauri", needle: "@tauri-apps/api", weight: 5 },
  { id: "tauri.global", runtime: "tauri", needle: "__TAURI__", weight: 4 },
  { id: "wails.go", runtime: "wails", needle: "window.go.", weight: 5 },
  { id: "neutralino.init", runtime: "neutralino", needle: "Neutralino.init", weight: 6 },
  { id: "nw.require", runtime: "nwjs", needle: "nw.Window", weight: 5 },
  { id: "next.data", frontend: "next", needle: "__NEXT_DATA__", weight: 5 },
  { id: "next.static", frontend: "next", needle: "_next/static", weight: 4 },
  { id: "nuxt.data", frontend: "nuxt", needle: "__NUXT__", weight: 5 },
  { id: "nuxt.static", frontend: "nuxt", needle: "_nuxt/", weight: 4 },
  { id: "react.dom", frontend: "react", needle: "react-dom", weight: 4 },
  { id: "react.root", frontend: "react", needle: "createRoot(", weight: 3 },
  { id: "vue.createApp", frontend: "vue", needle: "createApp(", weight: 3 },
  { id: "vue.router", frontend: "vue", needle: "vue-router", weight: 3 },
  { id: "angular.zone", frontend: "angular", needle: "zone.js", weight: 5 },
  { id: "angular.core", frontend: "angular", needle: "@angular/core", weight: 4 },
  { id: "svelte.internal", frontend: "svelte", needle: "svelte/internal", weight: 5 },
  { id: "vite.client", packager: "vite", needle: "/@vite/client", weight: 5 },
  { id: "vite.env", packager: "vite", needle: "import.meta.env", weight: 3 },
  { id: "webpack.require", packager: "webpack", needle: "__webpack_require__", weight: 5 },
  { id: "webpack.chunk", packager: "webpack", needle: "webpackChunk", weight: 4 },
  { id: "parcel.require", packager: "parcel", needle: "parcelRequire", weight: 5 },
  { id: "requirejs", packager: "requirejs", needle: "define.amd", weight: 5 },
  { id: "source.map", packager: "sourcemap", needle: "sourceMappingURL=", weight: 2 }
];

const binaryStringRules = [
  { id: "api.webview2", runtime: "webview2", needle: "CreateCoreWebView2EnvironmentWithOptions", weight: 7 },
  { id: "dll.webview2", runtime: "webview2", needle: "WebView2Loader.dll", weight: 5 },
  { id: "cef.initialize", runtime: "cef", needle: "cef_initialize", weight: 7 },
  { id: "cef.dll", runtime: "cef", needle: "libcef.dll", weight: 5 },
  { id: "electron.appasar", runtime: "electron", needle: "app.asar", weight: 5 },
  { id: "electron.keyword", runtime: "electron", needle: "Electron", weight: 2 },
  { id: "nw.keyword", runtime: "nwjs", needle: "nwjs", weight: 5 },
  { id: "tauri.keyword", runtime: "tauri", needle: "tauri", weight: 3 },
  { id: "wails.keyword", runtime: "wails", needle: "wails", weight: 3 },
  { id: "miniblink.keyword", runtime: "miniblink", needle: "miniblink", weight: 5 },
  { id: "qtwebengine.keyword", runtime: "qt-webengine", needle: "QtWebEngine", weight: 5 }
];

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toPosix(filePath) {
  return String(filePath || "").replaceAll("\\", "/");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const target = args.find((item) => !item.startsWith("--"));
  if (!target) {
    console.error(
      "usage: node tools/task/detect-web-shell-tech.mjs <target-dir|binary> [--json] [--output=path] [--max-depth=6] [--max-files=12000] [--max-read-bytes=524288]"
    );
    process.exit(1);
  }

  return {
    target,
    json: args.includes("--json"),
    output: args.find((item) => item.startsWith("--output="))?.split("=").slice(1).join("=") || "",
    maxDepth: Number(args.find((item) => item.startsWith("--max-depth="))?.split("=")[1] || maxDepthDefault),
    maxFiles: Number(args.find((item) => item.startsWith("--max-files="))?.split("=")[1] || maxFilesDefault),
    maxReadBytes: Number(
      args.find((item) => item.startsWith("--max-read-bytes="))?.split("=")[1] || maxReadBytesDefault
    )
  };
}

function isInterestingTextFile(filePath) {
  return interestingTextExts.has(path.extname(filePath).toLowerCase());
}

function isBinaryCandidate(filePath) {
  return binaryExts.has(path.extname(filePath).toLowerCase());
}

function pushMatch(matches, match) {
  matches.push({
    kind: match.kind,
    category: match.category,
    key: match.key,
    ruleId: match.ruleId,
    weight: match.weight,
    evidence: match.evidence
  });
}

function addScore(scores, key, weight) {
  scores[key] = (scores[key] || 0) + weight;
}

function walk(rootPath, options = {}) {
  const resolvedRoot = path.resolve(rootPath);
  const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : maxDepthDefault;
  const maxFiles = Number.isFinite(options.maxFiles) ? options.maxFiles : maxFilesDefault;
  const files = [];
  const queue = [{ dir: resolvedRoot, depth: 0 }];

  while (queue.length > 0 && files.length < maxFiles) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.isDirectory()) {
        if (current.depth < maxDepth) {
          queue.push({ dir: fullPath, depth: current.depth + 1 });
        }
        continue;
      }

      files.push(fullPath);
      if (files.length >= maxFiles) {
        break;
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function safeReadTextSnippet(filePath, maxReadBytes) {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.subarray(0, Math.min(buffer.length, maxReadBytes)).toString("utf8");
  } catch {
    return "";
  }
}

function safeReadBinaryAscii(filePath, maxReadBytes) {
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer
      .subarray(0, Math.min(buffer.length, maxReadBytes))
      .toString("latin1")
      .replace(/[^\x20-\x7e]+/g, " ");
  } catch {
    return "";
  }
}

function summarizeTop(scores, minScore = 3) {
  return Object.entries(scores)
    .filter(([, value]) => value >= minScore)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, score]) => ({ key, score }));
}

function inferConfidence(runtimeHits, frontendHits, packagerHits, jsLikeCount) {
  const bestRuntime = runtimeHits[0]?.score || 0;
  const bestFrontend = frontendHits[0]?.score || 0;
  const bestPackager = packagerHits[0]?.score || 0;

  if (bestRuntime >= 8 || (bestRuntime >= 6 && (bestFrontend >= 4 || bestPackager >= 4))) {
    return "high";
  }
  if (bestRuntime >= 4 || (jsLikeCount >= 20 && (bestFrontend >= 3 || bestPackager >= 3))) {
    return "medium";
  }
  return "low";
}

function buildNextSteps(summary) {
  const steps = [];
  const runtimes = new Set(summary.probableRuntimes.map((item) => item.key));

  if (runtimes.has("electron")) {
    steps.push("优先检查 resources/app.asar、app.asar.unpacked、package.json、preload.js 和主进程入口。");
  }
  if (runtimes.has("webview2")) {
    steps.push("检查宿主 EXE / DLL 是否调用 CreateCoreWebView2EnvironmentWithOptions，并跟踪 HTML/JS 资源落点。");
  }
  if (runtimes.has("cef")) {
    steps.push("检查 libcef.dll、cef.pak、subprocess 启动链、命令行参数与资源目录。");
  }
  if (runtimes.has("tauri")) {
    steps.push("优先找 tauri.conf.json、dist/assets、invoke handler 和 Rust 侧命令绑定。");
  }
  if (runtimes.has("wails")) {
    steps.push("优先检查 wailsjs、前端 dist 目录与 Go 导出绑定接口。");
  }
  if (runtimes.has("qt-webengine")) {
    steps.push("检查 Qt WebEngine 资源包、QWebChannel / bridge 暴露点与 HTML 入口。");
  }

  if (summary.probableFrontend.some((item) => item.key === "react")) {
    steps.push("若命中 React，优先搜索路由表、API client、状态管理和打包 chunk 映射。");
  }
  if (summary.probableFrontend.some((item) => item.key === "vue")) {
    steps.push("若命中 Vue，优先检查 router、pinia/vuex、axios/fetch 封装与插件注册。");
  }
  if (summary.probablePackagers.some((item) => item.key === "webpack")) {
    steps.push("若命中 webpack，优先利用 __webpack_require__ / webpackChunk 反推模块边界。");
  }
  if (summary.probablePackagers.some((item) => item.key === "vite")) {
    steps.push("若命中 Vite，优先从 manifest、assets 命名和 import graph 反推入口。");
  }

  if (steps.length === 0) {
    steps.push("当前证据不足以高置信判定 Web 套壳技术路线；回到 PE/导入面/运行时导入和模块加载证据。");
  }

  return steps;
}

export function detect(targetPath, options = {}) {
  const resolvedTarget = path.resolve(targetPath);
  const stat = fs.existsSync(resolvedTarget) ? fs.statSync(resolvedTarget) : null;
  if (!stat) {
    throw new Error(`path not found: ${resolvedTarget}`);
  }

  const scanRoot = stat.isDirectory() ? resolvedTarget : path.dirname(resolvedTarget);
  const files = walk(scanRoot, options);
  const runtimeScores = {};
  const frontendScores = {};
  const packagerScores = {};
  const matches = [];
  const entryHints = new Set();
  let jsLikeCount = 0;
  let htmlLikeCount = 0;
  let asarCount = 0;

  for (const fullPath of files) {
    const relPath = toPosix(path.relative(scanRoot, fullPath));
    const lowerRel = relPath.toLowerCase();
    const baseName = path.basename(lowerRel);
    const ext = path.extname(lowerRel);

    if (ext === ".js" || ext === ".jsx" || ext === ".ts" || ext === ".tsx" || ext === ".json" || ext === ".map") {
      jsLikeCount += 1;
    }
    if (ext === ".html" || ext === ".htm") {
      htmlLikeCount += 1;
    }
    if (ext === ".asar") {
      asarCount += 1;
    }

    for (const rule of fileRules) {
      if (lowerRel.includes(rule.needle.toLowerCase()) || baseName === rule.needle.toLowerCase()) {
        if (rule.runtime) addScore(runtimeScores, rule.runtime, rule.weight);
        if (rule.frontend) addScore(frontendScores, rule.frontend, rule.weight);
        if (rule.packager) addScore(packagerScores, rule.packager, rule.weight);
        pushMatch(matches, {
          kind: "file",
          category: rule.runtime ? "runtime" : rule.frontend ? "frontend" : "packager",
          key: rule.runtime || rule.frontend || rule.packager,
          ruleId: rule.id,
          weight: rule.weight,
          evidence: relPath
        });
        if (/app\.asar|package\.json|index\.html|preload|wailsjs|tauri\.conf|neutralino|main\.dart\.js/i.test(relPath)) {
          entryHints.add(relPath);
        }
      }
    }

    if (isInterestingTextFile(fullPath)) {
      const text = safeReadTextSnippet(fullPath, options.maxReadBytes || maxReadBytesDefault);
      for (const rule of textRules) {
        if (text.includes(rule.needle)) {
          if (rule.runtime) addScore(runtimeScores, rule.runtime, rule.weight);
          if (rule.frontend) addScore(frontendScores, rule.frontend, rule.weight);
          if (rule.packager) addScore(packagerScores, rule.packager, rule.weight);
          pushMatch(matches, {
            kind: "text",
            category: rule.runtime ? "runtime" : rule.frontend ? "frontend" : "packager",
            key: rule.runtime || rule.frontend || rule.packager,
            ruleId: rule.id,
            weight: rule.weight,
            evidence: relPath
          });
          if (/package\.json|index\.html|main|preload|renderer|manifest|wailsjs|tauri/i.test(relPath)) {
            entryHints.add(relPath);
          }
        }
      }

      if (baseName === "package.json") {
        try {
          const pkg = JSON.parse(text);
          const depText = JSON.stringify({
            dependencies: pkg.dependencies || {},
            devDependencies: pkg.devDependencies || {},
            main: pkg.main || "",
            name: pkg.name || ""
          }).toLowerCase();
          for (const [needle, runtime, weight] of [
            ["electron", "electron", 5],
            ["nw", "nwjs", 4],
            ["tauri", "tauri", 5],
            ["wails", "wails", 5],
            ["neutralino", "neutralino", 5],
            ["react", "react", 3],
            ["vue", "vue", 3],
            ["@angular/core", "angular", 4],
            ["svelte", "svelte", 4]
          ]) {
            if (depText.includes(needle)) {
              if (["electron", "nwjs", "tauri", "wails", "neutralino"].includes(runtime)) {
                addScore(runtimeScores, runtime, weight);
                pushMatch(matches, {
                  kind: "package-json",
                  category: "runtime",
                  key: runtime,
                  ruleId: `package-json:${needle}`,
                  weight,
                  evidence: relPath
                });
              } else {
                addScore(frontendScores, runtime, weight);
                pushMatch(matches, {
                  kind: "package-json",
                  category: "frontend",
                  key: runtime,
                  ruleId: `package-json:${needle}`,
                  weight,
                  evidence: relPath
                });
              }
              entryHints.add(relPath);
            }
          }
        } catch {
          // ignore malformed package.json
        }
      }
    }

    if (isBinaryCandidate(fullPath)) {
      const ascii = safeReadBinaryAscii(fullPath, options.maxReadBytes || maxReadBytesDefault);
      for (const rule of binaryStringRules) {
        if (ascii.includes(rule.needle)) {
          addScore(runtimeScores, rule.runtime, rule.weight);
          pushMatch(matches, {
            kind: "binary-string",
            category: "runtime",
            key: rule.runtime,
            ruleId: rule.id,
            weight: rule.weight,
            evidence: relPath
          });
          entryHints.add(relPath);
        }
      }
    }
  }

  const probableRuntimes = summarizeTop(runtimeScores, 3);
  const probableFrontend = summarizeTop(frontendScores, 3);
  const probablePackagers = summarizeTop(packagerScores, 3);
  const confidence = inferConfidence(probableRuntimes, probableFrontend, probablePackagers, jsLikeCount);
  const looksLikeWebShell =
    probableRuntimes.length > 0 ||
    (jsLikeCount >= 15 && (probableFrontend.length > 0 || probablePackagers.length > 0)) ||
    asarCount > 0;

  const summary = {
    looksLikeWebShell,
    confidence,
    probableRuntimes,
    probableFrontend,
    probablePackagers,
    fileStats: {
      scannedFiles: files.length,
      jsLikeFiles: jsLikeCount,
      htmlLikeFiles: htmlLikeCount,
      asarFiles: asarCount
    }
  };

  return {
    generatedAt: new Date().toISOString(),
    scannedRoot: scanRoot,
    targetPath: resolvedTarget,
    limits: {
      maxDepth: options.maxDepth || maxDepthDefault,
      maxFiles: options.maxFiles || maxFilesDefault,
      maxReadBytes: options.maxReadBytes || maxReadBytesDefault
    },
    summary,
    entryHints: Array.from(entryHints).sort((left, right) => left.localeCompare(right)).slice(0, 24),
    recommendedNextSteps: buildNextSteps(summary),
    matches: matches
      .sort((left, right) => right.weight - left.weight || left.evidence.localeCompare(right.evidence))
      .slice(0, 80)
  };
}

function formatConsoleSummary(result) {
  const lines = [
    `[web-shell-tech] scannedRoot=${result.scannedRoot}`,
    `[web-shell-tech] looksLikeWebShell=${result.summary.looksLikeWebShell}`,
    `[web-shell-tech] confidence=${result.summary.confidence}`,
    `[web-shell-tech] probableRuntimes=${result.summary.probableRuntimes.map((item) => `${item.key}:${item.score}`).join(",") || "(none)"}`,
    `[web-shell-tech] probableFrontend=${result.summary.probableFrontend.map((item) => `${item.key}:${item.score}`).join(",") || "(none)"}`,
    `[web-shell-tech] probablePackagers=${result.summary.probablePackagers.map((item) => `${item.key}:${item.score}`).join(",") || "(none)"}`,
    `[web-shell-tech] entryHints=${result.entryHints.slice(0, 8).join(",") || "(none)"}`
  ];

  for (const step of result.recommendedNextSteps.slice(0, 6)) {
    lines.push(`[web-shell-tech] next=${step}`);
  }
  return lines.join("\n");
}

function main() {
  const parsed = parseArgs(process.argv);
  const result = detect(parsed.target, parsed);
  if (parsed.output) {
    const outputPath = path.resolve(parsed.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  }

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatConsoleSummary(result));
  if (parsed.output) {
    console.log(`[web-shell-tech] output=${path.resolve(parsed.output)}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
