# Task Template

复制本目录到 `artifacts/tasks/<task-id>/` 后再开始真实任务。

`core/` 目录仅保留为兼容镜像；根目录模板是正式真源。

最少要维护：

- `task.json`
- `report.md`
- `timeline.jsonl`
- `static-evidence.jsonl`
- `runtime-evidence.jsonl`
- `network.jsonl`
- `memory-evidence.jsonl`
- `logcat.jsonl`
- `run/fixtures.json`
- `run/verify-once.mjs`

命中本地复现 / API 调用示例交付时，还应维护：

- `run/local-repro-example.js`
- `run/api-call-example.js`

按专题命中情况追加维护：

- `run/api-map.md` / `run/call-chain.md`
- `run/native-notes.md` / `run/network-stack-notes.md`
- `run/webview-bridge-notes.md` / `run/storage-ipc-notes.md`
- `run/framework-runtime-notes.md` / `run/art-runtime-notes.md`
- `run/anti-root-bypass.js` / `run/anti-frida-bypass.js`
- `run/integrity-bypass.js` / `run/cert-pinning-bypass.js` / `run/anti-emulator-bypass.js`
- `run/class-loader-trace.js` / `run/dex-loader-dump-notes.md`
- `run/smali-patch-notes.md` / `run/solver-template.py`

