# References 索引

> **目录区分速记：**
> - `docs/reference/` = **治理层**（policy/contract）：执行协议、交付梯度、成熟度模型、schema 迁移——定义"怎么执行、怎么判断"
> - `references/`（本目录）= **知识层**（playbook/knowledge）：专题 playbook、深水区分析、代码片段、操作模板——提供"具体怎么做"
> - 执行宪法级规则在 `SKILL.md`；结构化契约在 `topics/*/topic.json`
> - **引用前缀约定**：本表中跨 `docs/reference/` 的引用一律用 `../docs/reference/` 前缀，同目录 playbook 用裸名。

本目录包含 web-reverse 技能的参考手册、playbook、模板与搜索纠偏协议。
说明：部分**规范性协议文档**已迁移到 `docs/reference/` 作为 canonical source，本目录主要保留专题 playbook、桥接文档与操作模板。

如果你是第一次进入本 skill，推荐先读：

1. `../docs/reference/reverse-bootstrap.md`
2. `../docs/reference/reverse-workflow.md`
3. `../docs/reference/first-response-contract.md`
4. `../docs/reference/deliverable-ladder.md`
5. 再按当前主专题进入本目录对应 playbook

## 核心执行协议

| 文档 | 说明 |
|------|------|
| `../docs/reference/first-response-contract.md` | 首轮压缩协议 |
| `../docs/reference/deliverable-ladder.md` | 任务模式 / 交付梯度 |
| `../docs/reference/topic-selection-policy.md` | 主专题 / 辅助专题预算策略 |
| `../docs/reference/retrospective-protocol.md` | retrospective / pivot 协议 |
| `../docs/reference/claim-hygiene.md` | 结论卫生与 claim level |
| `../docs/reference/reverse-bootstrap.md` | 最小启动协议（新任务/续跑） |
| `../docs/reference/reverse-workflow.md` | 执行协议（阶段、回复纪律、entrypoint loop） |
| `../docs/reference/auto-advance-protocol.md` | 自动推进协议 |
| `../docs/reference/output-contract.md` | 输出契约与交付物规范（canonical；本目录同名文件仅为兼容 stub） |
| `websearch-escalation-playbook.md` | 外部搜索纠偏协议 |
| `hypothesis-governance-playbook.md` | 假说治理 / 样本防过拟合协议 |

## 专题 Playbook

### 混淆与反混淆
| 文档 | 对应专题 | 说明 |
|------|---------|------|
| `ast-deobfuscation.md` | ast-deobfuscation | AST 去混淆基础 |
| `control-flow-flattening-playbook.md` | ast-deobfuscation | 控制流平坦化还原 |
| `string-array-deobfuscation-playbook.md` | ast-deobfuscation | 字符串数组混淆还原 |
| `dead-code-elimination-playbook.md` | ast-deobfuscation | 死代码消除 |
| `dynamic-code-playbook.md` | dynamic-code | 动态代码 / 自解包分析 |
| `source-map-playbook.md` | source-map | Source map 还原 |

### VM / WASM
| 文档 | 对应专题 | 说明 |
|------|---------|------|
| `vm-generic-reverse-template.md` | jsvmp/wasm/env | 从单案例沉淀为可迁移 VM 模板的通用方法论 |
| `vmp-playbook.md` | jsvmp | JS-VMP 基础分析 |
| `vmp-advanced-playbook.md` | jsvmp | VMP 高级分析（多层/嵌套） |
| `vmp-semantic-lifting-playbook.md` | jsvmp | VMP 语义提升与算法识别 |
| `vmp-dynamic-bytecode-playbook.md` | jsvmp | 动态字节码分析 |
| `vmp-instrumentation-snippets.md` | jsvmp | VMP 插桩代码片段 |
| `wasm-runtime-playbook.md` | wasm | WASM 运行时分析 |
| `wasm-binary-analysis-playbook.md` | wasm | WASM 二进制深度分析 |
| `wasm-jsvmp-bridge-playbook.md` | jsvmp/wasm | WASM + JSVMP 混合链路 |
| `hypothesis-governance-playbook.md` | 多专题 | 局部样本、算法识别、direct-call、停损治理 |

### 环境与指纹
| 文档 | 对应专题 | 说明 |
|------|---------|------|
| `env-conformance-playbook.md` | env | 环境一致性 / 补环境 |
| `env-as-algorithm-input-playbook.md` | env/fingerprint | 环境值作为算法输入 |
| `env-drift-decision-tree.md` | env | 环境漂移决策树 |
| `env-patching.md` | env | 环境补丁策略 **（bridge stub，规范见 `../docs/reference/env-patching.md`）** |
| `node-env-rebuild.md` | env | Node 补环境执行清单（Proxy 探测骨架 / jsdom 铺底 / Node 侧反检测对齐补丁） |
| `fingerprint-playbook.md` | fingerprint | 浏览器指纹分析 |
| `fingerprint-deep-vectors-playbook.md` | fingerprint | Canvas/WebGL/Audio 深度分析 |

