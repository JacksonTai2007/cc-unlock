# 最小使用手册

## 1. 适用场景

当你要处理以下任务时，直接使用 `win-reverse`：

- PE / EXE / DLL / SYS / .NET / Mixed-Mode 样本逆向
- PE 分诊、壳、OEP、dump、IAT 重建
- 反调试、反虚拟机、反篡改、SEH/VEH/TLS callback 异常链分析
- Frida 动态取证、WinAPI/TLS/加密参数抓取
- Loader / 注入 / Manual Map / Hollowing / Reflective DLL
- 服务 / 计划任务 / WMI / COM / NamedPipe / RPC / ALPC 控制面分析
- Minidump / VAD / 内存布局 / 远端映像重建
- 资源 blob、注册表 / 服务配置、许可证字段恢复
- 继续已有 task-local 并恢复上下文

## 2. 第一次怎么开始

### 新任务

<!-- BEGIN GENERATED: bootstrap-new-task -->
1. 阅读 `SKILL.md`
2. 阅读 `docs/reference/reverse-bootstrap.md`
3. 若当前 workspace 没有 history data files，执行 `node tools/task/task-start.mjs <task-id>`
4. 如果已知 topic 或交付约束，可一并传 `--topic=`、`--topics=`、`--local-repro`、`--protocol-replay`、`--task-input=...`
5. `task-start` 在无历史文件时转发到 `task-init`；若 workspace 已有 history data files，则默认阻止新建第二个 task-local，除非显式传 `--force-new-task`
6. 在进入 `task-sync` 前补齐最小输入：`target / objective / requirements / boundaries`，并尽量同时确定 `runtime.architecture / runtime.wow64 / runtime.managed / protectionTier`
7. 执行 `node tools/task/task-sync.mjs <task-id>`
8. 执行 `node tools/task/task-advance.mjs <task-id>`
9. 若 `execution.status=ready-to-continue`，直接执行 `nextExecutableAction`，不要停在状态汇报
<!-- END GENERATED: bootstrap-new-task -->

### 继续已有任务

<!-- BEGIN GENERATED: bootstrap-resume-task -->
1. 先读 `task.json` 与 `state/route-state.json`
2. 再把 `state/route-plan.md`、`state/clues.md`、`state/progress.md` 作为派生视图补充查看
3. 执行 `node tools/task/task-sync.mjs <task-id>`
4. 执行 `node tools/task/task-advance.mjs <task-id>`
5. 若 `execution.status=ready-to-continue`，必须继续执行 `nextExecutableAction`，不要停在“已恢复”
6. 只有 `pauseCategory=user/risk`、缺样本或 closeout 已完成时，才允许暂停等待用户
<!-- END GENERATED: bootstrap-resume-task -->

### 无真实样本的 drill

<!-- BEGIN GENERATED: bootstrap-drill-task -->
1. 运行 `npm run task:drill -- --list`
2. 选择 drill 后执行 `npm run task:drill -- <scenario-id> <task-id>`
3. 再按 `task.json -> route-state.json -> task-sync -> task-advance` 的标准闭环继续推进
<!-- END GENERATED: bootstrap-drill-task -->

额外提醒：

- 从 `Observe` 阶段开始，不要跳过静态分诊、入口确认、架构边界和基础证据收集
- 如果安装目录下带大量 `js/html/css/json/map/asar/pak`，把 `Web 套壳 / WebView 技术路线指纹` 作为 Observe 并行线路
- 若已生成 `run/web-shell-tech.json`，后续 `task-sync / task-advance` 会自动回填 `web-shell-triage` 字段并改写下一步建议
- 若 `targetBinaryPath / inputTarget / samplePaths` 指向本地可访问目标，`task-sync` 还会尝试自动扫描并自动推断 `web-shell-triage`
- 命中具体 runtime 后，系统会自动分流到更细 topic，例如 `config-recovery / ui-runtime / tls-network / static-triage / mixed-mode-interop`
- `task-input` 现在默认按 schema 强校验

