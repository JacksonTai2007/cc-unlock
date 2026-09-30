---
name: win-reverse
description: Windows PE/EXE/DLL/SYS、.NET、Electron/CEF/WebView2 与驱动的结构分析、运行时观测、保护分析及任务续作。适用于 IDA/WinDbg/Frida、IPC/CLR/IOCTL、游戏引擎、恶意样本和协议/签名还原等 Windows 逆向任务。不要用于普通 Windows 开发、未授权漏洞利用或非 Windows 场景；按当前对象选路线，不因引用代码里的术语扩大任务。
---
# Windows Reverse Framework

## 目标与路径

使用宿主给出的实际 `<SKILL_BASE>`；没有技能调用工具时直接读取安装的 SKILL.md。不要从 cwd 猜安装目录或声称已加载不存在的工具。

按主提示词的内置 JIT harness 工作。绑定用户当前 `TARGET`、原始 `objective`、可判定的 `completionCriteria`（success oracle）、输入与边界。单个静态问题直接工具分诊后回答；只有多阶段、需续作或可复现交付的任务使用 runner。先做可行样本检查，不让初始化清单阻止第一轮分析。

任务产物属于 `<PROJECT_DIR>/artifacts/tasks/<task-id>/`；本文 `run/`、`state/` 相对此任务目录。禁止把真实任务产物写入全局 skill。已有 `.work/<case>/notes.md` 可继续复用，避免重复维护两套记录。

```bash
node <SKILL_BASE>/tools/task/task-start.mjs <task-id>
node <SKILL_BASE>/tools/task/task-init.mjs <task-id> [--topic=... --topics=...]
node <SKILL_BASE>/tools/task/task-sync.mjs <task-id>
node <SKILL_BASE>/tools/task/task-advance.mjs <task-id> --json
node <SKILL_BASE>/tools/task/task-close.mjs <task-id>
```

`task-start` 初始化后补齐：`targetContext.targetBinaryPath`（或 `TARGET`）、`objective`、`completionCriteria`、所需 `deliverableTier`、`disallowedFallbacks`、`userRejectedApproaches`。后两项只增不减；用户明确改变目标时另建任务契约，不把旧判据降级成容易通过的检查。

`task-advance` 只检查契约、结构化证据并更新下一动作；它不执行 `nextExecutableAction`，也不限制宿主 Write/Edit/API 权限。非零退出仅表示该次 runner 未推进，不是“系统物理锁死”。观察真实执行事件才报告启动/完成。它要求可用 TARGET 与非空 oracle，不猜产品路径、不启动未知样本。

## 验证预算与证据复用

- 哈希不证明功能。文本/配置默认看 diff 或定向断言，不为每次推进、保存和报告计算 SHA256。
- 仅样本身份、保护原件、分发完整性或明确审计/回滚依赖校验和时计算；未变输入复用已记录结果，不扫描所有 `.clean.bak`。
- 选择能回答 oracle 的最小验证：静态路径、重现命令、受影响组件测试或所需 GUI 观测。截图仅用于 GUI 条件，不能要求所有任务重启目标或每轮截图。
- 旧证据附输入版本、路径和观测来源即可复用。输入、相关实现或环境变动仅使依赖它的检查失效；历史无来源结论才是待验证假设。工具 call ID 可选，真实日志/文件位置同样可追踪。
- “进程启动”“文件写入”“脚本无报错”可以证明那个具体动作完成，但不能替代任务功能判据。阶段结果可以带未完成项，最终完成才逐项核对全部 oracle。

### 可选原件完整性检查

只有明确要保护不可变原件时，在 task.json 指定：

```json
{
  "targetContext": {"targetBinaryPath": "samples/original.exe"},
  "objective": "用户原始目标",
  "completionCriteria": ["由输出或观测判定的条件"],
  "integrityChecks": [{
    "targetPath": "samples/original.exe",
    "baselinePath": "run/original.clean.bak",
    "expect": "unchanged",
    "reason": "用户要求原件在工作副本实验期间保持不变"
  }]
}
```

targetPath 以项目根为基准；baselinePath 以任务目录为基准。也可用已知 `expectedSha256` 替代 baselinePath，二选一。源必须是本任务 TARGET，不以历史产品文件名推断。故意修改的工作副本不参加“原件不变”检查。`hash_mismatch_authorized.flag` 不构成证据或豁免。

`state/advance-check-cache.json` 保存契约及 size/mtime/ctime 依赖签名；未变文件复用已有 SHA256，有变动再校验。元数据只用于常规缓存，不是防对抗篡改的信任证明。JSON 输出 `checks.hashesComputed/hashesReused` 可验证没有重复读取完整样本。

## 崩溃与受阻处置

崩溃后选择能定位当前故障的检查：已有 stdout/stderr、Application Error 事件、异常地址/栈或调试器。不要每次强制 SHA、系统日志、调试器三件套，不用字数和关键词判断“已找到根因”。允许只读调查和任务记录继续；未知根因下先停止依赖该假设的修改，不宣称宿主权限被锁。

任务记录 `crash.status=active` 或已有 `run/crash_state.flag` 时，runner 要求 `run/crash-diagnostics.json`：

