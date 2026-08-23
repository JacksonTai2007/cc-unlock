export default {
  caseId: "win-web-shell-triage-workflow",
  status: "abstract-case",
  category: "web-shell-triage",
  tags: [
    "web-shell-triage",
    "webview",
    "electron",
    "cef"
  ],
  focus: [
    "Wrapper/runtime 指纹识别",
    "前端框架与 bundler 判定",
    "主资源与 bridge 入口定位"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/web-shell-notes.md",
    "run/web-shell-tech.json"
  ],
  checkpoints: [
    "已判断是否为 Web 套壳 / WebView 应用",
    "已记录 wrapper/runtime、frontend、bundler 候选",
    "已定位主资源、bridge 或下一条更具体的主线"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "PureExtraction",
    "Port",
    "Close"
  ],
  caveats: [
    "先做技术路线指纹，不要未定性就深挖宿主 EXE",
    "case 只提供抽象 workflow，不替代 task-local 当前状态"
  ]
};
