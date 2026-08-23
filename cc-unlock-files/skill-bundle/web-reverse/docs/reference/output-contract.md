<!-- publish: framework -->
# Output Contract

- `report.md` 文件名保持不变，但标题、正文、项目符号说明、阶段结论都必须使用中文
- 不输出英文版或中英双语版 `report.md`
- 只有代码、文件名、命令名、协议字段名、接口字段名可保留原文

> 分区说明（§A 通用必填段 / §B 条件触发段）：下方「正式输出至少必须包含」即 **§A 通用必填段**，所有任务无条件适用；从 `## Execution Discipline` 之后的「如果命中 X 则补 Y」均为 **§B 条件触发段**。优先级判定见本段末「默认最少交付」一节。

正式输出至少必须包含（§A 通用必填段）：
- `taskContract.objective / nonNegotiables / deliverableTier / completionCriteria`
- `executionModel.currentState / primaryEntrypoint / microRoute / stopLossCondition`
- `acceptanceModel.claimLevel / acceptanceGap / nextEvidenceGate / acceptancePath / validators`
- `workspaceRoot`
- `taskLocalRoot`
- `artifactTruthRoot`
- `workspaceKind`
- `taskMode`
- `deliverableTier`
- `primaryTopic / secondaryTopics`
- `claimLevel`
- `evidenceStatus`
- `whyNotDeliveredYet`（若未达 `delivered`）
- `acceptanceGap`
- `nextEvidenceGate`
- 当前阶段
- 自动续跑决策
- 目标边界
- 防护等级
- 算法边界状态
- 动态输入来源
- 请求验收状态
- 非确定性说明
- 目标请求 / 字段
- `activeEntrypoints`
- `entrypointStatuses`
- `execution.nextEntrypointId`
- `execution.nextExecutableAction`
- 关键脚本 / 函数路径
- 运行时证据
- `first divergence`
- 本地补环境状态
- 验收结果
- `fixtures.json` 路径
- `deliveryAdoptionStatus`
- `usedArtifacts / unusedArtifacts / acceptancePath`
- 置信度
- `UNKNOWNS`
- task artifact 路径
- `artifacts/tasks/<task-id>/report.md`
- `run/fixtures.json`

§A 报告详实度段（通用必填，由 `tools/task/task-close.mjs` 白名单 upsert 渲染，真源为 `state/narrative.md`，缺失时渲染显眼告警）：
- `## 逆向分析过程`：还原链路叙事——入口定位手法 → 关键取证点 → 逐步还原的关键决策/试错；即便无 pivot 也写出 3~6 个关键节点（负责「怎么定位→取证→还原」的过程知识浓缩）
- `## 主要算法说明`：**无条件必填**（不受 `localReproductionRequested` 门控）；`claimLevel ≥ route-ready` 起强烈建议非空，`reportDepth=deep` 时为硬门槛（closeout/verify 阻断）。结构化骨架：
  - 算法家族与判定依据（HMAC-SHA256 / AES-CBC / 魔改 MD5 / JSVMP 内联 等）
  - 输入清单：每个输入字段 + 来源（请求参数 / 时间戳 / nonce / 设备指纹 / 会话态）
  - 归一化规则：canonical string 怎么拼（字段排序、分隔符、编码、大小写）
  - 密钥材料：key / iv / salt / nonce 来源与派生链（硬编码 / 动态下发 / 指纹派生）
  - 输出与 carrier：算出来放进哪个 header / body 字段、编码方式
  - 一组真实「输入 → 输出」样例（脱敏）
  - 最小伪代码（5~15 行可复现）
  - 数据流图（文本版即可，如 `ts+nonce+body → sort → canonical → HMAC(key) → base64 → X-Sign`）
- `## 难点与对抗`：保护清单 / 每个卡点的突破手法+验证 / 残余风险（复盘「卡哪 → 怎么破 → 对抗什么」，区别于「还没解决什么」）

