export default {
  caseId: "android-stealth-hook-workflow",
  status: "active",
  category: "stealth-hook",
  tags: [
    "stealth-hook",
    "kernel-hook",
    "hwbp",
    "pte-hook",
    "uxn",
    "dbi",
    "ghost-memory",
    "vma-less",
    "maps-hide",
    "ptrace-spoof",
    "kpm",
    "kernelpatch",
    "apatch",
    "lsplant-stealth",
    "anti-crc",
    "anti-cheat-bypass",
    "a6",
    "a7",
    "高对抗"
  ],
  focus: [
    "确认用户态 Hook 失败是系统性拦截而非配置错误（落盘 detection-evidence）",
    "设备能力四件套（ARM64 + Kernel 5.4+ GKI + APatch + 解锁 BL）全部确认",
    "按任务类型分流：取证型用 HWBP，共存型优先 Frida 过检测，本 topic 内核手段是升级而非默认",
    "模式选择按 HWBP（≤6 点 / 仅观察）/ PTE+DBI（>6 点 / 替换执行流）/ LSPlant 魔改（Java 无痕）",
    "hook 点必须避开高频通用函数（memcpy/malloc），hit_count 爆炸即停"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/stealth-hook-notes.md"
  ],
  checkpoints: [
    "已记录用户态 Hook（Frida/Xposed/Dobby/Zygisk）失败的系统性拦截证据",
    "已确认目标防护等级 A6+（低于 A6 应回 hook-injection）",
    "已落盘设备能力四件套答案（ARM64 / Kernel / APatch / Bootloader）",
    "已按任务类型与 hook 点数量选定模式（HWBP / PTE+DBI / LSPlant）并落原因",
    "如用户选择外部 stealth-hook 项目，已记录 GitHub 链接、本地产物路径、版本或 commit、SHA256 与设备假设",
    "外部工具设备侧自检已真实执行并落盘；未选择或未执行时不得把部署列为完成",
    "hook 命中证据已落盘（X0-X7 + mem dump + hit_count）",
    "反检测裁定对照表已逐项确认（CRC / maps / ptrace / ArtMethod 指针 / SELinux）"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "从'用户态 Hook 失败证据'出发可判断是否真的需要升级到内核手段，避免过早升级",
      firstProbe: "逐一确认 ptrace/Frida/Xposed/Zygisk/Dobby 失败原因，区分'工具用法错'与'被目标系统性拦截'，落盘 detection-evidence",
      expandWhen: "至少一种用户态工具确认被目标系统性拦截（init_array 自检、/proc/self/maps 监控、CRC 校验、ArtMethod 指针漫游）",
      parkWhen: "失败原因可归因到工具配置错误或环境不匹配——此时应修工具而非升级到内核"
    },
    {
      id: "E2",
      hypothesis: "从'需要什么数据 + hook 点多少'出发可直接映射到 stealth-hook 的子模式",
      firstProbe: "明确目标：观察参数返回值（HWBP）/ 替换函数体或 >6 点（PTE+DBI）/ Java 层无痕 Hook（LSPlant 魔改）",
      expandWhen: "数据目标和子模式匹配明确，且设备能力四件套齐备",
      parkWhen: "数据目标仍模糊或设备能力不足——前者回用户态分诊，后者评估换设备或刷 KernelPatch"
    },
    {
      id: "E3",
      hypothesis: "从'反作弊检测面'出发可确定 Maps Hide / Ghost Mem / Ptrace Spoof / LSPlant 魔改是否必选",
      firstProbe: "枚举目标已知检测面（CRC / maps 扫描 / ptrace 探测 / ArtMethod 指针漫游），按 stealth-hook 反检测对照表逐项确认是否需开启对应模块",
      expandWhen: "目标检测面映射到 stealth-hook 多模块组合（如 CRC + 指针漫游 → PTE+DBI + Ghost Mem + 魔改 LSPlant）",
      parkWhen: "目标只触发单一检测面（如仅 CRC）→ 单 HWBP 即可，不必上完整栈"
    }
  ],
  probeSequence: [
    "穷尽用户态手段并落 detection-evidence（按 hook-injection + anti-frida 顺序）",
    "确认防护等级 A6+ 与任务类型（取证 vs 共存）",
    "校验设备能力四件套（ARM64 / Kernel 5.4+ GKI / APatch / 解锁 BL）",
    "按子模式选择（HWBP / PTE+DBI / LSPlant 魔改）并落 modeSelectionReason",
    "用户自行选择并准备可选外部 stealth-hook 项目产物后，记录来源、本地路径、版本或 commit、SHA256，再做设备侧加载 / 自检",
    "选 hook 点（避开 memcpy/malloc 等高频函数）+ 设 hook（live trace / listen-ret / modify-arg / replace-ret）",
    "采集命中证据（X0-X7 + mem dump + hit_count）",
    "反检测裁定（对照表逐项确认 CRC / maps / ptrace / perf_event / ArtMethod 指针）",
    "如需 Java 无痕 Hook：魔改 LSPlant（替换 inline_hooker + mem_map 接 Ghost Mem）"
  ],
  evidenceAnchors: [
    "用户态 Hook 失败的 detection-evidence（init_array 自检、/proc/self/maps 监控、CRC 触发点、ptrace 拦截）",
    "设备能力快照（uname -r、getprop abi、APatch 版本、KernelPatch 版本、BL 状态）",
    "外部工具尝试证据（GitHub 链接、本地产物路径、版本或 commit、SHA256、设备侧加载 / 自检日志）",
    "hook 命中证据（live trace 输出 / query 拿到的 X0-X7 + mem dump + hit_count）",
    "反检测对照裁定表（CRC / maps / ptrace / perf_event / ArtMethod 指针 / SELinux）"
  ],
  pivotSignals: [
    "用户态失败原因与目标保护无关（如 Frida 版本不匹配）→ 退出本 topic 修工具",
    "设备不支持 APatch / KernelPatch（如厂商锁定内核） → 切到 kernel-assisted-re 的 eBPF 路线或纯静态",
    "KPM 加载导致设备不稳定（频繁重启 / 卡死） → 切到非共存型方案（如 frida-dexdump 内存 dump + 离线分析）",
    "HWBP hit_count 爆炸 → hook 点选错（落在通用函数），切到更具体的业务地址",
    "共存型目标且 Frida 死路 → 升级到 LSPlant 魔改 + Ghost Mem 跳板（成本最高，需评估）",
    "采集数据无法回接到应用层业务结论 → 把数据留给其他 topic（crypto-protocol / dex-loader）继续分析"
  ],
  successSignals: [
    "若使用外部 stealth-hook 项目，用户提供的本地产物已完成设备侧加载 / 自检并落盘",
    "hook 命中并采集到目标数据（X0-X7 + mem dump 完整 / 返回值抓到 / 参数改成功）",
    "反检测对照表逐项 ✅（CRC / maps / ptrace / ArtMethod 指针 / SELinux 全部通过或已记录残留风险）",
    "用户态失败原因有书面证据，不是猜测",
    "stealth-hook-notes.md 已填写且包含模式选择理由 + 反检测裁定"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Close"
  ],
  roundLedgerHint: "多轮反作弊对抗建议同步维护 run/round-ledger.md，按轮次记录：检测面 → 选定模式 → hook 点 → 命中证据 → 反检测残留 → 下一轮 pivot",
  relatedTopics: [
    "kernel-assisted-re",
    "hook-injection",
    "anti-frida",
    "so-runtime-evidence",
    "a6-a7-failure-pattern-cookbook",
    "integrity-pinning"
  ],
  playbookRefs: [
    "references/stealth-hook-playbook.md",
    "references/stealth-hook-vs-traditional-matrix.md",
    "references/kernel-assisted-re-playbook.md",
    "references/hook-injection-playbook.md",
    "references/anti-frida-playbook.md",
    "references/a6-a7-failure-pattern-cookbook.md"
  ],
  caveats: [
    "A6 以下保护通常不需要内核无痕 hook，先在 hook-injection + anti-frida 路线穷尽用户态手段并落 detection-evidence",
    "外部 KPM 必须匹配当前设备内核版本（KernelPatch 0.13.x + kpimg d01+），跨设备/跨内核复用风险高，升级系统前必须重新验证",
    "HWBP 必须遍历 /proc/[pid]/task 对所有 TID 注册并通过 wake_up_new_task hook 监听新线程，单核注册只在主核生效",
    "Ghost Mem 的 PTE 是手工构造的不走 VMA，进程退出时必须显式释放，否则会造成内核态泄漏",
    "SELinux enforcing 模式下 KPM 加载和 Ghost Mem 映射可能需要额外策略，不要默认 permissive",
    "hook 点禁止落在 memcpy/malloc/memset 等通用高频函数，hit_count 爆炸即停并切换到更具体的业务地址"
  ]
};
