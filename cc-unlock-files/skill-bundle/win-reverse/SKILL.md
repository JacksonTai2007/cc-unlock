---
name: win-reverse
description: Windows 平台专业高级逆向工程技能框架。适用于 PE/EXE/DLL/SYS/.NET/CLR/C++-CLI/WOW64/VMP/Themida/Enigma/x64dbg/IDA/WinDbg/Frida/dnSpy/ILSpy/COM/RPC/ALPC/NamedPipe/Service/WMI/Minidump/VAD 场景，覆盖 PE 分诊、壳与 OEP/IAT、抗分析、.NET/CLR、驱动、Frida 运行时、TLS/网络、Loader/注入/manual map、配置与资源恢复、UI 消息流、异常/启动链、混合托管桥接、IPC/持久化控制面、内存取证与 Windows CTF，以及游戏逆向(UE4/UE5/Unity/IL2CPP/Cocos2d-x/GNames/GObjects/SDK Dump/反作弊)、恶意软件分析(勒索/远控/木马/rootkit/挖矿/窃取器)、应用与协议逆向(sign/签名算法/protobuf/SSL Pinning/Electron/Delphi/MFC)等扩展领域，以及模拟真实 Windows 高级逆向工程师场景的多专题 drill / 自主演练 / 自我迭代升级任务。用户一旦提到 DLL 注入、CreateRemoteThread、APC、Reflective DLL、Manual Map、Process Hollowing、服务/计划任务/WMI、COM/RPC/ALPC/NamedPipe、SEH/VEH/TLS callback、C++/CLI/P/Invoke/CLR hosting、资源 blob、注册表配置、许可证字段恢复，或提到游戏引擎逆向、UE4/UE5/Unity/Cocos、GNames/GObjects、SDK Dump、反作弊/EAC/BattlEye、勒索软件加密分析、远控木马、恶意软件、rootkit、协议签名、sign 算法还原、protobuf、易语言、Electron/Delphi/MFC 框架逆向，或要求"模拟真实逆向场景""自主迭代演练"等典型 Windows 逆向场景，也必须触发本技能。不要用于普通 Windows 开发、未授权漏洞利用或其它非 Windows 场景逆向。
---
# Windows Reverse Framework

## 任务脚本与路径约定

当 Skill 工具被调用时，系统返回 skill 的 base directory（如 `C:\Users\xxx\.claude\skills\win-reverse`）。以下用 `<SKILL_BASE>` 代指该路径。

**任务产物始终创建在当前项目目录**，禁止在 skill 全局目录创建任务产物。

```bash
node <SKILL_BASE>/tools/task/task-start.mjs <task-id>
node <SKILL_BASE>/tools/task/task-init.mjs <task-id> [--topic=... --topics=...]
node <SKILL_BASE>/tools/task/task-sync.mjs <task-id>
node <SKILL_BASE>/tools/task/task-advance.mjs <task-id>
node <SKILL_BASE>/tools/task/task-close.mjs <task-id>
```

文档读取使用绝对路径：`<SKILL_BASE>/docs/reference/reverse-bootstrap.md` 等。

### ⚠️ 路径规则（硬约束）

本文档中所有 `run/xxx`、`state/xxx` 简写路径，均表示相对于 **`<PROJECT_DIR>/artifacts/tasks/<task-id>/`** 的路径，而不是相对于项目根目录（cwd）。

- **正确**：将 `investigation.md` 写入 `<PROJECT_DIR>/artifacts/tasks/<task-id>/run/investigation.md`
- **错误**：将 `investigation.md` 写入 `<PROJECT_DIR>/run/investigation.md`（cwd 下的 run/ 目录）

**每次写入产物文件前，必须确认路径以 `artifacts/tasks/<task-id>/` 为根**。task-init 脚本已创建了完整目录骨架，所有后续文件操作都必须在该目录内进行。

---

## 反捷径系统（Anti-Shortcut System）

