<!-- publish: framework -->
# Capability Matrix

The canonical topic source now lives under `topics/<topic>/topic.json`.
`docs/reference/topic-route-matrix.json` is a generated registry view for QA, publish, and review.
Maturity semantics and promotion rules are documented in `docs/reference/maturity-model.md`.

## Maturity Summary

- `synthetic-e2e`: `21` 个专题；结构化任务模型、formal validation、专题 QA 与 synthetic 回归全部已具备。
- `closed-loop`: `13` 个专题；结构化任务模型、formal validation 与专题 QA 已具备，但 synthetic 回归尚未发布。
- `guided`: `0` 个专题；已有 registry-backed 路由与专题指导，但闭环执行契约仍未达到 closed-loop。
- `reference-only`: `0` 个专题；已有参考资料，但尚无 registry-backed 的执行契约。

## Topic Table

| Topic | Maturity | Owner | Risk | Route | Required Checks |
|---|---|---|---|---|---|
| `anti-debug` | `synthetic-e2e` | `web-reverse-core` | `high` | `anti-debug` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `behavior-telemetry` | `synthetic-e2e` | `web-reverse-core` | `high` | `behavior-telemetry` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `binary-codec` | `synthetic-e2e` | `web-reverse-core` | `high` | `binary-codec` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `challenge-orchestration` | `synthetic-e2e` | `web-reverse-core` | `high` | `challenge-orchestration` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`, `check:algo-selfcheck` |
| `compression-stream` | `synthetic-e2e` | `web-reverse-core` | `medium` | `compression-stream` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `dynamic-code` | `synthetic-e2e` | `web-reverse-core` | `high` | `dynamic-code` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `env` | `synthetic-e2e` | `web-reverse-core` | `medium` | `env` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `fingerprint` | `synthetic-e2e` | `web-reverse-core` | `high` | `fingerprint` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `framework-runtime` | `synthetic-e2e` | `web-reverse-core` | `high` | `framework-runtime` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `graphql-rpc` | `synthetic-e2e` | `web-reverse-core` | `high` | `graphql-rpc` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `instrumentation-hooking` | `synthetic-e2e` | `web-reverse-core` | `high` | `instrumentation-hooking` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `jsvmp` | `synthetic-e2e` | `web-reverse-core` | `high` | `jsvmp` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`, `check:algo-selfcheck` |
| `media-drm` | `synthetic-e2e` | `web-reverse-core` | `high` | `media-drm` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `module-federation` | `synthetic-e2e` | `web-reverse-core` | `high` | `module-federation` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `protocol` | `synthetic-e2e` | `web-reverse-core` | `high` | `protocol` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `signature` | `synthetic-e2e` | `web-reverse-core` | `high` | `signature` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`, `check:algo-selfcheck` |
| `streaming-runtime` | `synthetic-e2e` | `web-reverse-core` | `high` | `streaming-runtime` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `subtlecrypto` | `synthetic-e2e` | `web-reverse-core` | `high` | `subtlecrypto` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `userland-crypto` | `synthetic-e2e` | `web-reverse-core` | `high` | `userland-crypto` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `wasm` | `synthetic-e2e` | `web-reverse-core` | `high` | `wasm` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `worker` | `synthetic-e2e` | `web-reverse-core` | `medium` | `worker` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e` |
| `anti-tamper` | `closed-loop` | `web-reverse-core` | `high` | `anti-tamper` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression` |
| `ast-deobfuscation` | `closed-loop` | `web-reverse-core` | `high` | `ast-deobfuscation` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `beacon-reporting` | `closed-loop` | `web-reverse-core` | `medium` | `beacon-reporting` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `bundle-loader` | `closed-loop` | `web-reverse-core` | `medium` | `bundle-loader` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `cross-context-coordination` | `closed-loop` | `web-reverse-core` | `high` | `cross-context-coordination` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `frame` | `closed-loop` | `web-reverse-core` | `medium` | `frame` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `grpc-web` | `closed-loop` | `web-reverse-core` | `high` | `grpc-web` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `microfrontend-runtime` | `closed-loop` | `web-reverse-core` | `high` | `microfrontend-runtime` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `session` | `closed-loop` | `web-reverse-core` | `medium` | `session` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `source-map` | `closed-loop` | `web-reverse-core` | `medium` | `source-map` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `storage` | `closed-loop` | `web-reverse-core` | `medium` | `storage` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `webauthn-passkey` | `closed-loop` | `web-reverse-core` | `high` | `webauthn-passkey` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |
| `webrtc-datachannel` | `closed-loop` | `web-reverse-core` | `high` | `webrtc-datachannel` | `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency` |

## Topic Detail

### `anti-debug`

- 名称: Anti-debug
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `anti-debug`
- 协议文档: `references/anti-debug-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/anti-debug`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/anti-debug.json`
- taskInit: aliases=none, baseProtectionTier=`T2`, combinationProtectionTiers=none
- 必需 signals: `debugger`, `DevTools`, `preload`, `runtime`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-anti-debug-workflow.mjs`
- taskPackFiles: `anti-debug-preload.js`, `anti-debug-runtime.js`, `anti-debug-snippets.js`

### `behavior-telemetry`

- 名称: Behavior telemetry / interaction traces
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `behavior-telemetry`
- 协议文档: `references/behavior-telemetry-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/behavior-telemetry`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/behavior-telemetry.json`
- taskInit: aliases=`behavioral-telemetry`, `interaction-trace`, baseProtectionTier=`T3`, combinationProtectionTiers=`fingerprint -> T4`, `frame+session -> T4`
- 必需 signals: `mousemove`, `scroll cadence`, `focus`, `visibilitychange`, `input rhythm`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-behavior-telemetry-workflow.mjs`
- taskPackFiles: `behavior-telemetry-notes.md`, `telemetry-profile.json`

### `binary-codec`

- 名称: Binary codec / schema reconstruction
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `binary-codec`
- 协议文档: `references/binary-codec-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/binary-codec`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/binary-codec.json`
- taskInit: aliases=`binarycodec`, `protobuf-msgpack`, baseProtectionTier=`T1`, combinationProtectionTiers=`protocol -> T2`, `wasm+compression-stream -> T3`
- 必需 signals: `protobuf`, `msgpack`, `cbor`, `flatbuffers`, `varint`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-binary-codec-workflow.mjs`
- taskPackFiles: `binary-codec-notes.md`, `binary-samples.json`

### `challenge-orchestration`

- 名称: Challenge routing / token orchestration
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `challenge-orchestration`
- 协议文档: `references/challenge-orchestration-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/challenge-orchestration`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/challenge-orchestration.json`
- taskInit: aliases=`challenge-routing`, `captcha-flow`, baseProtectionTier=`T3`, combinationProtectionTiers=`fingerprint -> T4`, `session+protocol -> T4`
- 必需 signals: `challenge token`, `captcha`, `turnstile`, `risk route`, `silent challenge`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`, `check:algo-selfcheck`
- caseFiles: `web-challenge-orchestration-workflow.mjs`
- taskPackFiles: `challenge-route-notes.md`, `challenge-state-machine.json`

### `compression-stream`

- 名称: Compression / decompression boundary
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `compression-stream`
- 协议文档: `references/compression-stream-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/compression-stream`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/compression-stream.json`
- taskInit: aliases=`compressionstream`, `decompression`, baseProtectionTier=`T1`, combinationProtectionTiers=`protocol -> T2`, `binary-codec+streaming-runtime -> T3`
- 必需 signals: `gzip`, `deflate`, `brotli`, `CompressionStream`, `DecompressionStream`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-compression-stream-workflow.mjs`
- taskPackFiles: `compression-samples.json`, `compression-stream-notes.md`

### `dynamic-code`

- 名称: Dynamic code / eval unpacking
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `dynamic-code`
- 协议文档: `references/dynamic-code-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/dynamic-code`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/dynamic-code.json`
- taskInit: aliases=none, baseProtectionTier=`T3`, combinationProtectionTiers=none
- 必需 signals: `eval`, `Function`, `string timer`, `dynamic import`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-dynamic-code-workflow.mjs`
- taskPackFiles: `dynamic-code-capture-template.js`, `dynamic-code-notes.md`

### `env`

- 名称: Env conformance / host behavior
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `env`
- 协议文档: `references/env-conformance-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/env`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/env.json`
- taskInit: aliases=`env-conformance`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `first divergence`, `descriptor`, `queueMicrotask`, `typed array`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-env-conformance-workflow.mjs`, `web-node-env-patching-workflow.mjs`
- taskPackFiles: `browser-env-snapshot.json`, `env-conformance-notes.md`, `env-conformance-template.js`, `env-drift-matrix.md`

### `fingerprint`

- 名称: 指纹 / 自动化检测画像
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `fingerprint`
- 协议文档: `references/fingerprint-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/fingerprint`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/fingerprint.json`
- taskInit: aliases=`browser-fingerprint`, `bot-detection`, baseProtectionTier=`T2`, combinationProtectionTiers=`env -> T3`, `session+protocol -> T3`
- 必需 signals: `fingerprint`, `anti-bot`, `webdriver`, `userAgentData`, `canvas`, `webgl`, `audio`, `fonts`, `timezone`, `screen`, `navigator`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-fingerprint-workflow.mjs`
- taskPackFiles: `fingerprint-inspector-template.js`, `fingerprint-notes.md`, `fingerprint-profile.json`

### `framework-runtime`

- 名称: Framework runtime / SSR-CSR boundary
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `framework-runtime`
- 协议文档: `references/framework-runtime-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/framework-runtime`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/framework-runtime.json`
- taskInit: aliases=`frameworkruntime`, `ssr-csr-boundary`, baseProtectionTier=`T2`, combinationProtectionTiers=`bundle-loader+source-map -> T3`, `session -> T3`
- 必需 signals: `Next.js`, `Nuxt`, `Remix`, `Vite`, `SvelteKit`, `Astro`, `__NEXT_DATA__`, `hydration`, `import.meta`, `modulepreload`, `island`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-framework-runtime-workflow.mjs`
- taskPackFiles: `framework-payload-map.json`, `framework-runtime-notes.md`

### `graphql-rpc`

- 名称: GraphQL / persisted query / APQ
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `graphql-rpc`
- 协议文档: `references/graphql-rpc-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/graphql-rpc`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/graphql-rpc.json`
- taskInit: aliases=`graphql`, `apq`, baseProtectionTier=`T1`, combinationProtectionTiers=`signature+compression-stream -> T2`
- 必需 signals: `/graphql`, `query`, `mutation`, `operationName`, `extensions.persistedQuery`, `sha256Hash`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-graphql-rpc-workflow.mjs`
- taskPackFiles: `graphql-ops.json`, `query-map.md`

### `instrumentation-hooking`

- 名称: Instrumentation / hooking / trace
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `instrumentation-hooking`
- 协议文档: `references/instrumentation.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/instrumentation-hooking`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/instrumentation-hooking.json`
- taskInit: aliases=`hooking`, `trace-injection`, baseProtectionTier=`T2`, combinationProtectionTiers=`anti-debug+anti-tamper -> T4`
- 必需 signals: `fetch`, `XHR`, `WebSocket`, `sendBeacon`, `eval`, `Function`, `postMessage`, `cookie setter`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-instrumentation-hooking-workflow.mjs`
- taskPackFiles: `hook-events.jsonl`, `hook-safety-notes.md`, `preload.js`, `runtime-hooks.js`

### `jsvmp`

- 名称: JS-VMP / custom VM
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `jsvmp`
- 协议文档: `references/vmp-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/jsvmp`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/vm.json`
- taskInit: aliases=`vm`, baseProtectionTier=`T4`, combinationProtectionTiers=`wasm -> T6`, `media-drm -> T7`
- 必需 signals: `dispatcher`, `opcode`, `bytecode`, `handler table`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`, `check:algo-selfcheck`
- caseFiles: `web-vm-generic-template-workflow.mjs`, `web-jsvmp-devirtualization-workflow.mjs`, `web-vm-wasm-workflow.mjs`
- taskPackFiles: `dispatcher-map.md`, `vm-bytecode-lifecycle.md`, `vm-decode-notes.md`, `vm-env-reads.json`, `vm-env-trace-template.js`, `vm-handler-clusters.md`, `vm-nesting-map.md`, `vm-opcodes.txt`, `vm-template-profile.json`, `vm-trace-template.js`, `vm-trace.jsonl`

### `media-drm`

- 名称: Media DRM / EME / license flow
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `media-drm`
- 协议文档: `references/media-drm-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/media-drm`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/media-drm.json`
- taskInit: aliases=`drm`, `eme`, baseProtectionTier=`T3`, combinationProtectionTiers=`session+beacon-reporting -> T4`, `jsvmp -> T7`, `wasm -> T6`
- 必需 signals: `MediaSource`, `encrypted event`, `requestMediaKeySystemAccess`, `license`, `m3u8`, `mpd`, `video frame`, `decrypt`, `clearkey`, `SourceBuffer`, `key session`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-media-drm-workflow.mjs`
- taskPackFiles: `frame-decryption-chain.md`, `key-session-timeline.json`, `license-flow.md`, `token-inputs.json`, `verify-decryption.mjs`

### `module-federation`

- 名称: Module federation / remote runtime
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `module-federation`
- 协议文档: `references/module-federation-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/module-federation`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/module-federation.json`
- taskInit: aliases=`modulefederation`, `remote-entry`, baseProtectionTier=`T2`, combinationProtectionTiers=`bundle-loader -> T3`, `frame+session -> T3`
- 必需 signals: `remoteEntry.js`, `__webpack_init_sharing__`, `container.get`, `share scope`, `remote module`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-module-federation-workflow.mjs`
- taskPackFiles: `module-federation-notes.md`, `remote-entry-map.json`

### `protocol`

- 名称: Protocol / replay
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `protocol`
- 协议文档: `references/protocol-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/protocol`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/protocol.json`
- taskInit: aliases=none, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `websocket`, `sse`, `webtransport`, `datagram`, `stream`, `schema`, `replay`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-protocol-workflow.mjs`
- taskPackFiles: `actions.json`, `README.md`, `request-template.json`, `protocol-inspector-template.js`, `protocol-notes.md`, `web-replay.js`, `websocket-frame-notes.md`

### `signature`

- 名称: Request signature / parameter reconstruction
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `signature`
- 协议文档: `references/signature-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/signature`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/signature.json`
- taskInit: aliases=`sign-chain`, `request-signature`, baseProtectionTier=`T2`, combinationProtectionTiers=`session+storage -> T3`, `env -> T4`
- 必需 signals: `sign`, `signature`, `hmac`, `timestamp`, `nonce`, `canonical string`, `x-sign`, `x-t`, `request acceptance`, `signer state`, `x-ms-token`, `msToken`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`, `check:algo-selfcheck`
- caseFiles: `web-signature-workflow.mjs`
- taskPackFiles: `signature-fixtures.json`, `signature-input-map.md`

### `streaming-runtime`

- 名称: Streaming runtime / incremental execution
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `streaming-runtime`
- 协议文档: `references/streaming-runtime-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/streaming-runtime`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/streaming-runtime.json`
- taskInit: aliases=`stream-runtime`, `incremental-stream`, baseProtectionTier=`T2`, combinationProtectionTiers=`protocol+dynamic-code -> T3`, `wasm -> T4`
- 必需 signals: `ReadableStream`, `TransformStream`, `TextDecoderStream`, `incremental decode`, `stream pipeline`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-streaming-runtime-workflow.mjs`
- taskPackFiles: `stream-pipeline.json`, `streaming-runtime-notes.md`

### `subtlecrypto`

- 名称: SubtleCrypto / key lifecycle
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `subtlecrypto`
- 协议文档: `references/subtlecrypto-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/subtlecrypto`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/subtlecrypto.json`
- taskInit: aliases=`webcrypto`, `subtle-crypto`, baseProtectionTier=`T1`, combinationProtectionTiers=`protocol -> T2`, `env+dynamic-code -> T3`
- 必需 signals: `crypto.subtle`, `importKey`, `deriveKey`, `sign`, `digest`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-subtlecrypto-workflow.mjs`
- taskPackFiles: `subtlecrypto-keyflow.json`, `subtlecrypto-notes.md`

### `userland-crypto`

- 名称: Userland crypto / algorithm extraction
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `userland-crypto`
- 协议文档: `references/userland-crypto-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/userland-crypto`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/userland-crypto.json`
- taskInit: aliases=`cryptojs`, `pure-crypto`, baseProtectionTier=`T2`, combinationProtectionTiers=`signature+compression-stream -> T3`
- 必需 signals: `CryptoJS`, `AES.encrypt`, `MD5`, `SHA256`, `RSAKey`, `WordArray`, `Base64.parse`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-userland-crypto-workflow.mjs`
- taskPackFiles: `crypto-callgraph.md`, `plain-cipher-pairs.json`, `pure-crypto.js`

### `wasm`

- 名称: WASM runtime
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `wasm`
- 协议文档: `references/wasm-runtime-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/wasm`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/wasm.json`
- taskInit: aliases=`wasm-analysis`, baseProtectionTier=`T5`, combinationProtectionTiers=`jsvmp -> T6`
- 必需 signals: `instantiate`, `instantiateStreaming`, `glue`, `memory`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-wasm-runtime-workflow.mjs`
- taskPackFiles: `wasm-analysis.wat`, `wasm-imports-exports.json`, `wasm-notes.md`, `wasm-runtime-hook-template.js`

### `worker`

- 名称: Worker / Service Worker
- 成熟度: `synthetic-e2e`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `worker`
- 协议文档: `references/worker-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/worker`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/worker.json`
- taskInit: aliases=`workers`, baseProtectionTier=`T1`, combinationProtectionTiers=none
- 必需 signals: `worker`, `service worker`, `postMessage`, `Blob`, `createObjectURL`, `importScripts`, `workbox`, `fetch event`, `navigation preload`, `clients.claim`, `skipWaiting`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`, `check:synthetic-e2e`
- caseFiles: `web-worker-workflow.mjs`
- taskPackFiles: `worker-inspector-template.js`, `worker-notes.md`

### `anti-tamper`

- 名称: Integrity / Trusted Types / hook resistance
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `anti-tamper`
- 协议文档: `references/anti-tamper-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/anti-tamper`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/anti-tamper.json`
- taskInit: aliases=`integrity-check`, `trusted-types`, baseProtectionTier=`T3`, combinationProtectionTiers=`anti-debug+dynamic-code -> T4`, `env -> T4`
- 必需 signals: `integrity`, `self-check`, `Trusted Types`, `CSP`, `SRI`, `hook seal`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`, `check:eval-regression`
- caseFiles: `web-anti-tamper-workflow.mjs`
- taskPackFiles: `anti-tamper-notes.md`, `integrity-surface.json`

### `ast-deobfuscation`

- 名称: AST deobfuscation / semantic recovery
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `ast-deobfuscation`
- 协议文档: `references/ast-deobfuscation.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/ast-deobfuscation`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/ast-deobfuscation.json`
- taskInit: aliases=`ast-deobf`, `semantic-recovery`, baseProtectionTier=`T2`, combinationProtectionTiers=`dynamic-code -> T3`
- 必需 signals: `while(true)+switch`, `string array`, `_0x`, `eval(pack)`, `rotator`, `dispatcher object`, `control flow flattening`, `string array rotator`, `dead code injection`, `hexadecimal string literals`, `self-defending`, `console output disabled`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-ast-deobfuscation-workflow.mjs`
- taskPackFiles: `after.js`, `ast-transform.mjs`, `before.js`, `deobf-rules.md`

### `beacon-reporting`

- 名称: Beacon / reporting / hidden telemetry
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `beacon-reporting`
- 协议文档: `references/beacon-reporting-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/beacon-reporting`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/beacon-reporting.json`
- taskInit: aliases=`sendbeacon`, `reporting`, baseProtectionTier=`T2`, combinationProtectionTiers=`behavior-telemetry+instrumentation-hooking -> T3`
- 必需 signals: `sendBeacon`, `report-to`, `ReportingObserver`, `visibilitychange`, `pagehide`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-beacon-reporting-workflow.mjs`
- taskPackFiles: `beacon-log.jsonl`, `reporting-map.md`

### `bundle-loader`

- 名称: Bundle / chunk loader
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `bundle-loader`
- 协议文档: `references/bundle-loader-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/bundle-loader`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/bundle-loader.json`
- taskInit: aliases=`chunk-loader`, baseProtectionTier=`T2`, combinationProtectionTiers=none
- 必需 signals: `webpackJsonp`, `__webpack_require__`, `chunk loader`, `dynamic import`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-bundle-loader-workflow.mjs`
- taskPackFiles: `chunk-loader-notes.md`, `preload-orchestrator.js`

### `cross-context-coordination`

- 名称: Cross-context coordination / message graph
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `cross-context-coordination`
- 协议文档: `references/cross-context-coordination-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/cross-context-coordination`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/cross-context-coordination.json`
- taskInit: aliases=`cross-context`, `message-graph`, baseProtectionTier=`T2`, combinationProtectionTiers=`worker+frame -> T3`
- 必需 signals: `BroadcastChannel`, `storage event`, `SharedArrayBuffer`, `Atomics`, `AudioWorklet`, `PaintWorklet`, `OffscreenCanvas`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-cross-context-coordination-workflow.mjs`
- taskPackFiles: `context-map.md`, `message-graph.json`

### `frame`

- 名称: Frame / iframe
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `frame`
- 协议文档: `references/frame-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/frame`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/frame.json`
- taskInit: aliases=`frames`, baseProtectionTier=`T1`, combinationProtectionTiers=none
- 必需 signals: `iframe`, `frame`, `postMessage`, `cross-frame`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-frame-workflow.mjs`
- taskPackFiles: `frame-notes.md`

### `grpc-web`

- 名称: gRPC-Web / Connect-Web / protobuf over HTTP
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `grpc-web`
- 协议文档: `references/grpc-web-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/grpc-web`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/grpc-web.json`
- taskInit: aliases=`connect-web`, `grpc`, baseProtectionTier=`T2`, combinationProtectionTiers=`binary-codec+compression-stream -> T3`
- 必需 signals: `application/grpc-web`, `x-grpc-web`, `grpc-status`, `proto`, `trailers`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-grpc-web-workflow.mjs`
- taskPackFiles: `grpc-frame-notes.md`, `grpc-replay.js`, `grpc-schema-map.md`

### `microfrontend-runtime`

- 名称: Microfrontend runtime / remote loader
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `microfrontend-runtime`
- 协议文档: `references/microfrontend-runtime-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/microfrontend-runtime`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/microfrontend-runtime.json`
- taskInit: aliases=`microfrontend`, `remote-loader`, baseProtectionTier=`T2`, combinationProtectionTiers=`bundle-loader+framework-runtime -> T3`
- 必需 signals: `System.import`, `importmap`, `single-spa`, `qiankun`, `remote manifest`, `subapp mount`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-microfrontend-runtime-workflow.mjs`
- taskPackFiles: `remote-deps.md`, `runtime-map.json`

### `session`

- 名称: Session lifecycle
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `session`
- 协议文档: `references/session-lifecycle-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/session`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/session.json`
- taskInit: aliases=`session-lifecycle`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `session`, `bootstrap`, `token refresh`, `cookie`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-session-lifecycle-workflow.mjs`
- taskPackFiles: `session-notes.md`

### `source-map`

- 名称: Source map recovery
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `source-map`
- 协议文档: `references/source-map-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/source-map`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/source-map.json`
- taskInit: aliases=none, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `source map`, `sourceMappingURL`, `hidden source map`, `bundle`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-source-map-workflow.mjs`
- taskPackFiles: `source-map-notes.md`, `source-map-recover-template.js`

### `storage`

- 名称: Storage analysis
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `medium`
- 路线轨道: `storage`
- 协议文档: `references/storage-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/storage`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/storage.json`
- taskInit: aliases=`storage-analysis`, baseProtectionTier=`T0`, combinationProtectionTiers=none
- 必需 signals: `cookie`, `localStorage`, `sessionStorage`, `indexedDB`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-storage-workflow.mjs`
- taskPackFiles: `storage-notes.md`, `storage-snapshot.json`

### `webauthn-passkey`

- 名称: WebAuthn / passkey / challenge flow
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `webauthn-passkey`
- 协议文档: `references/webauthn-passkey-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/webauthn-passkey`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/webauthn-passkey.json`
- taskInit: aliases=`webauthn`, `passkey`, baseProtectionTier=`T3`, combinationProtectionTiers=`session+challenge-orchestration -> T4`
- 必需 signals: `navigator.credentials`, `PublicKeyCredential`, `webauthn.create`, `webauthn.get`, `challenge`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-webauthn-passkey-workflow.mjs`
- taskPackFiles: `credential-flow.md`, `request-response-samples.json`

### `webrtc-datachannel`

- 名称: WebRTC / signaling / datachannel
- 成熟度: `closed-loop`
- 维护方: `web-reverse-core`
- 风险等级: `high`
- 路线轨道: `webrtc-datachannel`
- 协议文档: `references/webrtc-datachannel-playbook.md`
- taskPackDir: `artifacts/tasks/_TEMPLATE/topic-packs/webrtc-datachannel`
- taskModelFile: `artifacts/tasks/_TEMPLATE/extensions/webrtc-datachannel.json`
- taskInit: aliases=`webrtc`, `datachannel`, baseProtectionTier=`T3`, combinationProtectionTiers=`cross-context-coordination+session -> T4`
- 必需 signals: `RTCPeerConnection`, `createOffer`, `setLocalDescription`, `ICE`, `RTCDataChannel`
- 必需检查: `check:topic-manifests`, `check:task-semantics`, `check:task-packs`, `check:capability-coverage`, `check:specialized-strength`, `check:deliverables`, `check:route-consistency`
- caseFiles: `web-webrtc-datachannel-workflow.mjs`
- taskPackFiles: `channel-frames.jsonl`, `signaling-map.md`
