export default {
  caseId: "android-webview-hybrid-workflow",
  status: "abstract-case",
  category: "webview-hybrid",
  tags: [
    "webview-hybrid",
    "webview",
    "javascriptinterface"
  ],
  focus: [
    "页面入口",
    "JS bridge",
    "JS-Native 边界"
  ],
  deliverables: [
    "report.md",
    "run/webview-bridge-notes.md"
  ],
  checkpoints: [
    "已识别 WebView 入口",
    "已识别 bridge",
    "已明确 JS 与 Native 责任边界"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先恢复 WebView 容器、加载 URL 与 JS bridge 边界",
      firstProbe: "检查 WebView 初始化、addJavascriptInterface、evaluateJavascript、WebChromeClient/WebViewClient",
      expandWhen: "已确认 Web-Native 双向边界",
      parkWhen: "页面来源和 bridge 关系仍然不清晰"
    },
    {
      id: "E2",
      hypothesis: "若桥接未显式暴露，先从页面资源、回调与容器生命周期反推",
      firstProbe: "检查本地资源包、远程 H5、回调注入点与关键 JS 接口名",
      expandWhen: "已把桥接链路接回业务动作或协议动作",
      parkWhen: "页面逻辑与 Native 侧仍无法互相印证"
    }
  ],
  probeSequence: [
    "先识别容器和页面来源",
    "再恢复 JS-Native 边界与关键回调",
    "最后决定继续深挖 Web 侧还是 Native 侧"
  ],
  evidenceAnchors: [
    "WebView 初始化、URL、JS bridge、WebViewClient/WebChromeClient",
    "页面资源、回调日志、webview-bridge-notes"
  ],
  pivotSignals: [
    "页面来自远程资源或动态下载包",
    "bridge 通过反射或混淆间接暴露",
    "业务动作发生在 Web 侧而非 Java 侧"
  ],
  successSignals: [
    "已恢复 Web-Native 边界",
    "已给出继续取证的主侧重点"
  ],
  caveats: [
    "混合层逻辑不能只停留在页面 URL 层"
  ]
};