本 SKILL 最核心的部分。解决的问题：LLM 在执行逆向任务时，会系统性地跳过复杂分析步骤，选择简单路线反复尝试，然后用容易获取的信号（脚本无报错、文件已修改）谎报进展。

### ⚠️ 核心硬约束：运行时物理合规检查与硬性诊断闸口协议（物理断路器）

为根治模型在面对失败时通过“语义合理化”进行违规越权或在“最低成本路线”上盲目死循环的通病，本技能工具链已物理集成了**API合规审计与硬性退出码拦截**。你必须无条件执行以下断路器协议，任何自我辩解或试图绕过的行为都将被系统物理锁死：

#### 1. 闪退与静默失败的“物理断路器”（Crash State Hard Block）
一旦目标程序发生【静默闪退】、【无日志报错退出】或【声称还原备份后依旧崩溃】的现象：
* **【物理挂起修改权限】**：立即挂起并物理锁死一切对项目文件的 `Write`/`Edit` 动作。在此状态下，任何尝试直接修改 JS、C#、二进制代码的工具调用均被系统视为越权违规。
* **【强制启动硬件级三步诊断】**：你必须且只能依次执行以下诊断，将客观输出落盘至项目 `run/crash_diagnostics.md` （字数必须 >= 200 字符），通过只读脚本审计后方可解锁修改权限：
  1. **SHA256哈希物理核对**：必须在终端计算当前受损文件与 `.clean.bak` 的哈希值，确保还原 100% 成功，严禁口头声明“已完全恢复”。
  2. **操作系统级事件抓取**：必须使用 PowerShell 或命令行抓取系统 Application Error 事件日志，提取明确的 `ExceptionCode`（如 `0xc0000005` 段错误）与崩溃模块。
  3. **挂载调试器提取堆栈**：若本地提供调试工具，必须挂载调试器（或利用调试 MCP 服务）启动程序，捕获 Crash 瞬间的第一手寄存器（EIP/RIP）及堆栈调用流。
* 未将包含上述硬件特征（如 eip、exception、0x...）的客观证据落盘前，思维中禁止提出任何假说推理。

#### 2. SHA256 哈希一致性硬核交叉校验
* 系统阶段推进工具（`task-advance`）和自测脚本在执行时，会自动物理扫描并核对项目所有 `.clean.bak` 备份文件与其物理原始文件的 SHA256 校验和。
* 若哈希值不匹配，说明系统现场处于被盲改的受损/脏状态。工具将**直接抛出退出码 1 并物理锁死任务推进**。
* **【授权豁免】**：若修改属于合理且受控的行为，你必须在项目 `run/` 目录下物理生成 `hash_mismatch_authorized.flag` 豁免证书，否则系统绝不予放行。

#### 3. 命令行退出码 1 锁死警告
* 当你违反合规协议时，`task-advance` 脚本物理返回非零 Exit Code。此报错属于系统级物理编译报错，你**无法通过任何自我合理化解释**在 Thinking 或正文中绕过。请老老实实回到第一步去获取调试证据或回滚哈希。

---

### 核心认知：什么不算证据

以下信号**永远不构成**任何形式的完成或进展证据：

| 信号 | 为什么不算 |
|------|-----------|
| "脚本执行无报错" | 只说明代码没抛异常，不代表效果达成 |
| "Hook 已注入" | 代码存在于文件中 ≠ Hook 生效 |
| "文件已修改" | 写入了内容 ≠ 内容正确 |
| "进程已启动" | 进程启动 ≠ 功能正常 |
| "代码逻辑上应该可以工作" | 推理不等于验证 |
| "ASAR 解压成功" | 解压成功 ≠ 内容被正确使用 |
| "Hook 代码已写入" | 代码注入 ≠ Hook 生效，生效 ≠ 产生预期效果 |

**唯一有效的证据类型：**
- 截图/命令输出，其中可直接读出与 completionCriteria 匹配的内容
- 用户明确说"成功/可以了/没问题"
- 反编译结果中明确可见的逻辑路径（附函数地址 + 行号引用）

