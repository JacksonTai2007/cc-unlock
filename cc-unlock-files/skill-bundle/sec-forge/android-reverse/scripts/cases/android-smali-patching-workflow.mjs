export default {
  caseId: "android-smali-patching-workflow",
  status: "abstract-case",
  category: "smali-patching",
  tags: [
    "smali-patching",
    "rebuild",
    "resign"
  ],
  focus: [
    "最小 patch",
    "重打包",
    "重签名",
    "安装验证"
  ],
  deliverables: [
    "report.md",
    "run/smali-patch-notes.md"
  ],
  checkpoints: [
    "已确认 patch 点",
    "已记录 rebuild 与 resign 状态",
    "已记录安装验证结果"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先确认真正阻断业务的最小判断点或最小副作用 patch 点",
      firstProbe: "检查条件分支、返回值、异常路径、签名校验和环境门控代码",
      expandWhen: "已定位最小原因 patch 点",
      parkWhen: "当前 patch 需要大范围改动或破坏链路完整性"
    },
    {
      id: "E2",
      hypothesis: "若静态 patch 风险过高，先用 hook 或运行时样本确认因果",
      firstProbe: "对目标分支做动态验证，确认 patch 后预期结果",
      expandWhen: "patch 目标、因果和验收方式都已明确",
      parkWhen: "动态验证无法证明该 patch 会带来目标效果"
    }
  ],
  probeSequence: [
    "先证明 patch 的最小原因",
    "再执行 rebuild、resign 与安装验证",
    "最后记录副作用与残留问题"
  ],
  evidenceAnchors: [
    "目标 smali 位置、分支因果、安装与运行结果",
    "smali-patch-notes、验证日志、对比样本"
  ],
  pivotSignals: [
    "需要改动的代码面过大",
    "patch 后出现新的完整性或运行时问题",
    "静态 patch 不能稳定复现目标效果"
  ],
  successSignals: [
    "已证明 patch 点是最小原因",
    "已完成重打包、重签名与安装验证"
  ],
  caveats: [
    "patch 只服务于验证，不替代原始证据"
  ]
};

