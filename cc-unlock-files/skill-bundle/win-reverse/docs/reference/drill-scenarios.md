<!-- publish: framework -->
# Drill Scenarios

用于“无真实样本时的真实演练”。

## 用法

```bash
npm run task:drill -- --list
npm run task:drill -- packed-dotnet-loader lab-packed-loader
```

`task:drill` 会按场景自动选择 topics、补齐 task input、写入 `taskDrill` 元数据，并自动执行一次 `task-sync` 与 `task-advance`。

## 已发布场景

| Scenario | Topics | 目标 |
|---|---|---|
| `packed-dotnet-loader` | `static-triage`, `packer-unpack`, `anti-analysis`, `dotnet`, `loader-injection`, `config-recovery`, `tls-network` | 从壳到 CLR，再到注入链、配置与 TLS beacon 的完整还原 |
| `signed-kernel-pivot` | `static-triage`, `driver`, `anti-analysis`, `frida-hooking`, `tls-network`, `config-recovery` | 用户态服务与已签名驱动协作、IOCTL 与 TLS 边界恢复 |
| `ui-license-crackme` | `static-triage`, `ui-runtime`, `dotnet`, `anti-analysis`, `config-recovery` | UI 交互、许可证字段、反调试门与 solver/patch 路线恢复 |
| `reflective-c2-dll` | `static-triage`, `packer-unpack`, `anti-analysis`, `loader-injection`, `frida-hooking`, `tls-network`, `config-recovery` | Reflective DLL / manual map / crypto / beacon 全链路观测 |