§A 最小调用说明（通用必填，与完整 `pure-*` 实现的 tier 门控解耦）：
- 凡 `deliverableTier ∈ {本地复现, 纯算法提取}`，或 `run/` 下存在可执行成品脚本（`pure-*.js/py`、`web-replay`、`verify-once` 等），`## 调用示例` **强制非空且自包含**，必须写出：
  - 依赖与安装命令（如 `pip install pycryptodome` / `npm i`）
  - 完整运行命令
  - 样例输入（脱敏）
  - 预期输出片段（脱敏）——须贴脱敏后的真实输出文本（如签名值前后缀、响应关键字段），不接受仅填 `run/xxx` 路径指针
  - API 任务：完整请求（method / url / headers / body）与响应样本片段
- 注：上述「产出后必须写怎么跑」不再受 `localReproductionRequested` flag 控制；但**完整 `run/pure-*` 实现是否必须产出**仍受交付梯度门控（见下文「目标请求 / 字段」一节与 §B 的本地复现 / 纯算法提取条目）。

建议把 `workspaceRoot / taskLocalRoot / artifactTruthRoot / workspaceKind / taskMode / deliverableTier / claimLevel / evidenceStatus / whyNotDeliveredYet / acceptanceGap / nextEvidenceGate` 放在报告最前面，不要把这些关键控制字段埋在正文中后段。

默认最少交付只覆盖通用任务闭环，不默认要求本地纯算法实现。
只有当任务显式命中“本地复现 / API 调用示例”交付约束时，才要求 `run/pure-*.js` 或 `pure_*.py`。

## Execution Discipline

- 当前目录可能是 skill 项目目录，任务 artifact 也可能位于外部 workspace
- 先运行 `node tools/task/assert-can-reply.mjs <task-id>`
- 若要输出最终完成结论，改为运行 `node tools/task/assert-can-reply.mjs <task-id> --require-validated-deliverable`
- 若允许暂停，必须显式写 `replyGateDecision`，并把 `blockingAction / requiredUserAction / resumeCondition` 写成精确动作
- 若任务位于外部 workspace，报告中必须显式引用 `artifactTruthRoot`，不要把 skill 仓库根写成默认真源
- 未核实文件真实存在前，不得写“已落盘 / 已更新 / 已写入”
- 未拿到最新验证结果前，不得写“已成功 / 已打通 / 已请求成功”
- 正式交付物必须位于 `artifacts/tasks/<task-id>/`；若消息里引用的 `state*.json`、`pure*.js`、`report.md`、`verify-once.mjs`、`fixtures.json` 位于 workspace 根目录，应视为违规落盘
- 若 `run/web-replay.js` 或 `run/local-repro-example.js` 依赖保存的成功 JSON、`live-browser-response-body.txt`、unsigned fallback 或“生成了参数但没真正带入最终请求”，不得写成交付成功
- 若用户要求登录协作，必须给出明确指令（例如“现在请登录”），而不是抽象表达“我会引导登录”
- 若原目标与当前成功链路不一致，必须写明偏差：原目标是否未完成、当前仅完成哪条替代链路、是否等待用户确认目标变更
- 会话态 / cookie / token / storage 快照默认必须脱敏；只允许键名、长度、哈希、前后缀、过期时间等最小验证信息
- 总结依据应围绕当前证据、路线状态与最终交付，不要写成历史任务计数或累计命中统计

## §B 条件触发段（命中 X 则补 Y）

以下均为条件触发段：仅当任务命中对应特征时才补充。`## 调用示例` 的最小说明已上提到 §A，下方关于 `## 本地复现交付` / `run/pure-*` 的条目只控制**完整本地实现是否必须产出**。

如果使用了外部搜索，还必须补充：
- 搜索触发原因
- 查询语句或查询簇
- 主要来源类型（官方 / GitHub / issue / 公开分析 / 供应商文档）
- 采纳 / 拒绝的关键线索及原因
- 这些线索如何改变 entrypoint / probe / provider 判断
- `state/external-research.md`
- `state/external-research.json`

