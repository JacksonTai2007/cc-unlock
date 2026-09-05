# Case Index

这里只保留抽象 workflow case，不替代真实 task-local。

## 使用顺序

1. 先确认当前任务根目录为 `artifacts/tasks/<task-id>/`
2. 再读 `artifacts/tasks/<task-id>/task.json`
3. 再读 `artifacts/tasks/<task-id>/state/route-state.json`
4. 再读 `artifacts/tasks/<task-id>/state/route-plan.md`
5. 再把 `artifacts/tasks/<task-id>/state/clues.md`、`artifacts/tasks/<task-id>/state/progress.md`、`artifacts/tasks/<task-id>/report.md` 当作派生视图补充阅读
6. 执行 `task-sync -> task-advance`
7. 只有当前路线仍不够清晰时，再回来看这里的抽象 case

## 使用原则

- `route-state.json` 是恢复真源，Markdown 只用于补充查看
- case 只负责提供抽象 workflow，不替代 task-local 当前状态
- case 只提供切入点模板，不提供“必须照抄的步骤”
- 真正优先级永远由当前 task-local 的验收目标决定
- 如果抽象 case 与当前任务验收边界冲突，以当前任务为准
- 不要因为某个 case 里存在更细的 VM / WASM / hook 说明，就忽略更快的黑盒复用或明文边界路线

## 已公开 case

- `mcp-reverse-pure-node-workflow.mjs`
- `abstract-case-template.mjs`
- `web-anti-debug-workflow.mjs`
- `web-ast-deobfuscation-workflow.mjs`
- `web-beacon-reporting-workflow.mjs`
- `web-bundle-loader-workflow.mjs`
- `web-binary-codec-workflow.mjs`
- `web-behavior-telemetry-workflow.mjs`
- `web-challenge-orchestration-workflow.mjs`
- `web-compression-stream-workflow.mjs`
- `web-cross-context-coordination-workflow.mjs`
- `web-dynamic-code-workflow.mjs`
- `web-env-conformance-workflow.mjs`
- `web-framework-runtime-workflow.mjs`
- `web-graphql-rpc-workflow.mjs`
- `web-grpc-web-workflow.mjs`
- `web-instrumentation-hooking-workflow.mjs`
- `web-media-drm-workflow.mjs`
- `web-microfrontend-runtime-workflow.mjs`
- `web-node-env-patching-workflow.mjs`
- `web-frame-workflow.mjs`
- `web-fingerprint-workflow.mjs`
- `web-module-federation-workflow.mjs`
- `web-protocol-workflow.mjs`
- `web-session-lifecycle-workflow.mjs`
- `web-signature-workflow.mjs`
- `web-source-map-workflow.mjs`
- `web-storage-workflow.mjs`
- `web-streaming-runtime-workflow.mjs`
- `web-subtlecrypto-workflow.mjs`
- `web-userland-crypto-workflow.mjs`
- `web-vm-wasm-workflow.mjs`
- `web-vm-generic-template-workflow.mjs`
- `web-webauthn-passkey-workflow.mjs`
- `web-webrtc-datachannel-workflow.mjs`
- `web-jsvmp-devirtualization-workflow.mjs`
- `web-wasm-runtime-workflow.mjs`
- `web-ctf-workflow.mjs`
- `web-worker-workflow.mjs`
