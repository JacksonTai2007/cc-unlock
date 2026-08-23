<!-- publish: framework -->
# Capability Matrix

The canonical topic source now lives under `topics/<topic>/topic.json`.
`docs/reference/topic-route-matrix.json` is a generated registry view for QA, publish, and review.

## Maturity Summary

- `synthetic-e2e`: `16` 个专题；结构化任务模型、专题 QA、知识覆盖与 synthetic 回归全部已具备。
- `closed-loop`: `0` 个专题；结构化任务模型与专题 QA 已具备，但 synthetic 回归尚未发布。
- `guided`: `0` 个专题；已具备 registry-backed 指导能力，但仍低于 closed-loop 与 synthetic 保证级别。
- `reference-only`: `0` 个专题；已有参考资料，但尚无 registry-backed 的执行契约。

## Topic Table

| Topic | Maturity | Owner | Risk | Route | Required Checks |
|---|---|---|---|---|---|
| `anti-analysis` | `synthetic-e2e` | `win-reverse-core` | `high` | `anti-analysis` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `config-recovery` | `synthetic-e2e` | `win-reverse-core` | `high` | `config-recovery` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `dotnet` | `synthetic-e2e` | `win-reverse-core` | `high` | `dotnet` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `driver` | `synthetic-e2e` | `win-reverse-core` | `high` | `driver` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `exception-runtime` | `synthetic-e2e` | `win-reverse-core` | `high` | `exception-runtime` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `frida-hooking` | `synthetic-e2e` | `win-reverse-core` | `high` | `frida-hooking` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `ipc-persistence` | `synthetic-e2e` | `win-reverse-core` | `high` | `ipc-persistence` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `loader-injection` | `synthetic-e2e` | `win-reverse-core` | `high` | `loader-injection` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `memory-forensics` | `synthetic-e2e` | `win-reverse-core` | `high` | `memory-forensics` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `mixed-mode-interop` | `synthetic-e2e` | `win-reverse-core` | `high` | `mixed-mode-interop` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `packer-unpack` | `synthetic-e2e` | `win-reverse-core` | `high` | `packer-unpack` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `protection-bypass` | `synthetic-e2e` | `win-reverse-core` | `high` | `protection-bypass` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `static-triage` | `synthetic-e2e` | `win-reverse-core` | `high` | `static-triage` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `tls-network` | `synthetic-e2e` | `win-reverse-core` | `high` | `tls-network` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `ui-runtime` | `synthetic-e2e` | `win-reverse-core` | `high` | `ui-runtime` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |
| `web-shell-triage` | `synthetic-e2e` | `win-reverse-core` | `high` | `web-shell-triage` | `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables` |

## Topic Detail

### `anti-analysis`

- 名称: Anti-debug / anti-vm / anti-tamper
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `anti-analysis`
- 协议文档: `references/anti-obf.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/anti-analysis`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/anti-analysis.json`
- taskInit: aliases=`anti-debug`, baseProtectionTier=`T0`, combinationProtectionTiers=`protection-bypass -> T3`
- 必需 signals: `debugger`, `timing`, `vm`, `checksum`, `exception`, `etw`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-anti-analysis-workflow.mjs`
- taskPackFiles: `anti-analysis-hook.js`, `anti-analysis-notes.md`

### `config-recovery`

- 名称: Config / blob / persistence recovery
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `config-recovery`
- 协议文档: `references/config-recovery.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/config-recovery`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/config-recovery.json`
- taskInit: aliases=`config`, `blob-recovery`, baseProtectionTier=`T1`, combinationProtectionTiers=none
- 必需 signals: `config`, `resourceblob`, `registry`, `service`, `blob`, `decryptor`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-config-recovery-workflow.mjs`
- taskPackFiles: `blob-decode-notes.md`, `config-recovery-notes.md`, `config-schema.md`

### `dotnet`

- 名称: .NET / CLR / IL patching
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `dotnet`
- 协议文档: `references/dotnet.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/dotnet`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/dotnet.json`
- taskInit: aliases=`clr`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `clr`, `il`, `metadata`, `confuserex`, `delegate`, `dynamicmethod`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-dotnet-workflow.mjs`
- taskPackFiles: `dotnet-notes.md`, `il-patch-notes.md`