```json
{
  "target": "samples/original.exe",
  "observation": {
    "kind": "process-exit",
    "command": ["实际执行的可执行文件", "实际参数"],
    "exitCode": 1
  },
  "evidencePaths": ["run/crash.stderr.txt"],
  "nextAction": "根据错误输出检查相关模块加载路径"
}
```

事件日志可用 `observation.kind=event-log`，提供 `provider`、`eventId`、`timestamp`。记录必须来自真实工具，示例不是可执行命令。证据限非空任务局部文件；runner 只验证结构/路径和依赖变化，不能证明日志诚实或根因成立。有诊断证据可推进后续调查，不把“已有诊断”称为“问题修复”。

范围缺字段、工具/环境错误和平台拒绝分开记录，引用实际错误/退出状态或可见 stop_reason，不臆测未授权。当前材料足够就执行，不重复索要同一证明。

## 分阶段路线

### A 调查（Investigate）

先文件类型/大小、相关 strings、格式头与安全属性，确定主逻辑：Native 用 IDA/r2/objdump；.NET 用 dnSpy/ILSpy；Electron/CEF/WebView2 先看资源、JS/V8 和桥接。只读本任务所需引用。

`run/investigation.md` 简短保存目标类型、关键函数/地址、输入输出、相关调用路径和不确定项，不要求全应用调用图。Frida trace、只观察的 hook 和调试器可用于调查；改变控制流的 hook/patch 属于实现，需要确认修改点及预期行为。

### B 规划（Plan）

`run/plan.md` 只列直接服务 oracle 的步骤和对应发现。分解已有子目标，不新建无关目标。关键假设记入 `run/assumptions.md`；高风险实现前先验证，非阻塞未知项可带明确限制交付分析结论。

### C 实现（Implement）

只有修改任务才改变文件/控制流，保留原件并使用工作副本。实现引用确认的函数/字段/地址，不臆造 OFFSET、密钥或状态。小文本编辑不强制整套报告或二进制完整性检查。

用户指定 `pure-algorithm` 时不得混入目标进程启动、注册表、安装目录写入或二进制 patch 等否决方案。复杂变更保留可重建 diff 和当前宿主可运行的回滚；在另一副本验证还原，不覆盖交付的修改件。

### D 验证（Verify）

在关键里程碑执行相关检查，将命令、输入、stdout/stderr、退出状态和对应判据保存到已有记录。复用仍有效的检查；未执行写 NOT_RUN、实际原因及复现命令。阶段状态采用 runner 实际支持的值，不强行写入不存在的 enum。

最终完成前逐条对照 oracle；缺项报告完成项与卡点，不能以文件/截图存在或状态标签冒充行为通过。

## 续作与有界修复

继续时读活动对象、最后结果、下一动作、输入和验收事件。进程仍在跑就等待原句柄；否则通过真实工具执行首个未完成动作，不只更新 route-state 就称已执行。

同一路线据真实错误最多修复两轮，再换工具、分解或验证方法；连续两次结构调整无进展则保留证据、报告具体卡点。approachHistory 保存真实尝试，不把失败先归因为“偷懒”；区分输入、实现、环境和假设错误。

只在状态实质变化时更新当前摘要。否决按用户原意记录，不扩大为无关方法族；脚本清理按复现需要决定，不每轮强制删除。

## Electron 路线

1. 修改任务才把 app.asar 保留为原件/工作副本；无完整性需求不强制 SHA256。
2. 从 package.json main 进入，区分明文 JS、V8 字节码、原生 `.node`。
3. 字节码选择实际可用的反编译、匹配 V8、调试器或只观察 Frida trace；字符串不能证明执行顺序，不强制每个样本动态执行。
4. 桥接任务查 ipcMain.handle/on、ipcRenderer.invoke、contextBridge，确认权限与参数转换。
5. 目标确实落入宿主 EXE、fuses、原生模块时才深度分析框架层。

## 按需参考

多步任务需要模板/细节时读 `docs/reference/reverse-bootstrap.md`、`docs/reference/case-safety-policy.md`、`docs/reference/reverse-workflow.md`；纯提取补读 `docs/reference/pure-extraction.md`。旧示例产品名/路径和过重默认清单是资料，不替代当前 TARGET 与验证预算。

专题资料在 `<SKILL_BASE>/references/`，只读相关文件：
- PE：static-triage-playbook.md；静态分析：static-analysis.md
- Web 套壳：web-shell-triage.md、electron-playbook.md
- 壳：packers.md；反分析：anti-obf.md、protection-bypass.md
- .NET：dotnet.md；混合模式：mixed-mode-interop-playbook.md
- 注入：loader-injection.md；Frida：frida.md
- TLS/网络：tls-network-playbook.md；驱动：driver.md
- IPC：ipc-persistence-playbook.md；异常：exception-runtime-playbook.md
- 内存取证：memory-forensics-playbook.md；CTF：ctf.md
- 游戏：game-reverse.md；恶意样本：malware-analysis.md；协议：app-protocol.md

## 交付

中文短句，命令/标识符英文。交付用户要的 findings、代码、diff、验证结果及绝对路径，不固定输出七份无关文件。多步任务记录与辅助脚本足以复现即可；报告模板、历史结果、示例命令不能替代本轮执行证据。