如果发生 route-level retrospective / pivot，还必须补充：
- retrospective 触发原因
- 被降级或废弃的假说 / entrypoint
- 保留证据与作废解释
- 冻结清单
- 新主模式 / 新主专题 / 新 entrypoint 排序
- 下一轮最便宜 probe
- `run/retrospective.md`

多线路任务还必须补充：
- `route-state.json` 路径
- `route-plan` 路径
- `clues` 路径
- `progress` 路径
- 当前活跃路线
- 最近一个检查点
- 若本轮发生 retrospective / pivot，补 `run/retrospective.md`
- `execution.status`
- `execution.nextEntrypointId`
- `execution.nextExecutableAction`
- 如果允许暂停，写清 `pauseCategory / pauseReason / replyGateDecision / requiredUserAction / resumeCondition`

如果是复合场景任务，还必须补充：
- 候选切入点列表
- 本轮实际验证的切入点
- 为什么先试它
- 成功或失败的判据
- 失败后的切换理由
- 如果当前切入点集已耗尽，补一条复盘结论与新切入点

如果包含登录态 / 会话态依赖，还必须补充：
- bootstrap 状态
- 主要凭证载体：`cookie / storage / memory / worker / frame`
- 是否存在 `cookie / storage -> memory signer state` 镜像
- 刷新或续签状态
- 失效条件
- 是否必须重新登录
- 是否已经向用户明确发出“现在请登录”之类的协作提示
- 会话态是否以脱敏摘要落盘，而非原始 cookie/token
- `run/session-notes.md`

如果采用浏览器内可控复用（browser-controlled reuse），还必须补充：
- 当前为何优先选择浏览器 harness，而不是直接 pure extraction
- 浏览器版本、启动参数、拦截面与会话保持方式
- 当前验收是否已在浏览器 harness 中达成
- 当前是否已经拿到 accepted request / clear boundary / 稳定重放
- `run/browser-controlled-repro.md`
- `run/browser-repro-script.js`
- `run/browser-env-override.js`

如果包含请求签名链路，还必须补充：
- sign field 与 header / body carrier
- 参数归一化与 canonical string
- nonce / timestamp / session 混入边界
- 算法家族、`determinismMode`、`randomnessSource`、`clockSource`
- `stateDependencyStatus` 与请求验收状态
- `run/signature-input-map.md`
- `run/signature-fixtures.json`
- `run/verify-once.mjs`
- 若当前 `deliverableTier` 命中本地复现 / 纯算法提取，或 `task.json.deliveryRequirements.localReproductionRequested=true`，再补 `run/pure-sign.py`
- 若需要独立请求验收脚本，再补 `run/web-replay.js`

如果 `task.json.deliveryRequirements.localReproductionRequested=true`，还必须补充：
- 本地算法实现路径：`run/pure-*.js` 或 `pure_*.py`
- 调用示例路径：`run/local-repro-example.js`
- 运行命令、样例输入、输出摘要
- `## 本地复现交付`

如果 `task.json.deliveryRequirements.apiCallExampleRequired=true`，还必须补充：
- `run/web-replay.js`
- 该标记隐含 `localReproductionRequested=true`，因此不能缺少本地算法实现与 `run/local-repro-example.js`
- API 请求所需动态输入来源与依赖状态
- 响应打印摘要或响应样本路径
- 明确写出“该脚本用于本地 API 调用示例”

如果包含 stateful signer，还必须补充：
- signer state 键位与对应 carrier
- `carrier -> writer -> reader -> request-use` 证据链
- swap matrix 或等价验证，证明阻塞点属于 signer state 而不是泛 env
- `run/signer-state-map.md`

如果包含用户态密码实现，还必须补充：
- 库或实现家族：`CryptoJS / forge / jsrsasign / custom`
- 明文 / 编码 / 压缩 / 密码边界
- key / iv / salt / mode / padding 来源
- 明密文样本、非确定性来源、语义等价验证状态
- `run/crypto-callgraph.md`
- `run/plain-cipher-pairs.json`
- `run/pure-crypto.js`

