export default {
  caseId: "web-anti-tamper-workflow",
  status: "abstract-case",
  category: "anti-tamper",
  tags: ["anti-tamper", "integrity", "trusted-types"],
  runtime: "browser-observe",
  focus: [
    "列出完整性与 hook 阻断面",
    "确认 sink protection 与 self-check 关系",
    "记录最小 patch 面与残余模式"
  ],
  deliverables: [
    "report.md",
    "run/anti-tamper-notes.md",
    "run/integrity-surface.json"
  ],
  checkpoints: [
    "已确认至少一个 integrity surface",
    "已确认触发时机或失败后果",
    "已记录 patch 面或残余模式"
  ],
  caveats: [
    "anti-tamper 专题不能只留下 patch 代码，必须说明检测面、触发点和残余风险"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/anti-tamper-notes.md",
    "run/integrity-surface.json"
  ],
  notes: [
    "guided 阶段优先积累检测面与 patch 面的系统性分类"
  ]
};
