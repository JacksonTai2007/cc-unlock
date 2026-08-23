export default {
  caseId: "web-subtlecrypto-workflow",
  status: "abstract-case",
  category: "subtlecrypto",
  tags: ["subtlecrypto", "crypto.subtle", "key-lifecycle"],
  runtime: "browser-observe",
  focus: [
    "定位 key import / derive 边界",
    "关联算法参数与输入归一化",
    "确认签名或密文如何进入请求链路"
  ],
  deliverables: [
    "report.md",
    "run/subtlecrypto-notes.md",
    "run/subtlecrypto-keyflow.json"
  ],
  checkpoints: [
    "已确认 key 来源",
    "已确认至少一个 crypto 操作与输出去向",
    "已建立输入 -> 输出 -> 协议字段映射"
  ],
  caveats: [
    "不要把 WebCrypto API 名称当成充分结论，必须记录 key carrier 与参数形态"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/subtlecrypto-notes.md",
    "run/subtlecrypto-keyflow.json"
  ],
  notes: [
    "优先记录 key lifecycle，再决定是否进入纯算法迁移"
  ]
};