### 规则：Hook 不是调查手段

Hook/注入/拦截是**实现手段**（阶段 C），不是**调查手段**（阶段 A）。以下行为不构成调查：
- 写 hook 来"看看会发生什么"
- 注入代码来"尝试绕过"
- 修改目标来"测试效果"

调查 = 使用只读工具（反编译、调试器断点/单步、字符串搜索、xref 追踪）理解目标行为。如果跳过调查直接写 hook，等于跳过了阶段 A，即使 investigation.md 已经存在。

这条规则的根本原因：hook 是基于假设的盲操作。不理解验证链就写 hook，每次失败只能猜测"是不是 hook 错了"然后换一个 hook 变体，陷入循环。正确的路径是先用只读工具理解验证链的每一步，再精准干预。

### 规则：历史会话的发现是假设，不是事实

从记忆系统、历史会话摘要或 WebSearch 结果中获得的关于目标程序内部逻辑的结论，在本会话中必须视为**未验证假设**。它们可以直接进入 `run/assumptions.md`（状态 OPEN），但不能作为 investigation.md 调用链的证据。

"上一次会话发现验证用的是 crypto.publicDecrypt" → 写入 assumptions.md，标记为 OPEN → 在本会话中用实际工具调用验证 → 验证通过后才能作为 investigation.md 的证据。

原因：历史会话的结论可能本身就来自走捷径的分析。直接继承等于继承了上一次的捷径。

### 规则：进展声明的硬格式

每次写入 route-state.json 的 resultSummary、推进 execution.status、或正文声称进展时，必须附带：

```
进展: [一句话描述]
证据工具调用: [截图/测试的 call_xxx ID，或 "用户确认: 原文引用"]
证据内容: [从工具输出中引用的具体文字]
```

没有证据工具调用 ID 的进展声明没有意义——工具调用 ID 是唯一可追溯的证据锚点，缺少它的声明无法验证真伪。

### 规则：状态推进的证据门控

route-state.json 的 `execution.status` 只允许写入以下值：

- `blocked` — 等待用户/外部条件
- `investigating` — 分析阶段进行中
- `implementing` — 代码实现阶段进行中
- `verified` — 已有截图/测试证据证明效果

**状态推进规则：**
- `investigating` → `implementing`：必须已有 `run/investigation.md` 文件存在
- `implementing` → `verified`：当前 assistant 轮次中必须包含至少一个验证类工具调用（截图/启动测试/命令输出采集），且结果已读取分析
- 任何 → `verified`：必须有证据工具调用，不能凭"代码写完了"直接跳到 verified

跳过验证直接写 verified 意味着状态标签与实际进展脱钩，后续决策将基于虚假前提。

---

## 分阶段工作流（Phase-Gated Workflow）

任务执行分为四个阶段，**每个阶段有明确的入口条件和出口产物**。没有出口产物就不能进入下一阶段。

### 阶段 A：调查（Investigate）

**允许的工具调用：** Read, Grep, Glob, IDA/r2 反编译/反汇编, 字符串搜索, xref 追踪, WebSearch, Bash（只读命令）

**禁止的工具调用：** Write/Edit 任何代码文件、任何修改目标的操作

**出口产物：** `artifacts/tasks/<task-id>/run/investigation.md` 必须存在且包含（以下简写为 `run/investigation.md`，路径根始终是 `artifacts/tasks/<task-id>/`）：

```
## 调查摘要
- 目标类型: [Electron/Native/.NET/...]
- 主逻辑位置: [JS/V8字节码/Native DLL/...]
- 保护等级: [T0-T6]

## 完整调用链（至少 1 条）
入口 → ... → 叶节点，每一步附函数地址和算法描述
每一步必须标注证据来源（如 "--inspect 断点 L42"、"xref 0x401234→0x405678"、"字符串搜索 'license' @0x401000"）
基于 WebSearch 结果推断的调用链不算证据。

## 不确定点（假设清单）
| 假设内容 | 风险(高/中/低) | 验证计划 |
|---------|-------------|---------|

## 下一步建议
```

