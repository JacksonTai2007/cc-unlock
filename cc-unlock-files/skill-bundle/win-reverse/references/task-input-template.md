# Task Input Template

最少收集：
- `target`
- `objective`
- `requirements`
- `boundaries`

`task-init` 与 `task:drill` 现在都会强制校验：

- `references/schemas/win-reverse-task-input.schema.json`

推荐使用结构化对象，而不是只写自由文本：

```json
{
  "target": {
    "value": "packed-dotnet-loader sample",
    "binaryPath": "samples/packed-dotnet-loader.exe"
  },
  "objective": "确认壳/OEP、恢复 CLR stage、定位远端注入链，并完成一次本地协议重放验收。",
  "requirements": {
    "deliverables": [
      "PE triage 结论",
      "unpack / OEP / IAT 状态",
      "TLS replay 示例"
    ],
    "localReproductionRequested": true,
    "protocolReplayExampleRequired": true
  },
  "boundaries": {
    "inScope": [
      "静态分析",
      "用户态调试",
      "Frida / API hook",
      "本地协议重放"
    ],
    "outOfScope": [
      "未授权对外联机",
      "对第三方生产系统进行持久化修改"
    ]
  },
  "runtime": {
    "architecture": "x64",
    "wow64": "unknown",
    "managed": true,
    "kernelMode": false
  },
  "access": {
    "adminRequired": false,
    "interactiveUnlockRequired": false,
    "driverSigningBypassRequired": false
  },
  "samplePaths": [
    "samples/packed-dotnet-loader.exe"
  ],
  "focusSignals": [
    "CreateRemoteThread",
    "WinHttpSendRequest"
  ]
}
```

兼容说明：

- 仍接受旧版简写：`target: "..."`、`requirements: ["..."]`、`boundaries: ["..."]`
- 进入 `task-init` 后会统一规范化为结构化对象

推荐补充：
- 样本路径、哈希、架构、是否带壳或驱动
- 宿主进程、注入方式、目标服务 / 驱动名、注册表或资源 blob 线索
- 现有工具结果，如 IDA/x64dbg/dnSpy/WinDbg 观察
- 是否允许动态运行、hook、dump、补丁、协议重放或远端注入观察