### 签名与加密
| 文档 | 对应专题 | 说明 |
|------|---------|------|
| `signature-playbook.md` | signature | 请求签名还原 |
| `userland-crypto-playbook.md` | userland-crypto | 用户域加密分析 |
| `subtlecrypto-playbook.md` | subtlecrypto | Web Crypto API 分析 |
| `challenge-orchestration-playbook.md` | challenge-orchestration | 挑战编排 / 令牌路由 |
| `captcha-slider-playbook.md` | challenge-orchestration | 滑块/点选/旋转验证码密文还原（GeeTest/数美/顶象/百度/易盾），配套 `scripts/captcha/*` |
| `algorithm-selfcheck-playbook.md` | signature/env | 控制变量算法自检 + 双闸门（`scripts/verify/verify-algo.py` / `verify-offline.py`） |

### 保护与检测
| 文档 | 对应专题 | 说明 |
|------|---------|------|
| `anti-debug-playbook.md` | anti-debug | 反调试绕过 |
| `anti-debug-injection-guide.md` | anti-debug | 反调试注入指南 |
| `anti-debug-snippets.md` | anti-debug | 反调试代码片段 |
| `anti-tamper-playbook.md` | anti-tamper | 完整性校验 / 防篡改 |
| `composite-protection-playbook.md` | 多专题 | 组合保护分析 |
| `composite-triage-playbook.md` | 多专题 | 复合场景分诊 |
| `commercial-protection-playbook.md` | 多专题 | 商业保护方案识别 |

### 协议与传输
| 文档 | 对应专题 | 说明 |
|------|---------|------|
| `protocol-playbook.md` | protocol | 协议还原 |
| `binary-codec-playbook.md` | binary-codec | 二进制编解码 |
| `compression-stream-playbook.md` | compression-stream | 压缩流分析 |
| `graphql-rpc-playbook.md` | graphql-rpc | GraphQL RPC 分析 |
| `grpc-web-playbook.md` | grpc-web | gRPC-Web 分析 |
| `tls-http-fingerprint-playbook.md` | protocol | TLS/HTTP 指纹分析 |

### 运行时与上下文
| 文档 | 对应专题 | 说明 |
|------|---------|------|
| `worker-playbook.md` | worker | Worker 分析 |
| `worker-analysis-checklist.md` | worker | Worker 参数分层 / Blob 创建链 / 消息映射 checklist |
| `frame-playbook.md` | frame | iframe 分析 |
| `cross-context-coordination-playbook.md` | cross-context-coordination | 跨上下文协调 |
| `bundle-loader-playbook.md` | bundle-loader | Bundle 加载器分析（定位目标 module id） |
| `closure-extraction-playbook.md` | bundle-loader/env | **扣代码主链**：webcrack unbundle + webpack 运行时劫持 dump 模块 + 递归抽依赖闭包 + 最小 require shim + 扣/不扣阈值 + handoff 补环境 |
| `framework-runtime-playbook.md` | framework-runtime | 框架运行时分析 |
| `module-federation-playbook.md` | module-federation | 模块联邦分析 |
| `microfrontend-runtime-playbook.md` | microfrontend-runtime | 微前端运行时 |
| `streaming-runtime-playbook.md` | streaming-runtime | 流式运行时 |

### 浏览器可控复用与搜索纠偏
| 文档 | 说明 |
|------|------|
| `browser-controlled-reuse-playbook.md` | 浏览器可控复用策略 |
| `../docs/reference/search-decision-policy.md` | 搜索与浏览器 harness 的位阶关系 |
| `websearch-escalation-playbook.md` | 外部搜索纠偏策略 |
| `browser-controlled-templates/puppeteer-stealth-base.mjs` | Puppeteer 基础模板 |
| `browser-controlled-templates/playwright-stealth-base.mjs` | Playwright 基础模板 |
| `browser-controlled-templates/preload-hook-template.js` | Preload Hook 模板 |

### 插桩与取证
| 文档 | 说明 |
|------|------|
| `browser-mcp-capability-map.md` | **工具无关执行层**：把方法论需要的能力映射到 chrome-devtools / js-reverse / stealth-browser / 通用 CDP 的具体 API + fallback（任何浏览器 MCP 用户必读） |
| `instrumentation.md` | 插桩通用参考 |
| `hooks.md` | Hook 技术参考 |
| `replay.md` | 请求重放 |
| `local-rebuild.md` | 本地重建 |

### 其他
| 文档 | 说明 |
|------|------|
| `automation-entry.md` | 新任务自动化入口：开局动作清单 + Startup Gate（task-local 初始化与 resume 判定的执行约束） |
| `ctf.md` | CTF 场景 |
| `deobf.md` | 通用去混淆 |
| `fallbacks.md` | 降级策略 |
| `media-drm-playbook.md` | 媒体 DRM |
| `session-lifecycle-playbook.md` | 会话生命周期 |
| `storage-playbook.md` | 存储分析 |
| `video-frame-decryption-playbook.md` | 视频帧解密 |
| `webauthn-passkey-playbook.md` | WebAuthn / Passkey |
| `webrtc-datachannel-playbook.md` | WebRTC 数据通道 |