如果包含 AST 去混淆，还必须补充：
- 混淆家族：`while(true)+switch / string array / eval(pack) / dispatcher object`
- 处理前后样本与规则说明
- AST 结果对应的运行时证据
- 未处理边界与语义置信度
- `run/before.js`
- `run/after.js`
- `run/deobf-rules.md`
- `run/ast-transform.mjs`
- `run/dead-code-analysis.md`
- `run/dead-code-eliminated.js`
- `run/dead-code-stats.json`
- `run/cff-dispatcher-var.md`
- `run/cff-block-map.json`
- `run/cff-cfg.json`
- `run/cff-deobfuscated.js`
- `run/string-array-mapping.json`
- `run/string-array-deobfuscated.js`

如果包含插桩 / hooking，还必须补充：
- preload / runtime 注入阶段
- hook surfaces 与事件覆盖范围
- tamper / anti-injection 风险
- 统一事件流样本
- `run/preload.js`
- `run/runtime-hooks.js`
- `run/hook-events.jsonl`
- `run/hook-safety-notes.md`

如果包含补环境一致性问题，还必须补充：
- `first divergence`
- 失真面：`api / descriptor / scheduler / typed-array / crypto / storage`
- 存在性判定：`present / undefined / absent / pending`
- 若命中存在性问题，说明哪些符号是“本应缺失却被误补成 present”
- 最小补丁策略
- 补丁后状态
- 未对齐项
- `run/env-drift-matrix.md`
- `run/env-conformance-notes.md`
- `run/browser-env-snapshot.json`

如果包含 source map，还必须补充：
- map 存在方式：`inline / external / hidden`
- 关键 source file 列表
- 目标函数的 source 落点
- `run/source-map-notes.md`

如果包含 Worker / Service Worker，还必须补充：
- worker 类型与脚本 URL
- Blob 来源与创建点（若命中动态 worker）
- 消息流方向和关键载荷
- 至少一条 `main thread -> worker -> output -> request field` 映射
- worker 在整体链路中的职责
- service worker fetch/caching 角色
- `run/worker-notes.md`

如果包含 frame / iframe，还必须补充：
- frame tree 状态
- target frame
- cross-frame message / token 流向
- `run/frame-notes.md`

如果包含 storage 分析，还必须补充：
- cookie / localStorage / sessionStorage / IndexedDB 摘要
- 关键键位与刷新关系
- 是否存在 storage -> signer state 镜像
- `run/storage-snapshot.json`
- `run/storage-notes.md`

如果包含 fingerprint profiling，还必须补充：
- probe order 与 detector families
- 通用指纹向量与自动化泄漏分桶
- 执行上下文：`window / iframe / worker`
- 网络绑定或 challenge 绑定关系
- **算法输入绑定：哪些指纹向量经变换后进入签名/加密/VM/WASM**
- 最小 override / patch 面与理由
- 至少记录一个 `webdriver`、`userAgentData`、`canvas`、`webgl`、`audio` 或 `fonts/timezone` 相关证据点
- `run/fingerprint-profile.json`（**必须包含 `algorithmInputs` 字段**）
- `run/fingerprint-notes.md`
- `run/fingerprint-inspector-template.js`
- `run/fingerprint-canvas-profile.json`
- `run/fingerprint-webgl-profile.json`
- `run/fingerprint-audio-profile.json`

如果包含 chunk loader / bundle loader，还必须补充：
- chunk loader 类型
- chunk 映射或 preload 顺序
- `run/chunk-loader-notes.md`
- `run/preload-orchestrator.js`

如果包含 `crypto.subtle / importKey / deriveKey / sign / digest`，还必须补充：
- key source / key carrier / key usage
- 算法参数与输入归一化
- 输出 carrier 与协议字段绑定
- `run/subtlecrypto-notes.md`
- `run/subtlecrypto-keyflow.json`

如果包含 `protobuf / msgpack / cbor / flatbuffers / 自定义二进制`，还必须补充：
- framing 边界与长度字段
- codec family 与 schema 线索
- encode / decode 路径
- `run/binary-codec-notes.md`
- `run/binary-samples.json`