### `driver`

- 名称: Kernel driver / dispatch / ioctl
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `driver`
- 协议文档: `references/driver.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/driver`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/driver.json`
- taskInit: aliases=`sys-driver`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `sys`, `driverentry`, `dispatch`, `ioctl`, `irp`, `deviceiocontrol`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-driver-workflow.mjs`
- taskPackFiles: `driver-dispatch-map.md`, `kernel-ioctl-map.md`

### `exception-runtime`

- 名称: TLS callback / SEH / VEH / startup chain
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `exception-runtime`
- 协议文档: `references/exception-runtime-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/exception-runtime`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/exception-runtime.json`
- taskInit: aliases=`seh-veh`, `tls-callback`, baseProtectionTier=`T1`, combinationProtectionTiers=`anti-analysis -> T2`, `packer-unpack -> T2`, `protection-bypass -> T3`
- 必需 signals: `seh`, `veh`, `tlscallback`, `unhandledexceptionfilter`, `cfg`, `cet`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-exception-runtime-workflow.mjs`
- taskPackFiles: `exception-runtime-notes.md`, `startup-chain.md`

### `frida-hooking`

- 名称: Frida runtime / API / crypto hook
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `frida-hooking`
- 协议文档: `references/frida.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/frida-hooking`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/frida-hooking.json`
- taskInit: aliases=`frida`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `frida`, `interceptor`, `stalker`, `cryptoapi`, `bcrypt`, `hook`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-frida-hook-workflow.mjs`
- taskPackFiles: `frida-hook-template.js`, `hook-events.jsonl`

### `ipc-persistence`

- 名称: IPC / service / task / WMI persistence
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `ipc-persistence`
- 协议文档: `references/ipc-persistence-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/ipc-persistence`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/ipc-persistence.json`
- taskInit: aliases=`ipc`, `persistence`, baseProtectionTier=`T1`, combinationProtectionTiers=`loader-injection -> T2`, `anti-analysis -> T2`
- 必需 signals: `service`, `schtasks`, `wmi`, `namedpipe`, `rpc`, `alpc`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-ipc-persistence-workflow.mjs`
- taskPackFiles: `ipc-persistence-notes.md`, `ipc-surface.md`, `persistence-map.md`

### `loader-injection`

- 名称: Loader / injection / manual map
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `loader-injection`
- 协议文档: `references/loader-injection.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/loader-injection`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/loader-injection.json`
- taskInit: aliases=`inject`, `manual-map`, baseProtectionTier=`T1`, combinationProtectionTiers=`anti-analysis -> T2`, `protection-bypass -> T4`
- 必需 signals: `inject`, `manualmap`, `createremotethread`, `apc`, `hollowing`, `reflective`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-loader-injection-workflow.mjs`
- taskPackFiles: `loader-hook-template.js`, `loader-injection-notes.md`, `remote-map.md`

### `memory-forensics`

- 名称: Memory forensics / VAD / minidump reconstruction
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `memory-forensics`
- 协议文档: `references/memory-forensics-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/memory-forensics`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/memory-forensics.json`
- taskInit: aliases=`memory-dump`, `forensics`, baseProtectionTier=`T1`, combinationProtectionTiers=`loader-injection -> T2`, `packer-unpack -> T2`, `protection-bypass -> T4`
- 必需 signals: `vad`, `minidump`, `pesieve`, `hollowfind`, `modulemap`, `dumpmem`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-memory-forensics-workflow.mjs`
- taskPackFiles: `dump-plan.md`, `memory-layout.md`

### `mixed-mode-interop`

- 名称: Mixed-mode / COM interop / CLR hosting
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `mixed-mode-interop`
- 协议文档: `references/mixed-mode-interop-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/mixed-mode-interop`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/mixed-mode-interop.json`
- taskInit: aliases=`mixed-mode`, `interop`, baseProtectionTier=`T1`, combinationProtectionTiers=`dotnet -> T2`, `loader-injection -> T2`
- 必需 signals: `cxxcli`, `mixedmode`, `ijw`, `pinvoke`, `cominterop`, `clrhost`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-mixed-mode-interop-workflow.mjs`
- taskPackFiles: `bridge-map.md`, `interop-hook-template.js`, `mixed-mode-notes.md`