补充约定：
- `task-start` / `task-init` / `task-sync` / `task-advance` / `task-close` 默认都以**当前用户 workspace** 作为根目录，任务数据写入该目录下的 `artifacts/tasks/<task-id>/`
- 若当前 cwd 落在 skill 安装目录或 skill 仓库目录内，必须先把 `WIN_REVERSE_WORKSPACE_ROOT` 指到真实任务目录；未显式允许时，禁止把运行中 task-local 直接写到 skill 目录
- 可通过 `WIN_REVERSE_WORKSPACE_ROOT`、`WIN_REVERSE_SKILL_ROOT` 覆盖 workspace / skill 根目录
- `task-close` 会把清理后的 task 快照归档到系统已安装 SKILL 目录 `~/.codex/skills/<skill-name>/artifacts/tasks/<task-id>/`；若未安装该 SKILL，才回退到当前项目
- 若 workspace 根目录已有 `run/verify-once.mjs`、`run/run-local.mjs`、`run/local-repro-example.js`、`run/protocol-replay-example.js`，且 task-local 中对应文件仍是模板占位，`task-sync` / `task-close` 会自动桥接代理脚本到 task-local
- 核心 task template 已改成 Windows 运行时语义：`runtime`、`debugSession`、`accessRequirements`、`targetBinaryPath/targetProcessNames/targetNetworkIndicators`

暂停语义补充：
- `interactiveUnlockRequired` 是环境元数据，不会自动把任务判成 `blocked-on-user`
- 只有当前下一步确实依赖用户动作时，才应显式写入 `pauseCategory=user`
- 单纯提醒用户“请用 IDA 打开样本”并不天然构成暂停；若还有别的可推进动作，提醒后继续推进

## 3. 每次工作至少要做什么

- 明确当前阶段：`Observe / Capture / Rebuild / Patch / PureExtraction / Port`
- 明确本轮产物落点：`artifacts/tasks/<task-id>/`
- 在 `Observe` 就裁定 `architecture / wow64 / managed / kernelMode / protectionTier`
- 疑似 Web 套壳时，优先确定 `wrapper/runtime / frontend / bundler / bridge`
- 把关键证据写入 artifact，而不是只留在对话里
- 更新 `report.md`
- 每一阶段结束都要先刷新 `route-state.json` 及其 Markdown 视图，再自动推进下一阶段
- 每一轮结束都要刷新 `execution.status / nextExecutableAction`；只有 `pauseCategory=user/risk` 时才允许等待用户
- 续跑任务恢复完成后直接回到活跃阶段执行，不以“等待继续”收尾

## 4. 动态环境怎么使用

- 默认优先单样本、单会话、单证据链推进
- 若需要动态附加，先写清权限、架构、会话方式和工具
- hook、trace、dump、验证尽量在同一复现实例中完成
- 若必须更换宿主、重启目标或切换到内核态调试，要在报告中说明原因
- 涉及 `WOW64 / Mixed-Mode / Service / RPC / ALPC / VAD dump` 时，先写清真实边界再下断点或做 patch

## 5. 任务结束前要检查什么

- `report.md` 是否已更新
- `run/verify-once.mjs --validate-only` 是否可通过
- 关键脚本、样本、说明是否已落盘
- 如命中经验卡，是否记录采纳与否
- 如命中专题特定 task pack，是否补齐其专项 artifact

## 6. 最常用命令

```bash
npm run task:start -- <task-id>
npm run task:start -- <task-id> --topics=static-triage,packer-unpack,tls-network --local-repro
npm run task:start -- <task-id> --topic=web-shell-triage
npm run task:start -- <task-id> --topics=loader-injection,ipc-persistence,memory-forensics --protocol-replay
npm run task:web-shell-tech -- "C:\\Program Files\\TargetApp"
npm run task:drill -- --list
npm run task:drill -- packed-dotnet-loader lab-packed-loader
npm run task:init -- <task-id> --topic=driver
npm run task:advance -- <task-id> --json
node tools/task/task-start.mjs <task-id>
node tools/task/task-drill.mjs <scenario-id> <task-id>
node tools/task/task-init.mjs <task-id> [--force-new-task]
node tools/task/task-sync.mjs <task-id>
node tools/task/task-advance.mjs <task-id>
node tools/task/detect-web-shell-tech.mjs <install-dir> --output artifacts/tasks/<task-id>/run/web-shell-tech.json
node tools/task/task-close.mjs <task-id>
npm run check
```

## 7. Startup Gate

- History data files 指 `task.json`、`state/route-state.json`、`report.md`、`run/fixtures.json`
- 无 history data files：走第 2 节“新任务”
- 已有 history data files：走第 2 节“继续已有任务”
- 默认阻止在同一 workspace 新建第二个 task-local；只有显式 `--force-new-task` 才允许
