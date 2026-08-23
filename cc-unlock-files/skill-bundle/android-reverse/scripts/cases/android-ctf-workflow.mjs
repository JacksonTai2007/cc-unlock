export default {
  caseId: "android-ctf-workflow",
  status: "abstract-case",
  category: "ctf",
  tags: [
    "ctf",
    "crackme",
    "solver"
  ],
  focus: [
    "校验逻辑",
    "flag 路径",
    "solver"
  ],
  deliverables: [
    "report.md",
    "run/solver-template.py"
  ],
  checkpoints: [
    "已找到校验入口",
    "已确认 Java 或 JNI 路径",
    "已形成 solver 或明确剩余阻断"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从 flag 校验路径恢复最小判定逻辑",
      firstProbe: "查找 flag、success/fail 字符串、校验函数、关键按钮与分支",
      expandWhen: "已定位主校验函数或主约束",
      parkWhen: "字符串与界面入口全部无效"
    },
    {
      id: "E2",
      hypothesis: "若界面与字符串无效，则从算法或 Native 校验点反推",
      firstProbe: "检查 JNI、加密常量、数组校验、变换循环与异常分支",
      expandWhen: "已能构造 solver 或 patch 路径",
      parkWhen: "约束仍不闭合且缺少更多样本"
    }
  ],
  probeSequence: [
    "优先恢复主校验入口",
    "再压缩约束为 solver 或最小 patch",
    "最后沉淀验收脚本"
  ],
  evidenceAnchors: [
    "flag 校验函数、字符串、按钮事件、异常分支",
    "solver 样本、算法中间态、patch 或运行结果"
  ],
  pivotSignals: [
    "主校验在 Native 或动态加载中",
    "字符串线索全被混淆或误导",
    "solver 输出与真实校验不一致"
  ],
  successSignals: [
    "已给出可运行的 solver 或稳定 patch 路径",
    "已记录关键约束和验收方式"
  ],
  caveats: [
    "不保留真实题目样本"
  ]
};