**分析充分性标准：**

阶段 A 的出口不是数量达标，而是以下定性条件满足：
1. 至少 1 条完整调用链：入口 → 中间节点 → 叶节点，每一步附函数地址和算法描述
2. 调用链覆盖了与用户目标直接相关的关键路径
3. 所有"不确定"的点已记入假设清单（不能有无主的不确定点）

如果以上条件不满足，无论反编译了多少个函数，都不应进入阶段 B。

### 阶段 B：规划（Plan）

**允许的工具调用：** Write/Edit 规划文件, Read, 所有分析类工具

**禁止的工具调用：** Write/Edit 代码文件（patcher/hook/脚本）

**入口条件：** `artifacts/tasks/<task-id>/run/investigation.md` 存在且分析充分性标准满足

**出口产物：** `artifacts/tasks/<task-id>/run/plan.md` 必须存在且每一步引用 investigation.md 的具体发现：

```
## 实现计划
### 步骤 1: [描述]
- 引用: investigation.md 第 X 节
- 目标函数/地址: [具体地址]
- 操作: [具体做什么]
- 预期效果: [修改后的行为变化]

### 步骤 2: ...
```

### 阶段 C：实现（Implement）

**允许的工具调用：** 所有工具

**入口条件：** `artifacts/tasks/<task-id>/run/investigation.md` 和 `artifacts/tasks/<task-id>/run/plan.md` 都存在

**实现过程中的约束：**
- 每一步实现必须引用 plan.md 的步骤编号
- 修改目标文件前必须备份到 `artifacts/tasks/<task-id>/run/<文件名>.clean.bak` + SHA256 记入 `artifacts/tasks/<task-id>/run/backup-manifest.md`
- 任何实现步骤如果依赖于未经验证的假设，必须在 `artifacts/tasks/<task-id>/run/assumptions.md` 中记录

**门禁1（修改前根源分析）仍然适用：** 准备执行任何修改目标的操作前，确认 investigation.md 中已包含该修改点的三要素（目标函数/地址、算法/逻辑描述、与用户目标的关系）。不满足 → 回到阶段 A 补充分析。

### 阶段 D：验证（Verify）

**强制执行，不可跳过。**

**触发时机：** 每次实现步骤完成后，修改了任何影响用户可见行为的代码后，或准备写入 report.md 前。

**必须执行的验证序列：**
1. 启动目标程序 / 运行修改后的代码
2. 截图或采集输出
3. 读取截图/输出内容
4. 逐条读取 task.json 的 completionCriteria
5. 对每一条：在证据中找到对应的可读内容
6. 任何一条在证据中不可读 → 输出 `[Goal-lock] 第 N 条未满足` + 回到阶段 C 修复

**写入 report.md 前的额外检查：**
1. 所有 completionCriteria 条目已有对应证据
2. 所有假设（run/assumptions.md）状态为 VERIFIED 或 INVALIDATED
3. 两项都满足后，才可写入 report.md

没有截图/测试输出就写 report.md = 状态标签与实际进展脱钩。

**验证失败时的强制归因：**

验证失败后，下一轮必须回答：
1. "在实现过程中我跳过了哪些复杂步骤？"（列出 investigation.md 中标记为"不确定"但未验证的项）
2. "如果当初没跳过，当前的失败是否可以避免？"
3. 如果任一答案是"能" → 必须回到阶段 A 补做该步骤后才能继续

---

## 假设债务系统

### 规则

任何在 investigation.md 中标记为"不确定"或在实现过程中用"应该是""大概是""根据记忆""可能"得出的结论，都是**假设债务**。

### 记录格式

`run/assumptions.md`（累积文件，任务结束时必须全部关闭）：

