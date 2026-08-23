export default {
  caseId: "android-so-runtime-evidence-workflow",
  status: "active",
  category: "so-runtime-evidence",
  tags: [
    "so-runtime-evidence",
    "encrypted so",
    "packed so",
    "self-decrypt",
    "runtime rebuild",
    "anonymous rx",
    "memfd",
    "crash",
    "sigkill",
    "sigsegv",
    "sigtrap",
    "direct syscall",
    "dump fix",
    "call_constructors"
  ],
  focus: [
    "磁盘 SO 可读不等于代码真实执行——先判定可分析性再进 IDA",
    "崩溃根因常藏在加载链最早期（constructor/init_array/匿名段），从崩溃点往回猜会漏检",
    "Frida libc hook 看不到内联 svc direct syscall，行为发生但 hook 未命中时必须上内核侧"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/so-runtime-evidence-notes.md"
  ],
  checkpoints: [
    "已对磁盘 SO 做可分析性判定（命中特征、证据来源），命中即触发 dump/fix 而非直接分析",
    "dump/fix 产物已通过 file/readelf -h/readelf -d 校验，base/偏移口径已记录",
    "已落盘 /proc/<pid>/maps 并标出所有 rwx、匿名 r-x、memfd、可疑 [anon:.bss] 段",
    "已用内核 syscall 捕获或检索 mmap/mprotect(PROT_EXEC)/memfd_create 来源",
    "已把崩溃/调用的 pc/lr/callsite 与 maps 比对，逐项写明归属（SO/系统库/匿名 RX/memfd/未知）",
    "崩溃案例已按 7 步闭环推进：syscall 定位 -> 可分析性/dump-fix -> 入口分析 -> 匿名执行 -> CRC -> 崩溃函数 -> patch 验证"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "从'磁盘 SO 是否真实可分析'出发可决定是否需要运行期 dump，避免把 patch 打在诱饵代码上",
      firstProbe: "用 IDA/objdump 检查 section/dynamic 表、函数数量、DT_INIT 是否业务代码；比对已知运行 pc/lr 是否落在磁盘可解释段",
      expandWhen: "观察到任一可分析性命中特征（仅导入桩、constructor 含解密、运行期匿名 RX 等）",
      parkWhen: "磁盘 SO 完整可分析、无加密/壳化特征、运行 pc/lr 落在磁盘代码段——回到 native-so 常规分析"
    },
    {
      id: "E2",
      hypothesis: "从'崩溃 pc/lr 归属'出发可直接定位真实执行位置（SO/匿名段/memfd），绕过盲猜",
      firstProbe: "用内核 syscall 捕获崩溃的 syscall、pc/lr/sp 并归属到 maps 映射；拉取 /proc/<pid>/maps 落盘",
      expandWhen: "pc/lr 落在匿名 RX/memfd/未知映射，或 inline hook 后立刻崩溃（.text 自校验信号）",
      parkWhen: "崩溃明确与 native 无关（如纯 Java OOM、框架生命周期 kill）——交给对应专题"
    }
  ],
  probeSequence: [
    "判定磁盘 SO 可分析性（section/dynamic/函数数/DT_INIT/运行 pc/lr 对比）",
    "命中则按 dump 时机选工具（constructor 窗口 / dlopen / maps 稳定 / 匿名段范围），dump 后 file/readelf 校验",
    "落盘 /proc/<pid>/maps，枚举 rwx/匿名 r-x/memfd/[anon:.bss] 段",
    "内核 syscall 捕获 mmap/mprotect(PROT_EXEC)/memfd_create 来源 + 崩溃 kill/SIGSEGV/SIGTRAP 的 pc/lr/sp",
    "把 pc/lr/callsite 与 maps 逐项比对，确认真实执行位置",
    "关键逻辑在匿名段时 dump/fix 匿名段，后续分析以匿名段产物为准",
    "崩溃案例按 7 步闭环推进；patch 候选标注基于哪个产物（dump SO/匿名段）的偏移"
  ],
  evidenceAnchors: [
    "SO 可分析性判定结论与命中特征（section 表异常、仅导入桩、constructor 解密等）",
    "dump/fix 产物路径 + file/readelf 校验输出 + base/偏移口径",
    "/proc/<pid>/maps 落盘文件 + 标注的可执行段",
    "内核 syscall 日志（kill/tgkill/exit/mmap/mprotect/memfd_create + pc/lr/sp 归属）",
    "pc/lr 与 maps 的逐项归属表"
  ],
  pivotSignals: [
    "磁盘 SO 完整可分析且运行 pc/lr 落在磁盘代码段 -> 退出本 topic，回 native-so 常规分析",
    "目标同时有 DEX 壳 -> 先按 unpack-tool-matrix 处理 DEX，再回本专题处理 SO",
    "内核手段（syscall 捕获/HWBP）所需设备条件不满足（无 root/无 KPM/非 arm64）-> 切到 Frida 短窗口 dump 或静态离线分析",
    "dump/fix 反复失败 -> 补 dump 时机/maps/linker constructor 证据，禁止回退到直接分析磁盘 SO",
    "同 SO/函数/调度链动态验证失败累计 3 次 -> 按 failure-protocol 动态-静态 pivot 专项回完整静态闭环"
  ],
  successSignals: [
    "磁盘 SO 可分析性有书面判定（不是默认可读），命中时已 dump/fix 并校验",
    "运行期真实执行位置（SO/匿名段/memfd）已通过 pc/lr 归属确认，非猜测",
    "崩溃案例 7 步闭环已推进到 patch 验证，patch 候选偏移标注了基于哪个产物",
    "so-runtime-evidence-notes.md 已填写，包含 6 项匿名执行证据结论与 syscall 证据摘要"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Close"
  ],
  caveats: [
    "A4 以下保护通常不需要本专题完整闭环，先做可分析性快判",
    "本专题聚焦 SO 层运行期证据；DEX 层脱壳归 dex-loader/unpack-tool-matrix",
    "direct syscall（内联 svc #0）绕过 libc，Frida libc hook 未命中不能下'无该行为'结论",
    "dump 时机优先 call_constructors；短窗口/快速闪退用 Frida 联动即时 dump",
    "关键逻辑在匿名段时，patch 候选与 pc/lr 归属必须以匿名段 dump 产物为准，不能套用磁盘 SO 偏移"
  ]
}