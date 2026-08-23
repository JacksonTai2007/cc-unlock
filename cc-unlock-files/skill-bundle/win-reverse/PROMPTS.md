# Windows Reverse Prompts

默认进入流程：

<!-- BEGIN GENERATED: default-flow -->
1. 先读 `reverse-bootstrap / reverse-workflow / case-safety`
2. 新任务走 `task-start -> task-sync -> task-advance`；续跑任务走 `task.json -> route-state.json -> task-sync -> task-advance`
3. `task-input` 按 schema 强校验；先补齐 `target / objective / requirements / boundaries`，并先裁定 `architecture / wow64 / managed / protectionTier`
4. 先列 `entrypoints`，再做最小 probe
5. 命中 `mixed-mode / ipc / exception / memory` 时先补读对应 playbook
6. 每轮先落盘；若 `execution.status=ready-to-continue`，继续执行 `nextExecutableAction`
<!-- END GENERATED: default-flow -->

## 提示词使用原则

- 先说明目标、样本路径、授权边界、希望拿到的证据或交付物
- 尽量补齐：`architecture / wow64 / managed / kernelMode / focusSignals / access requirements`
- 需要续跑时，直接给出 `task-id` 或 `artifacts/tasks/<task-id>/`
- 没有真实样本但要模拟真实推进时，明确要求走 `task:drill`
- 涉及高风险动作时，优先要求“先观察、先取证、最小改动、先落盘再推进” 

## 场景化提示词示例

### 1. 新建一个标准逆向任务

```text
请按 win-reverse 标准流程启动一个新任务，先读取 bootstrap / workflow / safety 文档，再执行 task-start -> task-sync -> task-advance。

目标：分析一个已授权的 Windows x64 EXE。
样本路径：E:\samples\demo.exe
目标诉求：确认真实入口、主要模块关系、是否存在壳或反调试。
要求：先做静态分诊，列出 2~5 个 entrypoints，给出 protectionTier，并把本轮证据落到 artifacts/tasks/<task-id>/。
边界：不做漏洞利用，不做超出授权范围的持久化或破坏性操作。
```

### 2. 带专题提示的新任务

```text
请创建一个新的 win-reverse task，主题命中 static-triage、packer-unpack、anti-analysis。

目标：分析已授权样本 E:\samples\packed_loader.exe
目标诉求：恢复 OEP、判断导入隐藏方式、识别反调试点。
要求：先完成架构识别、protectionTier 定级、entrypoint 排序，再推进最小 probe；输出 run/static-triage-notes.md、run/unpack-notes.md、run/anti-analysis-notes.md。
边界：仅做取证式重建，不做未授权利用。
```

### 3. 续跑已有任务

```text
请按 win-reverse 续跑流程恢复任务：artifacts/tasks/task-20260409-loader/
先读 task.json、state/route-state.json、route-plan、clues、progress，随后执行 task-sync -> task-advance。
如果 execution.status=ready-to-continue，不要只汇报状态，直接继续执行 nextExecutableAction。
本轮目标：把任务从 Observe 推进到 Capture，并补齐缺失证据与 report.md。
```

### 4. 无真实样本，生成实战演练

```text
我现在没有真实样本，但想模拟一个高级 Windows 逆向实战流程。
请先列出可用 drill 场景，再帮我选择一个同时覆盖 loader-injection、ipc-persistence、memory-forensics 的演练任务，随后按标准 task-local 流程推进。
要求：解释为什么选择该 drill，并把阶段推进、关键证据和交付物同步落盘。
```

### 5. .NET / Mixed-Mode / COM 互操作分析

```text
请用 win-reverse 分析一个已授权的混合托管样本。
样本：E:\samples\bridge_host.dll
已知信号：怀疑存在 C++/CLI、P/Invoke、COM interop、CLR hosting。
要求：先确认 managed / native 边界、加载顺序与 wow64 状态，至少建立一条 managed -> native 或 native -> managed 桥接链；输出 mixed-mode-notes、bridge-map，并说明桥接承载方式。
```

### 6. Loader / Injection / Hollowing 路线恢复

