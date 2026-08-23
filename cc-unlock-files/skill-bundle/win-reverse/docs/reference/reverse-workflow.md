<!-- publish: framework -->
# Reverse Workflow

这是 `win-reverse` 的执行协议，不是人类教程。

## 阶段总览

0. `RouteSync`
1. `Observe`
2. `Capture`
3. `Rebuild`
4. `Patch`
5. `PureExtraction`
6. `Port`
7. `Close`

## 与 SKILL.md 阶段门控的映射

本文档的阶段是**任务级流程**（做什么），SKILL.md 的 A/B/C/D 是**质量门控**（怎么做才不能糊弄）。每个任务阶段对应的门控要求：

| 任务阶段 | 对应门控 | 出口要求 |
|---------|---------|---------|
| RouteSync / Observe / Capture | 阶段 A（调查） | `run/investigation.md` 存在且分析量达标 |
| Rebuild | 阶段 B（规划）→ 阶段 C（实现） | `run/plan.md` + 备份完成 |
| Patch / PureExtraction / Port | 阶段 C（实现） | 每步引用 plan.md，假设记入 assumptions.md |
| Close | 阶段 D（验证） | 截图/测试证据覆盖全部 completionCriteria |

任务阶段之间可以自由流转；门控阶段的入口/出口条件是**强制**的——没有出口产物就不能进入下一个门控阶段。

## 平台化解释

- `Observe`: 以 PE triage、导入面、壳迹象、运行时类型和风险面为中心做任务分诊
- 若安装目录 / 样本目录出现大量前端资源，还应并行做 `Web 套壳 / WebView 技术路线指纹`
- `Capture`: 用静态分析（反编译、xref、签名识别、字符串交叉引用）建立函数、模块、网络或驱动证据链；仅在静态分析不足以理解运行时行为时，才补充 x64dbg / WinDbg / Frida 动态观测
- `Rebuild`: 把关键路径重建为最小 dump、solver 或复现实验；仅在静态重建不可行时，才考虑 hook 作为辅助手段
- `Patch`: 按最小原因修补壳、反调试、环境校验、网络或装载阻塞
- `PureExtraction`: 把壳/运行时噪音和纯算法/纯逻辑边界分开
- `Port`: 把稳定逻辑移植到脚本、求解器或外部宿主并完成一次验收

## Entrypoint Loop

- 先列 2 到 5 个候选 `entrypoints`
- 按成本、信息增益、复用价值排序
- 同时只激活 1 到 2 个切入点
- `execution.status=ready-to-continue` 时不等待用户下一条消息
- 对疑似套壳 EXE，优先回答“它是什么 wrapper/runtime、主资源在哪里、bridge 在哪里”，再决定是否深挖宿主 EXE
- 若 `run/web-shell-tech.json` 已存在，`task-sync / task-advance` 应优先利用其结果驱动 `EP-002` 与后续下一步建议
- 若 `task-input.target.binaryPath` 等字段指向本地可访问路径，`task-sync` 可以先自动做一次轻量技术指纹扫描，再决定是否自动激活 `web-shell-triage`
- 命中 `Electron / WebView2 / CEF / Tauri / Wails` 等 runtime 后，应继续自动分流到更细 topic，而不是只停在“已识别套壳”
- `interactiveUnlockRequired` 只是环境标签，不自动等于 `blocked-on-user`
- 只有当前下一步确实依赖用户动作时，才允许 `pauseCategory=user`
- 若只是提示用户“请用 IDA 打开样本/补载文件”，但本轮仍有其他可推进动作，提示后继续推进，不以等待收尾