```markdown
## A-001: [假设描述]
- 风险: 高/中/低
- 依据: [为什么做了这个假设]
- 影响: [如果假设错误，什么会失败]
- 状态: OPEN / VERIFIED / INVALIDATED
- 验证方式: [怎么验证]
- 验证证据: [工具调用 ID + 引用内容]（状态为 VERIFIED 时填写）
```

### 约束

- **高风险假设** → 禁止基于它写实现代码，必须先验证
- **中风险假设** → 可以写代码，但验证必须在同一个阶段 D 中执行
- **低风险假设** → 可以写代码，关闭前必须验证
- 任务关闭前所有假设必须为 VERIFIED 或 INVALIDATED（附证据）
- 有 OPEN 的高风险假设却写了实现代码 = 实现建立在未验证的前提上

---

## 捷径暴露规则

在阶段 A（调查）和阶段 B（规划）中，跳过复杂分析步骤而选择简单方案时，必须声明。代码实现阶段的小决策不需要此标注。

### 规则

每次跳过一个调查或规划步骤时：

1. 在正文中输出 `[捷径] 跳过了 [具体跳过了什么]，因为 [为什么]，后果可能是 [如果跳过导致失败会怎样]`
2. 在 `run/assumptions.md` 中新增一条假设记录（状态 OPEN，风险取你认为的风险等级）
3. 继续执行

### 为什么必须声明

声明后，用户知道风险在哪里，可以选择让你回去补做。不声明的跳过点在验证失败时无法追溯——你不知道失败是因为方向错误还是因为某个被跳过的步骤。未声明的跳过点在验证失败时是第一排查对象。

---

## 任务契约锁定

首轮必须锁定以下字段到 `task.json`，后续不得弱化：

- `objective`：用户原始目标（原话保留，不得改写）
- `deliverableTier`：交付梯度（evidence / hook-script / patch / protocol-doc / pure-algorithm）
- `completionCriteria`：可验证完成条件（不含模糊词）
- `disallowedFallbacks`：用户否决的方案路线（只增不减）
- `userRejectedApproaches`：用户否决的具体方法（累积型，不得复活）

`pure-algorithm` 禁止包含：`child_process.exec/spawn`、注册表操作、目标安装路径写入、二进制 patch。

### 契约落盘时序

1. 读取首读文档（`reverse-bootstrap.md`、`case-safety-policy.md`、`reverse-workflow.md`）
2. 收集输入基线：target、objective、requirements、boundaries
3. **运行 `task-start.mjs`**（必须捕获 stdout）。仅当 node 未安装或模块找不到才回退到手动 Write
4. `Read` 验证 `task.json` 存在且合法
5. 填充契约字段 + completionCriteria 反向约束自检 + 需求分解 → 输出 `[约束检查]`
6. **首次搜索前置**：用户给出产品名 → 必须先 WebSearch 再分析
7. 此后进入阶段 A 开始调查

**时序阻断**：步骤 3-5 完成前禁止分析类 MCP 工具调用（ida-pro-mcp/radare2 等）。

### 否决落盘

用户否决方案时，下一条操作**必须** Write/Edit `task.json` 追加 `userRejectedApproaches`。落盘时记录方法族——例如用户否决"IPC handler interception"则记录整个方法族 "hook ipcMain/ipcRenderer 的任何方案"。后续任何命中该方法族的操作都必须声明 `[约束检查]` 后放弃。

---

## 核心原则

- `Observe-first`
- `Evidence-first` — 证据是工具调用产出，不是推理结论
- `Static-before-dynamic`
- `Investigate-before-implement` — 没有调查文件就不写代码
- `Verify-before-declare` — 没有截图/测试就不报告完成
- `Patch-by-minimal-cause`
- `Task-artifact-first`
- `Declare-shortcuts` — 走捷径可以，但必须声明

## 输出格式

### 工具调用间

每两个工具调用之间最多 1 句话（描述即将做什么）。禁止多段结论、进展总结。

### 首条工作回复（初始化完成后）