```text
请分析一个已授权的注入链样本，重点看 CreateRemoteThread / APC / Manual Map / Hollowing。
要求：
1. 先确认入口是在原进程、桥接进程还是远端进程中触发
2. 给出最小观测方案，不要直接假设某个注入 API 就是完整链路
3. 输出 loader-injection-notes、remote-map、必要的 hook 模板
4. 若切入点失效，要把失败证据和下一跳 entrypoint 写回 route-state
```

### 7. IPC / 持久化控制面梳理

```text
请分析一个已授权样本的 Service / Scheduled Task / WMI / NamedPipe / RPC / ALPC 控制面。
目标：恢复 launcher -> registrar -> writer -> reader -> use 链路，并记录权限、会话、启动时机与副作用。
要求：优先命中 ipc-persistence 专题，输出 ipc-persistence-notes、ipc-surface、persistence-map。
```

### 8. Exception / Startup Chain 场景

```text
请按 exception-runtime 规则分析这个样本。
已知现象：在 WinMain 断点前就触发异常，怀疑有 TLS callback / SEH / VEH / CRT 启动链干预。
要求：先枚举 TLS callback -> entrypoint -> CRT -> SEH/VEH 启动链，区分反调试门和正常业务控制流，记录安全断点点位与不可破坏的操作。
```

### 9. Memory Forensics / Dump 重建

```text
请按 memory-forensics 路线分析一个已授权的进程转储。
输入：E:\dumps\target.dmp
目标：判断是否存在 hollowing 或 manual-map 残留，并决定 dump 粒度与重建目标。
要求：先建立最小 VAD / module / region 地图，再给出 dump-plan 与 memory-layout；不要把“已经拿到 dump”直接当成任务完成。
```

### 10. TLS / 网络 / Frida 取证

```text
请分析该已授权样本的网络与加密链路。
关注点：WinHTTP / WinINet / Schannel / OpenSSL / BCrypt / CryptoAPI。
要求：优先恢复明文前后位置、关键 API 调用链、证书或配置来源；必要时生成 Frida hook 模板与 hook-events 记录方案。
```

### 11. 配置恢复 / 许可证字段提取

```text
请分析这个已授权程序的配置与许可证逻辑。
我关心：资源 blob、注册表配置、服务配置、许可证字段、解密入口。
要求：先做 config-recovery 路线，输出 config-recovery-notes、config-schema、blob-decode-notes，并区分“已确认字段”与“推测字段”。
```

### 12. UI Runtime / 消息流分析

```text
请分析一个已授权 GUI 程序的 UI runtime。
目标：恢复 WndProc / DialogProc / subclass / custom control 的消息流，确认关键按钮、输入框、校验逻辑和触发链。
要求：输出 ui-runtime-notes、message-flow；如果是自绘或多窗口跳转，优先建立窗口关系图。
```

### 13. Web 套壳程序快速分流

```text
请先判断这个 Windows 安装目录是否属于 Electron / CEF / WebView2 / Tauri / Wails / NW.js 等 Web 套壳程序。
路径：E:\apps\target\
要求：优先执行 web-shell-triage 思路，识别壳类型、前端资源位置、原生桥接点和后续建议切入点。
```

### 14. Crackme / Keygen / Solver 题目

```text
请按 win-reverse 的 CTF 路线分析这个 crackme。
目标：恢复校验逻辑、关键约束与可能的 solver 思路。
要求：保持证据链，不要直接跳到结论；如果要构造 z3 / angr 方案，先把约束提取过程写清楚并落盘。
```

## 可复用补充短句

### 强调自动推进

```text
如果 task-advance 给出 ready-to-continue，请继续执行 nextExecutableAction，不要停在状态汇报。
```

### 强调先定级再动手

```text
先做 protectionTier、架构边界、启动链和真实触发面裁定，再选择工具链；不要过早把局部函数语义升级为高置信结论。
```

### 强调落盘

```text
每轮先把 route-state、route-plan、clues、progress、report 更新到 task-local，再进入下一阶段。
```

### 强调最小改动

```text
优先观察、取证和最小 patch；只有在必要时才做最小原因修补，并明确修补目的、影响范围和验证方式。
```
