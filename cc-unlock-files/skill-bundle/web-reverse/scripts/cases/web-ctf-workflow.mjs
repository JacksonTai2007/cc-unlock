export default {
  caseId: "web-ctf-workflow",
  status: "abstract-case",
  category: "ctf",
  tags: ["ctf", "web-reverse"],
  focus: [
    "flag 搜索",
    "题目边界",
    "solver 产物",
    "低时延 triage"
  ],
  deliverables: [
    "report.md",
    "run/verify-once.mjs",
    "run/solver.py"
  ],
  checkpoints: [
    "已确认题目边界",
    "已形成最小可复验路径",
    "已产出 solver 或 flag"
  ],
  caveats: [
    "不要把时间花在与 flag 无关的完整站点建模上"
  ]
};