### `packer-unpack`

- 名称: Packer / OEP / dump / IAT rebuild
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `packer-unpack`
- 协议文档: `references/packers.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/packer-unpack`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/packer-unpack.json`
- taskInit: aliases=`unpack`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `packer`, `oep`, `dump`, `iat`, `stub`, `rwx`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-packer-unpack-workflow.mjs`
- taskPackFiles: `iat-rebuild-notes.md`, `unpack-notes.md`

### `protection-bypass`

- 名称: Anti-tamper / anti-debug bypass / file protection bypass
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `protection-bypass`
- 协议文档: `references/protection-bypass.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/protection-bypass`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/protection-bypass.json`
- taskInit: aliases=`protection-bypass`, `anti-tamper`, baseProtectionTier=`T2`, combinationProtectionTiers=`anti-analysis -> T3`, `exception-runtime -> T3`, `loader-injection -> T4`, `memory-forensics -> T4`
- 必需 signals: `file-integrity`, `integrity-check`, `hardware-bp`, `direct-syscall`, `kernel-callback`, `code-vm`, `anti-tamper`, `anti-dump`, `anti-attach`, `stolen-bytes`, `crc-check`, `文件保护`, `内存校验`, `反篡改`, `校验`, `闪退`, `内核保护`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-protection-bypass-workflow.mjs`
- taskPackFiles: `protection-bypass-hook.js`, `protection-bypass-notes.md`, `protection-bypass-patch.py`

### `static-triage`

- 名称: PE triage / imports / resources
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `static-triage`
- 协议文档: `references/static-triage-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/static-triage`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/static-triage.json`
- taskInit: aliases=`pe-triage`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `pe`, `section`, `import`, `resource`, `rtti`, `entrypoint`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-static-triage-workflow.mjs`
- taskPackFiles: `import-surface.md`, `static-triage-notes.md`

### `tls-network`

- 名称: TLS / network / protocol
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `tls-network`
- 协议文档: `references/tls-network-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/tls-network`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/tls-network.json`
- taskInit: aliases=`network`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `winhttp`, `wininet`, `schannel`, `openssl`, `socket`, `tls`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-tls-network-workflow.mjs`
- taskPackFiles: `tls-hook-template.js`, `tls-network-notes.md`

### `ui-runtime`

- 名称: UI runtime / WndProc / dialog flow
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `ui-runtime`
- 协议文档: `references/ui.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/ui-runtime`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/ui-runtime.json`
- taskInit: aliases=`wndproc`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `wndproc`, `dialog`, `user32`, `message`, `subclass`, `custom-control`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-ui-runtime-workflow.mjs`
- taskPackFiles: `message-flow.md`, `ui-runtime-notes.md`

### `web-shell-triage`

- 名称: Web shell / WebView runtime fingerprinting
- 成熟度: `synthetic-e2e`
- 维护方: `win-reverse-core`
- 风险等级: `high`
- 路线轨道: `web-shell-triage`
- 协议文档: `references/web-shell-triage.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/web-shell-triage`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/web-shell-triage.json`
- taskInit: aliases=`web-shell`, `webview-shell`, `electron-shell`, baseProtectionTier=`T0`, combinationProtectionTiers=`tls-network -> T1`, `config-recovery -> T1`, `anti-analysis -> T2`
- 必需 signals: `electron`, `cef`, `webview2`, `tauri`, `wails`, `nwjs`, `asar`, `javascript`, `html`, `webview`
- 必需检查: `check:topic-manifests`, `check:capability-coverage`, `check:operating-contracts`, `check:deliverables`
- caseFiles: `win-web-shell-triage-workflow.mjs`
- taskPackFiles: `web-shell-next-steps.md`, `web-shell-notes.md`, `web-shell-tech.json`
