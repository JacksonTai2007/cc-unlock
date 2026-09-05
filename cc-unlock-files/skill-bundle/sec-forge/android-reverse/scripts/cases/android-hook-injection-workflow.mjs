export default {
  caseId: "android-hook-injection-workflow",
  status: "active",
  category: "hook-injection",
  tags: [
    "hook",
    "injection",
    "plt hook",
    "got hook",
    "inline hook",
    "artmethod",
    "zygisk",
    "ptrace",
    "frida internals",
    "dobby",
    "bhook"
  ],
  focus: [
    "根据目标保护等级选择正确的注入方式",
    "理解 Hook 底层原理而不是只会调用 API",
    "反检测注入策略优先"
  ],
  deliverables: [
    "run/hook-injection-notes.md",
    "选择的注入方式及原因",
    "Hook 点列表和 hook 代码"
  ],
  checkpoints: [
    "已评估目标反注入/反 Hook 检测能力",
    "已选择适合的注入方式（Frida/Zygisk/PLT/Inline）",
    "已确认注入时机（spawn/attach/zygote）",
    "Hook 代码已编写并验证",
    "注入成功且未被检测"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "根据目标保护等级选择最优注入方式可提高成功率",
      firstProbe: "检测目标的反注入能力（ptrace 拦截、Frida 特征检测、SO 校验），选择注入方式",
      expandWhen: "反注入检测已评估，最优注入方式已确定",
      parkWhen: "目标保护等级超出当前工具能力（如内核级检测）"
    },
    {
      id: "E2",
      hypothesis: "运行时验证 Hook 效果可确认注入是否成功且隐蔽",
      firstProbe: "编写最小 hook 脚本，注入目标进程，验证 hook 生效且未被检测",
      expandWhen: "基础 hook 成功，可扩展到更多目标函数",
      parkWhen: "注入被检测或 hook 后目标崩溃"
    }
  ],
  probeSequence: [
    "评估目标反注入/反 Hook 检测能力",
    "根据保护等级选择注入方式和时机",
    "编写 hook 脚本（Java/Native/PLT/Inline）",
    "注入并验证 hook 效果",
    "处理反检测（如需要）",
    "扩展 hook 覆盖更多目标函数"
  ],
  exitCriteria: [
    "hook 代码已编写并验证",
    "注入方式选择理由已记录",
    "hook-injection-notes.md 已填写",
    "至少一个 keyFinding 已记录"
  ],
  evidenceAnchors: [
    "反注入检测结果和评估报告",
    "hook 代码和注入命令",
    "hook 生效后的运行时输出"
  ],
  pivotSignals: [
    "Frida 注入被检测 → 转向 Zymbiote 或修改版 Frida",
    "Java hook 失效 → 确认是否需要 Native 层 PLT/GOT hook",
    "目标多进程架构 → 需要逐进程注入或 Zygisk"
  ],
  successSignals: [
    "hook 成功生效且未被检测",
    "目标函数返回值/行为已被正确拦截",
    "注入方式选择合理且有记录"
  ],
  stages: [
    "Observe",
    "Capture",
    "Patch",
    "Verify",
    "Close"
  ],
  caveats: [
    "遇到 Frida 检测不应直接放弃，应理解底层原理后选择替代方案",
    "ARM64 Inline Hook 需处理 PC 相对指令重定位",
    "多进程架构需要考虑主进程和子进程分别注入"
  ]
}
