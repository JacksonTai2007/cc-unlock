export default {
  caseId: "android-anti-emulator-debug-workflow",
  status: "abstract-case",
  category: "anti-emulator-debug",
  tags: [
    "anti-emulator-debug",
    "emulator",
    "debug"
  ],
  focus: [
    "模拟器检测",
    "调试检测",
    "时机与绕过"
  ],
  deliverables: [
    "report.md",
    "run/anti-emulator-bypass.js"
  ],
  checkpoints: [
    "已枚举检测面",
    "已识别触发时机",
    "已记录绕过状态"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先确认检测触发在启动、附加还是功能点击前后",
      firstProbe: "对 Application、首屏 Activity、关键按钮与 ptrace/debug API 做最小探针",
      expandWhen: "已拿到明确的触发时机和调用点",
      parkWhen: "无法区分触发时机或命中点始终漂移"
    },
    {
      id: "E2",
      hypothesis: "若 Java 层未命中，检测可能在 Native 或多进程执行",
      firstProbe: "补查子进程、ptrace、ro.kernel.qemu、maps、TracerPid 与 Native 导入",
      expandWhen: "已识别真实检测层与执行进程",
      parkWhen: "多轮探针仍无法定位检测层或无法稳定复现"
    }
  ],
  probeSequence: [
    "先分离 emulator、debug、tracer 三类检测面",
    "再确认触发时机与执行进程",
    "最后选择 Java hook、Native hook、preload patch 或静态 patch"
  ],
  evidenceAnchors: [
    "Application/Activity 调用点、调试 API、系统属性读取",
    "logcat、hook 日志、TracerPid、maps 或 Native 导入证据"
  ],
  pivotSignals: [
    "Java 层未命中但功能被阻断",
    "检测只在子进程或早期阶段触发",
    "旁路后出现新的次级检测面"
  ],
  successSignals: [
    "已对主要检测面完成显式裁定",
    "已记录可复用的旁路方式与副作用"
  ],
  caveats: [
    "不得把 Root/Frida 绕过替代为 anti-debug 结论"
  ]
};