如果包含 GraphQL / persisted query / APQ，还必须补充：
- transport 形态与 `/graphql` 入口
- `operationName`、document / hash、variables 边界
- persisted query / APQ 状态
- 签名、压缩或批量 transport 绑定关系
- `run/graphql-ops.json`
- `run/query-map.md`

如果包含 gRPC-Web / Connect-Web，还必须补充：
- transport 形态：`application/grpc-web / grpc-web-text / connect-web`
- 方法名、frame boundary、trailers 与 `grpc-status`
- schema / proto 恢复状态
- `run/grpc-frame-notes.md`
- `run/grpc-schema-map.md`
- `run/grpc-replay.js`

如果包含 `CompressionStream / DecompressionStream / gzip / brotli / deflate`，还必须补充：
- 压缩前明文边界
- 压缩算法与顺序
- 压缩后 carrier
- `run/compression-stream-notes.md`
- `run/compression-samples.json`

如果包含 `remoteEntry.js / __webpack_init_sharing__ / container.get / share scope`，还必须补充：
- remoteEntry 与 share scope 状态
- remote module 列表
- 远程运行时与本地 chunk loader 的边界
- `run/module-federation-notes.md`
- `run/remote-entry-map.json`

如果包含微前端运行时，还必须补充：
- loader 类型：`System.import / importmap / single-spa / qiankun / custom remote loader`
- host 与 subapp 装载顺序
- 共享依赖、sandbox、路由切换与 remote manifest
- `run/runtime-map.json`
- `run/remote-deps.md`

如果包含多上下文协同，还必须补充：
- contexts 列表与角色
- `BroadcastChannel / storage event / SharedArrayBuffer / Atomics / Worklet` 通道
- 事件时序、共享状态与 message graph
- `run/context-map.md`
- `run/message-graph.json`

如果包含 `ReadableStream / TransformStream / TextDecoderStream / 增量解码`，还必须补充：
- source / transform / sink 管线
- chunk boundary / flush 时机
- 首个稳定业务 stage
- `run/streaming-runtime-notes.md`
- `run/stream-pipeline.json`

如果包含 challenge token / challenge routing / captcha / turnstile / risk route，还必须补充：
- challenge 类型
- 状态机与 decision points
- token carrier / refresh / fallback
- `run/challenge-route-notes.md`
- `run/challenge-state-machine.json`
- `run/commercial-protection-identification.json`
- `run/commercial-protection-notes.md`

如果包含 `navigator.credentials / PublicKeyCredential / webauthn.create / webauthn.get`，还必须补充：
- ceremony 类型：registration / authentication
- challenge、rpId、credential 绑定
- 真实认证器依赖与 synthetic 边界
- `run/credential-flow.md`
- `run/request-response-samples.json`

如果包含行为遥测 / mousemove / scroll cadence / visibilitychange / input rhythm，还必须补充：
- telemetry channel 列表
- 采样 / 归一化 / 上报边界
- challenge 或请求绑定点
- `run/behavior-telemetry-notes.md`
- `run/telemetry-profile.json`

如果包含完整性 / Trusted Types / CSP / SRI / hook seal，还必须补充：
- integrity surface
- sink protection 与 hook resistance
- 最小 patch 面与残余模式
- `run/anti-tamper-notes.md`
- `run/integrity-surface.json`

如果包含媒体 DRM / EME，还必须补充：
- `MediaSource / encrypted event / requestMediaKeySystemAccess` 边界
- manifest、license request 与 token 输入
- 真实受保护内容限制与验证路径
- **验证层级声明**：必须明确标注当前验证到了哪一层（容器层/流层/内容层）
- `run/license-flow.md`
- `run/token-inputs.json`

如果任务模式为内容解密 / 帧明文边界恢复（模式 B），还必须补充：
- **验收边界声明**：
  - 容器可识别（`ffprobe` 可读、`0x47` sync byte）≠ 内容已解密
  - 流层无报错（`updateend` 触发）≠ 视频帧已还原
  - 内容层验证（首帧正常渲染、音频正常播放）= 解密成功
  - 必须记录实际验证手段：`requestVideoFrameCallback` / `canvas.drawImage` / `AudioContext.decodeAudioData` / `MediaRecorder`