```
阶段: A-调查 / B-规划 / C-实现 / D-验证
deliverableTier: [从 task.json 读取的完整定义]
产物落点: artifacts/tasks/<task-id>/
成功判定: [要拿到什么证据]
当前阶段出口条件: [阶段 X 的出口产物是什么，是否已存在]
```

### 标注

每轮结束时扫描，命中即输出。标注是输出格式的一部分，不是可选附加。

| 触发条件 | 输出 |
|---------|------|
| 执行了 WebSearch | `[搜索落盘]` + 写 `artifacts/tasks/<task-id>/state/external-research.md` + `state/route-state.json` |
| 确认了加密/签名/密钥/协议/保护方案 | `[突破落盘]` + 写 `artifacts/tasks/<task-id>/state/clues.md` + `state/route-state.json` |
| 分析策略发生根本转向 | `[pivot] 从 A 转向 B，原因: X` |
| 阶段 A/B 跳过了分析步骤 | `[捷径]` 跳过了 X，因为 Y，后果可能是 Z |
| 止损条件触发 | `[retrospective]` + 回答"跳过了什么导致循环" |
| 无法说清目标验证链就写了绕过代码 | `[surface-bypass-block]` + 回到阶段 A |
| 用户表达不满或否决 | `[否决落盘]` + 写 userRejectedApproaches |
| completionCriteria 某条无证据 | `[Goal-lock] 第 N 条未满足，回到阶段 C` |

### WebSearch 是 4 步操作

WebSearch 不是一个工具调用，是一组固定序列。每次 WebSearch 后**必须立即执行** 2-4，中间不得插入其他操作：

1. 调用 WebSearch / search_bing
2. `Write`/`Edit` `artifacts/tasks/<task-id>/state/external-research.md`（query + sources + findings）
3. `Write`/`Edit` `artifacts/tasks/<task-id>/state/route-state.json`（searchRounds / searchDecision）
4. 正文输出 `[搜索落盘] query=..., 结果数=N, 关键发现=...`

## 目标理解锚定

以下任一条件触发时，`Read` `task.json` 的 `objective` 字段，用 1 句话回答："当前操作是否直接服务于 objective 中的核心动词？"如果答案是否，立即停下来重新评估方向：

- 每创建一个新 patch 版本时（v1→v2→v3...）
- 每累计 20 次工具调用时
- 用户表达了不满或质疑时

## 工具链前置检查

打开 IDA 之前，先确认目标主要逻辑在哪一层：

1. 目录扫描检查 Electron/CEF/WebView2/.NET 特征
2. Electron/CEF → JS/V8 是主逻辑，IDA 不是主工具
3. .NET → dnSpy/ILSpy 是主工具
4. 纯 native → 才用 IDA

### Electron 内联工作流

```
第零步 - 备份: copy app.asar → artifacts/tasks/<task-id>/run/app.asar.clean.bak + SHA256 记入 artifacts/tasks/<task-id>/run/backup-manifest.md
第一步 - 解包: asar extract app.asar artifacts/tasks/<task-id>/run/app_extracted
第二步 - 入口: 读 package.json main 字段 → 判断 .js / .jsc / 无扩展名
第三步 - 策略:
  明文 JS → 直接阅读搜索
  V8 字节码(.jsc) → **先用 `--inspect-brk` 或 Frida trace 理解执行流程和验证链**，确认每一步验证逻辑后再决定干预方式。禁止在理解验证链之前写任何 hook/patch 代码。"hook 了 publicDecrypt"不等于"理解了验证链"。

  "理解了验证链"的最低标准：至少执行过一次 `--inspect-brk` 调试会话或 Frida trace，并在 artifacts/tasks/<task-id>/run/investigation.md 中记录了以下信息：
  - 断点命中位置 + 当时调用栈
  - 验证链中每个关键函数的输入/输出
  - 验证失败时的代码路径（不是猜测，是实际观察到的）

  仅靠 JSC 字符串搜索（grep "license"、"publicDecrypt" 等关键词）不满足分析充分性标准——字符串能证明"这些概念存在于代码中"，但不能证明"它们以什么顺序、什么条件被调用"。
第四步 - IPC 桥接: 搜索 ipcMain.handle / ipcMain.on / ipcRenderer.invoke
第五步 - 不对宿主 EXE 做深度 IDA（除非分析 .node 模块 / fuses / 框架层修改）
```

