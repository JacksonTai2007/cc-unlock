<!-- publish: framework -->
# Output Contract

- `report.md` 文件名保持不变，但正文和阶段结论必须使用中文
- 正式输出至少包含：当前阶段、自动续跑决策、目标边界、防护等级、架构边界、当前活跃路线、本轮切入点、关键证据、主要结论、验收结果、`UNKNOWNS`、task artifact 路径、命中的经验卡 ID、是否实际采纳、采纳后影响了哪条路线
- 默认最少交付：`artifacts/tasks/<task-id>/report.md`、`run/fixtures.json`、`state/route-state.json`

如果包含 static-triage，还必须补充：

- PE 头、节区、入口点、导入与资源结论
- `run/static-triage-notes.md`
- `run/import-surface.md`

如果包含 packer / unpack，还必须补充：

- OEP、dump、IAT 状态
- `run/unpack-notes.md`
- `run/iat-rebuild-notes.md`

如果包含 anti-analysis，还必须补充：

- 反调试 / 反虚拟机 / 完整性 等检测面
- 检测面与触发时机
- `run/anti-analysis-notes.md`
- 以下二选一：`run/anti-analysis-hook.js`（动态拦截脚本）或 `run/anti-analysis-bypass-report.md`（静态分析报告，含函数地址 + 算法描述 + 触发条件）

如果包含 `.NET / CLR`，还必须补充：

- 混淆器或运行时类型
- `run/dotnet-notes.md`
- `run/il-patch-notes.md`

如果包含 Driver，还必须补充：

- `DriverEntry / dispatch / IOCTL` 结论
- `run/driver-dispatch-map.md`
- `run/kernel-ioctl-map.md`

如果包含 Network / TLS，还必须补充：

- 网络栈、TLS 边界、截获点
- `run/tls-network-notes.md`
- 以下二选一：`run/tls-hook-template.js`（动态拦截脚本）或 `run/tls-protocol-report.md`（协议分析报告，含握手流程 + 加密套件 + 证书校验）
- 若要求本地协议验收，补 `run/protocol-replay-example.js`

如果包含 Frida Hook，还必须补充：

- Frida 附加模式、Hook 目标与事件格式
- `run/frida-hook-template.js`
- `run/hook-events.jsonl`

如果包含 UI Runtime，还必须补充：

- WndProc / DialogProc / 消息流结论
- `run/ui-runtime-notes.md`
- `run/message-flow.md`

如果包含 `web-shell-triage`，还必须补充：

- `web-shell-triage` 结论：wrapper/runtime、前端框架、bundler、bridge 结论
- `run/web-shell-tech.json`
- `run/web-shell-notes.md`
- `run/web-shell-next-steps.md`

如果包含 Loader / Injection，还必须补充：

- 宿主进程、注入技术、入口切换与远端映像结论
- 明确 `CreateRemoteThread / NtCreateThreadEx / APC / manual map / hollowing` 中命中的真实路径
- `run/loader-injection-notes.md`
- `run/remote-map.md`
- 以下二选一：`run/loader-hook-template.js`（动态拦截脚本）或 `run/loader-technique-report.md`（注入技术分析报告，含调用链 + 内存布局）

如果包含 Config / Recovery，还必须补充：

- 配置载体、解码链、字段语义与验证结论
- `run/config-recovery-notes.md`
- `run/config-schema.md`
- `run/blob-decode-notes.md`

如果包含 Mixed-Mode / Interop，还必须补充：

- `C++/CLI / P/Invoke / COM interop / CLR hosting` 中命中的桥接路径
- 托管/非托管边界、桥接方向与证据锚点
- `run/mixed-mode-notes.md`
- `run/bridge-map.md`
- 以下二选一：`run/interop-hook-template.js`（动态拦截脚本）或 `run/interop-bridge-report.md`（桥接分析报告，含数据封送 + 调用链）

如果包含 IPC / Persistence，还必须补充：

- `ServiceMain / schtasks / WMI / NamedPipe / RPC / ALPC / COM` 中命中的控制面链路
- 启动条件、权限要求与真正使用点
- `run/ipc-persistence-notes.md`
- `run/ipc-surface.md`
- `run/persistence-map.md`

如果包含 Exception / Runtime，还必须补充：

- `TLS callback / SEH / VEH / CRT startup / CFG / CET` 结论
- 启动链、异常链与安全断点/Hook 点位
- `run/exception-runtime-notes.md`
- `run/startup-chain.md`

如果包含 Memory / Forensics，还必须补充：

- `VAD / minidump / module remap / manual-map residue` 结论
- dump 粒度、重建目标与验证方式
- `run/memory-layout.md`
- `run/dump-plan.md`

如果包含 Protection Bypass，还必须补充：

- 反篡改 / 文件保护 检测面枚举（每个检测点的分类与触发时机）
- 绕过方案与稳定性验证结果
- `run/protection-bypass-notes.md`
- 以下三选一：`run/protection-bypass-hook.js`（动态拦截脚本）、`run/protection-bypass-patch.py`（二进制补丁脚本）或 `run/protection-bypass-report.md`（静态分析报告，含校验算法 + 触发条件 + 旁路方案）
