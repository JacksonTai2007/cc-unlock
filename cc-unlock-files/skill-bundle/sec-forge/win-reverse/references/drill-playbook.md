# Drill Playbook

当用户没有提供真实样本、但要求你模拟真实 Windows 高级逆向工程师的推进方式时，使用 `task:drill`。

最小流程：

1. `npm run task:drill -- --list`
2. 选择与目标最接近的组合场景
3. `npm run task:drill -- <scenario-id> <task-id>`
4. 读取生成的 `task.json` 中 `taskDrill` 字段
5. 继续标准 `task-sync -> task-advance -> Observe/Capture/...` 闭环

`task:drill` 会自动：

- 选择对应 topics
- 注入目标、目标边界、成功判定、推荐切入点
- 写入 `taskDrill` 元数据
- 运行 `task-sync`
- 运行 `task-advance`

优先选用 drill 的场景：

- Packed + anti-analysis + network + config 的恶意样本链
- Driver + userland broker + TLS 的用户态/内核态联动链
- UI 许可证 / crackme / .NET 的交互式验证链
- Reflective DLL / manual map / beacon 的内存装载链