- 加密模式识别：`HLS Sample-AES / DASH CENC / CBCS / ClearKey / 非 CDM`
- 密钥来源与密钥派生链路
- 黑盒复用方案与验证结果（`requestVideoFrameCallback / canvas / MediaRecorder`）
- 明文边界定位过程：`keyStatus usable` -> `appendBuffer` -> 解码器输出
- EME 事件时间线：`encrypted` -> `generateRequest` -> `keystatuseschange` -> `update`
- `run/frame-decryption-chain.md`
- `run/key-session-timeline.json`
- `run/clear-frame-samples/`
- 命中 JSVMP 时：`run/vm-trace.jsonl` 与 `run/vm-decode-notes.md`
- 命中 WASM 非 CDM 路径时：`run/wasm-imports-exports.json`
- 验证脚本：`run/verify-decryption.mjs`

如果包含 `Next.js / Nuxt / Remix / Vite / SvelteKit / Astro / __NEXT_DATA__ / import.meta / modulepreload / islands / hydration`，还必须补充：
- runtime kind 与渲染模式
- payload carrier 与 hydration boundary
- `modulepreload` / islands / partial hydration 边界
- framework runtime 与业务入口边界
- `run/framework-runtime-notes.md`
- `run/framework-payload-map.json`

如果包含 `WebSocket / SSE / WebTransport / datagram / stream / 二进制协议`，还必须补充：
- 传输类型与入口
- 心跳 / 握手 / 业务消息区分
- `WebTransport` datagram / stream 边界
- 消息 schema 或字段归纳
- 帧样例与编码判断
- `run/protocol-notes.md`
- `run/websocket-frame-notes.md`
- `run/web-replay.js`
- `run/tls-http-fingerprint-notes.md`
- `run/tls-http-fingerprint-profile.json`

如果包含 WebRTC / DataChannel，还必须补充：
- `RTCPeerConnection / createOffer / ICE / RTCDataChannel` 边界
- signaling channel 与业务 channel 区分
- channel label、token 绑定与网络依赖
- `run/signaling-map.md`
- `run/channel-frames.jsonl`

如果包含 Beacon / Reporting，还必须补充：
- `sendBeacon / ReportingObserver / report-to` 通道
- `visibilitychange / pagehide / unload` 触发阶段
- fallback 路线与 payload 分类
- `run/beacon-log.jsonl`
- `run/reporting-map.md`

如果包含动态代码执行，还必须补充：
- 动态执行面：`eval / Function / string-timer / dynamic import / blob-script / worker`

## Composite Entrypoint Reporting

如果任务是复合场景，`report.md` 必须显式包含 `## 切入点循环`（或 `## Entrypoint Loop`）段，并至少写清：

- 候选切入点列表
- 本轮实际验证的切入点
- 为什么先试它
- 当前切入点的成功 / 失败判据
- 至少一个具体 `EP-*` 标识
- 如果发生切换、停放或耗尽，补充切换理由或复盘结论
- 明文捕获状态或解包失败边界
- 解码边界与执行边界
- 离线沙箱状态
- 动态代码 artifact 路径
- `run/dynamic-code-capture-template.js`
- `run/dynamic-code-notes.md`

如果包含 WASM，还必须补充：
- 加载方式：`instantiate / instantiateStreaming / wrapper`
- glue 类型：`emscripten / wasm-bindgen / custom`
- imports / exports 概要
- 关键线性内存边界
- `run/wasm-analysis.wat`
- `run/wasm-imports-exports.json`
- `run/wasm-notes.md`
- `run/wasm-section-analysis.md`
- `run/wasm-data-segments.json`
- `run/wasm-algorithm-identification.md`
- `run/wasm-memory-layout.md`
- `run/wasm-binary-samples/`
- **`run/wasm-protection-bypass.md`**（若 WASM 受加密/压缩保护）
- **WASM 环境值交互点**（若 WASM 通过 imports/glue 读取环境）

