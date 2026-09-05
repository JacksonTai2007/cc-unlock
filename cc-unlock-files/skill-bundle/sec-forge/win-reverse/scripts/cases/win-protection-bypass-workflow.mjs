export default {
  caseId: "win-protection-bypass-workflow",
  status: "abstract-case",
  category: "protection-bypass",
  tags: [
    "protection-bypass",
    "anti-tamper",
    "anti-debug",
    "file-guard"
  ],
  focus: [
    "检测面枚举（决策树遍历 §1-§7）",
    "每个检测点分类与优先级排序",
    "最小副作用绕过方案",
    "绕过稳定性验证"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/protection-bypass-notes.md",
    "run/protection-bypass-hook.js",
    "run/protection-bypass-patch.py"
  ],
  checkpoints: [
    "已遍历决策树全部叶子节点",
    "已对每个检测点完成 §1-§7 分类",
    "已产出可运行的 bypass hook 脚本",
    "已产出静态 patch 脚本（或记录不可 patch 的原因）",
    "已验证绕过后目标功能正常"
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
    "先用证据收敛，不在本 case 内替代真实 task-local 进度",
    "内核级保护（§8）优先尝试用户态降级，不强求内核对抗",
    "代码虚拟化（§7）优先定位校验分支跳转，不强求完整 VM 还原"
  ]
};