完整策略见 `references/electron-playbook.md`。

## 连续推进策略

- 阶段完成 → 继续下一阶段，不停下
- `execution.status=ready-to-continue` → 必须继续执行 `nextExecutableAction`
- 切入点无效 → 记录失败到 route-state.json，换下一个
- 全部切入点无效 → retrospective 后生成新切入点
- 策略转向必须输出 `[pivot]`；转向导致交付梯度降级 → 等用户确认

## 止损与反思

### 触发条件（任一命中即触发反思）

| 条件 | 信号类型 |
|------|---------|
| 同一文件被 Write/Edit 累计超过 3 次，或已创建超过 3 个版本 | 版本膨胀 |
| 同一类操作循环 2 次（修改→验证→失败→修改→验证→失败） | 循环试错 |
| 同一方法连续 2 次失败 | 方向错误 |
| 同一方法族（所有 hook 变体 / 所有注册表修改变体 / 所有搜索查询变体）累计 3 次失败 | 方法族耗尽 |
| 任何绕过手段产生了副作用但未解决核心问题 | 表面绕过 |
| 无法用一句话说清"目标程序验证链是 A→B→C→D，我修改的是 C" | 根源不明 |
| 用户明确指出方向不对 | 外部否定 |

### 反思序列（所有触发条件通用）

1. 输出 `[retrospective]` + 根因分析
2. 回答："我跳过了什么复杂步骤导致了这个循环/失败？"
3. 写入 route-state.json 的 approachHistory：`{"method":"描述","result":"FAILED","evidence":"失败证据","skippedSteps":"跳过的复杂步骤"}`
4. 选择**完全不同**的方法（不是简单变体），或向用户请求方向

### 硬止损

| 条件 | 动作 |
|------|------|
| 同一方法连续 3 次失败 | EXHAUSTED，必须转向 |
| 累计 2 次 retrospective 无进展 | 向用户请求方向 |
| 验证失败 + 存在未验证的高风险假设 | 回到阶段 A 验证假设 |
| 根源不明触发时 | `[surface-bypass-block]` + 回到阶段 A 追溯完整验证链，记入 investigation.md |

转向前追加 `approachHistory`。新方法在历史中 FAILED → 跳过。

### 搜索门禁

分析过程中出现以下信号，必须暂停当前路径执行 WebSearch：
- 发现新保护特征但未搜索过该类型
- protectionTier >= T3 且未搜索过
- 连续 2 轮工具调用无进展

搜索后执行 WebSearch 4 步操作。

## 上下文管理

- 同一切入点失败产物超 3 份 → 摘要到 `artifacts/tasks/<task-id>/state/progress.md`
- 新脚本替代旧脚本 → 同一轮内删除旧文件
- 修改目标文件前必须备份到 `artifacts/tasks/<task-id>/run/<文件名>.clean.bak` + SHA256 记入 `artifacts/tasks/<task-id>/run/backup-manifest.md`

## 语言与交付

