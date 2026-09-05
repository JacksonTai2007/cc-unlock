export default {
  caseId: "android-kernel-assisted-re-workflow",
  status: "active",
  category: "kernel-assisted-re",
  tags: [
    "kernel-assisted-re",
    "ebpf",
    "hwbp",
    "pte hook",
    "seccomp",
    "svc monitor",
    "dex dump kernel",
    "edbg",
    "kpm"
  ],
  focus: [
    "先确认用户态工具是否真的穷尽（不是'没成功'而是'被系统性拦截'）",
    "按数据目标选内核工具，不按熟悉度选",
    "内核手段是升级路径，不是首选项"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/kernel-assisted-re-notes.md"
  ],
  checkpoints: [
    "已记录用户态工具失败的具体检测点（ptrace/Frida/Xposed/Zygisk 哪一个被哪种机制拦截）",
    "已确认设备 Root + 内核版本 + eBPF/模块加载能力三件套",
    "已按数据目标选定内核工具并记录原因",
    "内核工具部署日志已落盘（编译参数、推送路径、加载命令）",
    "采集到的数据已落盘并验证（DEX magic、syscall 序列、断点命中日志）"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "从'用户态失败证据'出发可判断是否真的需要升级到内核手段，避免过早升级",
      firstProbe: "逐一确认 ptrace/Frida/Xposed/Zygisk 失败原因，区分'工具用法错'与'被目标系统性拦截'，并落盘 detection-evidence",
      expandWhen: "至少一种用户态工具确认被目标系统性拦截（如 init_array 自检、/proc/self/maps 监控、seccomp-bpf 限制）",
      parkWhen: "失败原因可归因到工具配置错误或环境不匹配——此时应修工具而非升级到内核"
    },
    {
      id: "E2",
      hypothesis: "从'需要什么数据'出发可直接映射到内核工具类型，绕过试错",
      firstProbe: "明确数据目标是 DEX dump、syscall 序列、特定地址断点、还是 Binder 代理，按 playbook 工具选择矩阵选型",
      expandWhen: "数据目标清晰且对应工具有明确部署 SOP（eBPFDexDumper / edbg / KPM-HWBP / AndProxy）",
      parkWhen: "数据目标本身仍模糊——应先在用户态做更cheap的分诊明确要抓什么"
    }
  ],
  probeSequence: [
    "确认用户态失败是系统性拦截而非配置错误",
    "验证设备能力（Root、内核版本 >=5.4、/sys/fs/bpf 挂载、SELinux 状态）",
    "按数据目标选内核工具并编译（Rust + libbpf + NDK 交叉编译）",
    "部署到设备并加载（推送 / insmod / 挂载 eBPF 程序）",
    "执行采集并验证产物完整性（DEX 头、syscall 号、断点地址）",
    "把内核产物转回应用层结论（DEX 反编译、syscall 还原行为、断点寄存器值解读）"
  ],
  evidenceAnchors: [
    "用户态工具失败的具体检测日志（init_array 字符串、/proc 监控证据、seccomp 过滤规则）",
    "设备能力快照（uname -r、/sys/fs/bpf、SELinux 模式、Root 类型）",
    "内核工具部署日志（编译输出、推送路径、加载成功证据）",
    "采集产物（dump 出的 DEX 文件、syscall 日志、断点命中记录）"
  ],
  pivotSignals: [
    "用户态工具失败原因与目标保护无关（如 Frida 版本不匹配）→ 退出本 topic 修工具",
    "设备不支持 eBPF 且无法刷自定义内核 → 切到 Smali Patch 或静态离线解密路径",
    "内核工具加载导致设备不稳定（频繁重启/卡死） → 切到纯静态分析或在另一台设备上重试",
    "采集数据无法回接到应用层业务结论 → 把数据留给其他 topic（crypto-protocol / dex-loader）继续分析"
  ],
  successSignals: [
    "内核工具成功部署且采集到目标数据（DEX 头校验通过 / syscall 序列完整 / 断点命中）",
    "用户态失败原因有书面证据，不是猜测",
    "采集数据已转化为应用层结论（dump 的 DEX 可反编译 / syscall 序列可还原行为）",
    "kernel-assisted-re-notes.md 已填写且包含工具选择理由"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Close"
  ],
  caveats: [
    "A4 以下保护通常不需要内核手段，先做工具选择自检",
    "本 topic 不以内核自身为逆向目标，所有内核操作必须服务于应用层交付",
    "eBPF 程序和内核模块需要匹配当前内核版本编译，跨设备复用风险高",
    "硬件断点必须用 smp_call_function 同步所有核心，否则只在主核生效",
    "SELinux enforcing 模式下内核模块和 eBPF 可能需要额外策略，不要默认 permissive"
  ]
}
