export default {
  caseId: "android-protection-bypass-workflow",
  status: "abstract-case",
  category: "protection-bypass",
  tags: [
    "protection-bypass",
    "root",
    "pinning"
  ],
  focus: [
    "Root",
    "Frida",
    "Integrity",
    "Pinning"
  ],
  deliverables: [
    "report.md",
    "run/anti-root-bypass.js",
    "run/anti-frida-bypass.js",
    "run/integrity-bypass.js",
    "run/cert-pinning-bypass.js"
  ],
  checkpoints: [
    "已对 root / frida / integrity / pinning 四个子面完成显式裁定",
    "已明确触发时机",
    "已记录绕过状态"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先拆分 root、frida、integrity、pinning 四个子面并判断触发时机",
      firstProbe: "围绕启动前、启动中、点击后、发包前记录检测触发点和报错面",
      expandWhen: "已完成四个子面的显式裁定",
      parkWhen: "检测面仍混杂，无法判定究竟是哪一层在阻断"
    },
    {
      id: "E2",
      hypothesis: "若单层 hook 无效，阻断可能发生在 Native、多进程或更早时机",
      firstProbe: "补查 preload、Native hook、静态 patch、child process 与 early init",
      expandWhen: "已得到最小原因 patch 或稳定绕过路径",
      parkWhen: "绕过动作副作用过大且无法保持业务链稳定"
    }
  ],
  probeSequence: [
    "先枚举检测面与触发时机",
    "再决定注入层级与最小旁路策略",
    "最后记录残留问题和副作用"
  ],
  evidenceAnchors: [
    "检测调用点、报错日志、hook 命中、绕过脚本",
    "root/frida/integrity/pinning 四子面裁定结果"
  ],
  pivotSignals: [
    "Java hook 未命中但功能仍被阻断",
    "绕过一层保护后立刻出现次级保护",
    "真实阻断发生在网络、Native 或早期初始化阶段"
  ],
  successSignals: [
    "四个子面都已完成显式裁定",
    "已记录稳定的绕过方式、残留点和副作用"
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
    "不得把未验证的 bypass 写成成功"
  ]
};