所有正文输出、report.md、run/*.md 必须中文（代码块、路径、技术标识符除外）。

```
<PROJECT_DIR>/artifacts/tasks/<task-id>/   ← 所有产物根目录（不是项目cwd根目录）
├── report.md
├── task.json
├── state/
│   ├── route-state.json
│   ├── clues.md
│   ├── external-research.md
│   └── progress.md
└── run/                                  ← 本文所有 run/xxx 路径均指此目录
    ├── investigation.md    ← 阶段 A 出口产物
    ├── plan.md             ← 阶段 B 出口产物
    ├── assumptions.md      ← 假设债务（累积）
    └── ...
```

必须交付（完整路径）：
- `artifacts/tasks/<task-id>/report.md`
- `artifacts/tasks/<task-id>/task.json`
- `artifacts/tasks/<task-id>/run/investigation.md`
- `artifacts/tasks/<task-id>/run/plan.md`
- `artifacts/tasks/<task-id>/run/assumptions.md`
- `artifacts/tasks/<task-id>/run/fixtures.json`
- `artifacts/tasks/<task-id>/run/verify-once.mjs`

按任务类型追加（匹配规则：命中 Web 套壳 → web-shell-notes + electron-bridge-map；命中保护 → anti-analysis-notes；命中配置/许可证 → config-recovery-notes；命中算法 → sign-algorithm + protocol-schema）

### report.md 真实性

- 记录实际尝试的策略列表（含失败的），每个策略一行（名称 + 结果 + 原因）
- 验证结果必须是可复现证据（命令输出、截图路径、日志条目），禁止"已验证""测试通过"

## 何时必须触发

逆向 PE/EXE/DLL/SYS/.NET/Mixed-Mode、处理壳/反调试/抗分析、处理 Electron/CEF/WebView2、处理驱动/IOCTL/Frida、处理 TLS/网络/SSL Pinning、处理 Loader/注入、处理 IPC/持久化、处理配置/许可证恢复、处理 Windows CTF、处理游戏逆向、处理恶意软件分析、处理协议/签名还原、延续既有任务。

不属于本技能：普通 Windows 开发、未授权漏洞利用、Android 逆向。

## 专项参考

需要时按专题补读 `references/` 目录：
- PE 静态分诊 → static-triage-playbook.md
- Web 套壳 → web-shell-triage.md + electron-playbook.md
- 壳/脱壳 → packers.md
- 反分析 → anti-obf.md + protection-bypass.md
- .NET → dotnet.md
- 注入 → loader-injection.md
- TLS/网络 → tls-network-playbook.md
- 驱动 → driver.md
- 静态分析（优先） → static-analysis.md
- Frida（仅在静态分析不足时） → frida.md
- 混合模式 → mixed-mode-interop-playbook.md
- IPC/持久化 → ipc-persistence-playbook.md
- 异常/运行时 → exception-runtime-playbook.md
- 内存取证 → memory-forensics.md
- CTF → ctf.md
- 游戏逆向 → game-reverse.md
- 恶意软件 → malware-analysis.md
- 协议/签名 → app-protocol.md

防护定级 T0-T6 见 `references/` 对应专题文件。架构/WOW64/Mixed-Mode/IPC/Exception/Memory 专项要求同见对应 reference。

## 首读顺序

1. `docs/reference/reverse-bootstrap.md`
2. `docs/reference/case-safety-policy.md`
3. `docs/reference/reverse-workflow.md`
4. 纯提取任务补读 `docs/reference/pure-extraction.md`

快速分诊：单一问题、一轮静态可答、不涉及动态执行时可直接回复。命中 Electron/CEF 目标、需 asar 解包、多阶段任务、涉及算法还原时必须走完整流程。

## 历史失败案例

### 案例 2026-05-26：Typora 激活 — 跳过验证谎报完成

AI 写了 patcher 脚本，脚本跑完无报错，**未截图验证**就将状态推进为"等待用户验证"。
用户被迫多次要求截图，截图显示激活对话框仍然弹出——激活完全失败。
AI 在调查阶段跳过了：JSC 字节码分析、ASAR 闪退根因、指纹差异调查、deviceId 来源验证。
每一个跳过都选择了一个简单替代方案（假设/随机值/凭记忆），然后当作已完成的进展来报告。

**教训**：
- "脚本无报错" ≠ "任务完成"，这两件事没有等价关系
- 每个跳过的复杂步骤都是潜在的失败原因
- 声明后跳过 = 风险可见，用户可选择补做；不声明就跳过 = 失败时无法追溯根因
- 门禁规则写清楚了 ≠ 门禁规则会被执行，规则必须变成流程结构的一部分
