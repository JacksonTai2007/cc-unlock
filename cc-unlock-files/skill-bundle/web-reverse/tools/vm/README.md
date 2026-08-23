# VM Toolkit

这组脚手架用于把通用 VM 逆向模板落地为可直接复用的小工具。

## 文件

- `trace-runtime.mjs`：根据配置生成浏览器侧运行时 trace hook
- `replay-vm.mjs`：在 Node `vm.createContext()` 中加载脚本并做最小回放
- `diff-run.mjs`：比较两份 JSON / JSONL 运行结果，定位第一处分叉

## 典型用途

### 1. 生成运行时 trace hook

```powershell
node tools/vm/trace-runtime.mjs --config artifacts/tasks/_TEMPLATE/run/vm-template-profile.json --out artifacts/tasks/demo/run/generated-vm-hook.js
```

### 2. 本地回放 VM 入口

```powershell
node tools/vm/replay-vm.mjs --entry sample.js --preload artifacts/tasks/_TEMPLATE/run/vm-trace-template.js --context artifacts/tasks/_TEMPLATE/run/vm-template-profile.json
```

### 3. 对比浏览器 / 本地运行差异

```powershell
node tools/vm/diff-run.mjs --left browser-trace.jsonl --right local-trace.jsonl
```

## 注意

- 这些是**最小脚手架**，默认用于 task-local 二次改造
- `trace-runtime.mjs` 当前优先保证可观测性，不默认伪装 `toString/name/length`；高对抗场景下请在 task-local 中再做 stealth 包装
- `replay-vm.mjs` 默认提供的是**最小 process shim**，不会暴露宿主完整 `process.env` / `process.exit`
- 不要把生成配置中的站点私有字段直接固化进通用模板
- 先保证当前任务验收，再把稳定做法回收进这些工具
