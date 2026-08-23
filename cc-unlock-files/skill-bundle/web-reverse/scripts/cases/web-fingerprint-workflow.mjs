export default {
  caseId: "web-fingerprint-workflow",
  status: "abstract-case",
  category: "fingerprint",
  tags: ["fingerprint", "anti-bot", "webdriver", "browser-surface", "automation"],
  focus: [
    "按 probe order 盘点真实指纹读点与触发入口",
    "区分 generic fingerprint、automation leak、execution context consistency、network binding",
    "确认哪些字段真正进入 challenge、请求字段或风控状态机",
    "在 first divergence 证据上收敛最小 patch 面"
  ],
  deliverables: [
    "report.md",
    "run/fingerprint-profile.json",
    "run/fingerprint-notes.md",
    "run/fingerprint-inspector-template.js"
  ],
  checkpoints: [
    "已标出关键探测顺序与模块分组",
    "已区分通用指纹与自动化泄漏",
    "已确认上网字段或 challenge 绑定关系",
    "已形成最小 patch 面与剩余未对齐项"
  ],
  caveats: [
    "不要把所有可读环境表面都视为关键 patch 目标",
    "不要跳过 iframe/worker 等执行上下文差异",
    "不要只看本地 getter 而忽略网络绑定或 challenge 路由"
  ]
};
