export default {
  caseId: "web-ast-deobfuscation-workflow",
  status: "abstract-case",
  category: "ast-deobfuscation",
  tags: ["ast-deobfuscation", "deobf", "cfg", "string-array"],
  focus: [
    "识别混淆家族",
    "建立运行时证据回指",
    "输出可复验的 AST 规则"
  ],
  deliverables: [
    "report.md",
    "run/before.js",
    "run/after.js",
    "run/deobf-rules.md",
    "run/ast-transform.mjs"
  ],
  checkpoints: [
    "已确认主要混淆模式",
    "已建立 AST 变换和运行时证据回指",
    "已记录处理前后样本"
  ],
  caveats: [
    "不要只凭 AST 结果直接宣称真实语义"
  ]
};