如果命中 WASM + JSVMP 混合，额外补充：
- `run/wasm-jsvmp-bridge.md`

如果包含 `JS-VMP / 自定义 VM`，还必须补充：
- `VM boundary`
- dispatcher / handler table 定位结果
- opcode 完整度或覆盖率说明
- 至少一条 `pc -> opcode` 真实轨迹
- 未确认 handler 清单
- `run/vm-opcodes.txt`
- `run/dispatcher-map.md`
- **`run/vm-env-reads.json`**（VM 中的环境值读取分析）
- `run/vm-opcode-patterns.json`
- `run/vm-dataflow-analysis.json`
- `run/vm-algorithm-identification.md`
- `run/vm-lifted-semantics.js`
- `run/vm-semantic-verification.md`

如果命中动态字节码或嵌套 VM，额外补充：
- `run/vm-bytecode-lifecycle.md`
- `run/vm-nesting-map.md`

如果当前交付还要求把案例沉淀成**可迁移模板 / SOP / checklist / tooling baseline**，额外补充：
- `run/vm-template-profile.json`
- 模板里必须区分：`engine / payload / runtime config / host dependency / output`
- 不得把站点私有常量、固定指纹值、cookie 公式直接写死进通用模板

如果命中 VMP + WASM 混合，额外补充：
- `run/wasm-jsvmp-bridge.md`

如果 `vm.triageResult=blackbox`，则走 VM 黑盒减免路线：

- 仍必须写清 `VM boundary`
- 必须写清 `blackboxApi`、输入输出契约、验收结果
- 必须在 `report.md` 标注“黑盒复用边界”
- 可免除深拆交付：
  - `run/vm-opcodes.txt`
  - `run/dispatcher-map.md`
  - `run/vm-trace.jsonl`
  - `run/vm-handler-clusters.md`
  - `pc -> opcode` 轨迹与 opcode coverage 要求

如果包含浏览器反调试，还必须补充：
- 反调试模式清单
- 注入时机：`preload / runtime / breakpoint`
- 注入脚本或模板路径
- 已绕过模式
- 未解决模式
- 绕过后回到的目标链路
- `run/anti-debug-preload.js`
- `run/anti-debug-runtime.js`

如果包含环境值参与算法运算（env-as-algorithm-input），还必须补充：
- 所有识别到的环境读取点清单
- 每条读取点的变换链摘要
- 消费目标分类：`sign / crypto / wasm / vm / control-flow / network`
- 单点/正交验证结果
- 敏感度矩阵
- `run/env-as-algorithm-input.md`
- `run/env-algorithm-input-map.json`

如果命中多层保护组合（composite protection），还必须补充：
- 保护层级图
- 触发顺序 timeline
- 层间依赖关系
- 状态共享点
- 破环策略和已执行的绕过
- 残余风险和未解层级
- `run/composite-protection-map.md`

如果采用浏览器内可控复用（browser-controlled reuse），还必须补充：
- 浏览器配置（版本、启动参数、插件）
- 环境覆盖清单
- 执行流程脚本路径
- 稳定性评估
- 与黑盒/纯算法的衔接计划
- `run/browser-controlled-repro.md`
- `run/browser-repro-script.js`
- `run/browser-env-override.js`

## Closeout Evidence

任务结案或阶段转移时，必须给出可验证的收尾证据：

- `deliveryAdoptionStatus`
- `acceptancePath`：哪个脚本 / harness / verify 真实参与了最终验收
- `usedArtifacts`：哪些交付物被最终成功链路实际使用
- `unusedArtifacts`：哪些只是探索产物，不应冒充主交付
- 已交付的脚本、报告、数据是否实际采纳
- 采纳后影响了哪条路线（原目标 / 替代链路 / 新发现链路）
- 若未采纳，写明阻塞原因与下一步建议
- 所有 `UNKNOWNS` 项是否已转移到 `run/retrospective.md` 或下一路线计划
- 若当前已经 `delivered` 且完成 `task-close`，不要再机械保留一个空泛“下一步继续优化”
