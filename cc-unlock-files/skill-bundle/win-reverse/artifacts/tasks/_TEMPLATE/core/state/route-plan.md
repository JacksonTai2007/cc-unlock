<!-- generated: route-plan; source=state/route-state.json; do-not-edit-directly -->

# Route Plan

Generated At: 2026-03-25T13:26:40.567Z
Task Summary: replace-me
Final Deliverable: report.md + run/*

## Current Status

- Active Tracks: A
- Active Entrypoints: EP-001
- Sync Status: restored-from-route-state

## Track Definitions

### A

- Target: 原生入口 / PE 头 / 节区 / 导入 / 资源分诊
- Inputs: 目标 EXE/DLL/SYS、基础文件信息、导入面、资源面
- Output: 先判断是否继续进入 static-triage / dotnet / driver / packer-unpack
- Priority: high
- Checkpoints: PE 头, 入口点, 导入面, 资源面

### B

- Target: 保护 / 装载 / 异常 / 运行时控制链分诊
- Inputs: 壳迹象、异常链、线程/模块加载、反分析信号
- Output: 先判断是否继续进入 anti-analysis / loader-injection / exception-runtime / memory-forensics
- Priority: high
- Checkpoints: 壳迹象, 异常门, 装载链, 运行时保护

### C

- Target: Web 套壳 / WebView / 前端技术路线指纹
- Inputs: 安装目录、资源目录、JS/HTML 包、PE 依赖、运行时字符串
- Output: 快速确定 wrapper/runtime、前端框架、bundler，并给出后续入口线索
- Priority: high
- Checkpoints: wrapper/runtime, 前端框架, bundler, 入口资源

## Entrypoint Loop

- Principle: topics provide capabilities; entrypoints decide what to probe first.
- Parallel Limit: keep at most 1 to 2 active entrypoints.
- Pivot Rule: if a probe is ineffective, park or exhaust it, then switch or retrospective.

#### EP-001 先做最小成本分诊

- Hypothesis: 先用一个最便宜的观察性探针判断当前主阻塞更像 PE 分诊、壳、反分析、.NET、驱动、网络链路，还是 Web 套壳 / WebView 技术路线问题。
- Bound Topics: 
- Target Track: A
- Rationale: 复合场景先做中性分诊，避免一开始就把某个 topic 误当成唯一主线。
- Cost: low
- Expected Gain: high
- Probe: 做一次最小观测：PE/导入分诊、字符串/导入表交叉引用分析、内存保护变化观察、安装目录 Web 套壳技术指纹扫描 四选一，先确认下一刀切在哪条链路。
- Success Criteria: 能明确缩窄主阻塞点，或激活下一条更高价值的切入点。
- Failure Criteria: 没有带来新的可执行分歧，且不能支持下一步判断。
- Status: CANDIDATE
- Result Summary: 
- Next On Success: 扩展该切入点并绑定更具体的 topic。
- Next On Failure: 切到下一个候选切入点。
- Updated At: 

#### EP-002 判定是否为 Web 套壳 / WebView 应用

- Hypothesis: 若安装目录携带大量 JS/HTML/asar/pak/前端资源，目标可能是 Electron / CEF / WebView2 / Tauri / Wails / NW.js 等套壳应用，先判定技术路线可显著缩短后续定位路径。
- Bound Topics: web-shell-triage
- Target Track: C
- Rationale: 很多 Windows EXE 本质是 Web 应用套壳；先做 wrapper/runtime 指纹识别，比直接深挖 IDA 更快收敛到主资源、桥接层和 API 入口。
- Cost: low
- Expected Gain: high
- Probe: 扫描安装目录、资源目录、PE 依赖和二进制字符串：优先识别 Electron / CEF / WebView2 / Tauri / Wails / NW.js / Qt WebEngine / Neutralino / Flutter Web 资产，并记录前端框架与 bundler 线索。
- Success Criteria: 至少得到一个高置信 wrapper/runtime 候选，或定位到 package.json / app.asar / index.html / preload.js / WebView2Loader.dll / libcef.dll 等关键入口。
- Failure Criteria: 目录与二进制都未提供可信 Web 套壳证据，且不能缩窄到任何 wrapper/runtime 候选。
- Status: CANDIDATE
- Result Summary: 
- Next On Success: 转入对应入口：asar/package.json/HTML/bridge API/网络 client/配置文件。
- Next On Failure: 回到原生 PE/导入面和运行时装载链继续分诊。
- Updated At: 

## Coordination Rules

- Update clues.md whenever a high-value clue or decisive evidence appears.
- Use route-state.json as the machine source of truth; markdown is a rendered view.
- Composite tasks should rank candidate entrypoints by cost and expected gain before expanding topics.
