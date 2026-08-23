# 通用 VM 逆向模板

适用场景：需要把单一案例（如商业保护、指纹型 JS-VMP、自定义解释器）沉淀成**可迁移**的方法论时使用。  
适合以下目标：

- 自定义解释器 / dispatcher / opcode / handler table
- 字节码 + 常量池 + 动态配置组合保护
- 环境指纹深度参与算法计算
- 输出为 `cookie / sign / token / body / challenge answer`
- VM 与 `WASM / 动态代码 / Worker / anti-debug` 混合

不适合：

- 仅普通压缩/重命名、无 VM 特征的场景
- 纯黑盒复用已足够验收，且用户并不要求沉淀模板

---

## 使用方式

当你命中 `T4 / T6 / T7`，且用户诉求不是“只要当前站点过掉”，而是：

- 沉淀通用方法
- 给团队形成 SOP / checklist
- 为后续 VM 项目复用工具链
- 需要把案例抽象成模板 / playbook

先读本文件，再按需进入：

- `scripts/cases/web-vm-generic-template-workflow.mjs`
- `references/vmp-playbook.md`
- `references/vmp-dynamic-bytecode-playbook.md`
- `references/vmp-semantic-lifting-playbook.md`
- `references/wasm-jsvmp-bridge-playbook.md`
- `references/env-conformance-playbook.md`
- `references/fingerprint-playbook.md`

---

## 核心迁移原则

从单案例沉淀到通用模板时，优先迁移以下内容：

1. **边界定位法**：字节码/配置从哪来，解释器从哪进，结果写到哪去
2. **运行时取证法**：先看它实际访问什么、依赖什么、输出什么
3. **固定骨架 vs 动态载荷拆分法**：引擎、payload、runtime config、host dependency、output 分层
4. **最小补环境法**：按真实访问补，不做“大而全伪浏览器”
5. **first-difference 修补法**：浏览器与本地双跑，优先修第一处分叉
6. **结构锚点匹配法**：优先用 AST / 调用形态 / 常量锚点 / 数据流，不依赖混淆名

不要把以下内容误当作“通用模板”：

- 具体字段名、变量名、正则锚点
- 某一站点私有 cookie 公式
- 某代保护的固定字符串洗牌规则
- 写死的 Canvas / WebGL / UA / timezone 指纹值

这些都应视为**案例材料**，不是模板本体。

---

## 一、任务输入卡

进入实际分析前，至少补齐：

```md
# Task Card
- target:
- objective: 还原 sign / cookie / token / body / challenge / 协议
- entry_url:
- protected_api:
- expected_output:
- carrier:
  - inline script:
  - external js:
  - worker:
  - wasm:
  - dynamic code:
- constraints:
  - 只做浏览器侧 / 允许 Node / 允许 Python
  - 只要本地复现 / 还要纯算法提取
  - 是否允许浏览器可控复用
```

---

## 二、防护定级

```md
T0 仅压缩
T1 重命名 / 死代码
T2 字符串加密 / CFG 扁平化
T3 eval-pack / 动态拼接代码
T4 JS-VM / 自定义 VM
T5 WASM 核心
T6 VM + WASM 混合
T7 多层嵌套混合防护
```

定级后必须回答：

- VM boundary 在哪
- dispatcher / handler table 是否存在
- bytecode / payload / runtime config 从哪来
- 输出写到哪里
- 宿主依赖有哪些
- 是否存在 `anti-debug / anti-tamper / fingerprint / worker / wasm bridge`

---

## 三、通用六阶段工作流

### Phase A - Observe

目标：先拿完整边界图，不先死磕 handler 语义。

最低要回答：

- 入口函数是谁
- 输出点在哪
- 是否经过 `eval / Function / dispatcher / wasm export`
- 哪些 API 被高频访问
- 哪些对象是 VM state / env bridge / output builder

建议产物：

- `notes/boundary-map.md`
- `notes/request-flow.md`
- `notes/output-sinks.md`

### Phase B - Capture

目标：先记录“它实际碰了什么”，再考虑本地复现。

至少记录：

- 属性读取
- 方法调用
- 参数 / 返回值 / 异常
- `document.cookie / storage / network` 写入
- `setTimeout / Promise / queueMicrotask` 调度
- `eval / Function / blob script / dynamic import`

建议产物：

- `capture/api-trace.jsonl`
- `capture/cookie-trace.jsonl`
- `capture/network-trace.jsonl`
- `capture/dynamic-code-trace.jsonl`

### Phase C - Rebuild

目标：建立**最小宿主环境**，不是构建完整浏览器。

建议按层补：

1. 基础对象：`window / document / navigator / location`
2. 存储：`cookie / localStorage / sessionStorage / indexedDB`
3. 时间随机：`Date / performance / Math.random`
4. 图形：`canvas / webgl / audio`
5. 调度：`setTimeout / Promise / microtask`
6. 网络：`fetch / xhr / websocket`
7. 类型系统：`instanceof / constructor / toString / prototype`

建议产物：

- `env/base.js`
- `env/storage.js`
- `env/timer.js`
- `env/graphics.js`
- `env/prototype.js`

### Phase D - Patch

目标：修第一处偏差，不做无边界泛补环境。

高频分叉：

- getter 值不一致
- `instanceof` / `constructor` 失败
- `toStringTag` / 原型链不一致
- Promise / Timer 时序不同
- 图形指纹返回形态不同
- cookie 读写行为不同
- 动态代码没有正确落地
- runtime config / 字符串表解析错误

建议产物：

- `notes/divergence-log.md`
- `run/verify-once.mjs`

### Phase E - PureExtraction

目标：把“能跑”沉淀为“能稳定复现核心算法/链路”。

至少拆出：

- `engine`
- `payload`
- `runtime config`
- `host dependency`
- `output builder`

注意：**不要求默认完整反虚拟化所有 opcode**。  
很多项目只需要还原：

- 输入边界
- 关键 handler
- 宿主依赖
- 输出拼装链
- 校验点

建议产物：

- `run/vm-opcodes.txt`
- `run/vm-trace.jsonl`
- `run/dispatcher-map.md`
- `run/pure-core.js`
- `run/pure_*.py`（可选）

### Phase F - Port

目标：以后遇到同类目标，尽量做到“换配置，不重搭框架”。

建议抽象：

```json
{
  "loader_pattern": "",
  "entry_call_pattern": "",
  "dynamic_param_extractors": [],
  "cookie_keys": [],
  "env_profile": "pc-chrome",
  "graphics_profile": "fixed-webgl-min",
  "time_strategy": "real|fixed|captured",
  "random_strategy": "real|captured|seeded"
}
```

---

## 四、VM 专项记录模板

```md
# VM Notes

## VM Boundary
- interpreter entry:
- dispatcher:
- handler table:
- bytecode source:
- decode path:

## Runtime State
- pc:
- opcode:
- stack:
- regs:
- const pool:
- ctx/global:

## Host Bridges
- VM -> DOM:
- VM -> Cookie:
- VM -> Network:
- VM -> Canvas/WebGL:
- VM -> Storage:

## Key Outputs
- output builder:
- checksum:
- timestamp/random source:
- final serialization:
```

如果命中环境值参与算法，再补：

```md
## Env as Input
- env-read points:
- env-transform chains:
- env-consume targets:
- swap validation:
```

---

## 五、推荐借鉴的工具思路

这里借鉴的是**工具思路与工作流位置**，不是照搬案例脚本。

### 1. 全量 DOM / API Trace

最值得借鉴。  
优先记录“它访问了什么”，再决定补什么。

适用：

- 不清楚保护依赖哪些宿主能力
- 目标 heavily 依赖 DOM/BOM/Canvas/WebGL
- 静态阅读被字符串洗牌/动态名/VM 包裹阻塞

推荐沉淀为：

- `tools/vm/trace-runtime.mjs`
- `capture/api-trace.jsonl`

### 2. Node `vm.createContext()` 沙箱执行

适合把浏览器证据搬到 Node 本地 replay。

适用：

- 想快速验证本地补环境
- 想把原始 bundle / worker / loader 放进隔离上下文跑
- 想做自动化回归验证

推荐沉淀为：

- `tools/vm/replay-vm.mjs`
- `run/verify-once.mjs`

### 3. 固定样本 / 固定响应

没有固定样本，就没有稳定分析基线。

适用：

- 每次刷新都会变动态配置、字符串表、种子
- 需要比较浏览器与本地差异
- 需要写动态匹配器

推荐沉淀为：

- `run/fixtures.json`
- `notes/sample-baseline.md`

### 4. 动态匹配器

不要默认依赖变量名；优先匹配：

1. 结构锚点
2. 调用形态
3. 常量锚点
4. 数据流关系
5. AST 结构

推荐沉淀为：

- `tools/match-anchor.js`
- `tools/extract-dynamic.js`
- `artifacts/tasks/_TEMPLATE/run/vm-template-profile.json`

### 5. first-difference 差分工具

浏览器真跑一次，本地跑一次，找第一处分叉。

推荐沉淀为：

- `tools/vm/diff-run.mjs`
- `notes/divergence-log.md`

---

## 六、工具借鉴边界

以下内容可以借鉴，但必须配置化，不要写死：

- Canvas / WebGL / Audio profile
- UA / timezone / screen / language profile
- cookie key 提取器
- 动态参数定位正则

以下内容不建议作为通用模板固化：

- 某站点私有字段名
- 某一代保护私有索引规则
- 写死的图形 base64 / 扩展列表 / 哈希值
- 只能服务单站点的正则锚点

---

## 七、统一目录模板

```txt
artifacts/tasks/<task-id>/
├─ report.md
├─ capture/
│  ├─ api-trace.jsonl
│  ├─ cookie-trace.jsonl
│  ├─ network-trace.jsonl
│  └─ dynamic-code-trace.jsonl
├─ env/
│  ├─ base.js
│  ├─ storage.js
│  ├─ timer.js
│  ├─ graphics.js
│  └─ prototype.js
├─ notes/
│  ├─ boundary-map.md
│  ├─ dispatcher-map.md
│  ├─ divergence-log.md
│  └─ handler-notes.md
└─ run/
   ├─ verify-once.mjs
   ├─ fixtures.json
   ├─ replay.js
   ├─ vm-opcodes.txt
   ├─ vm-trace.jsonl
   └─ pure-core.js
```

---

## 八、最小验收清单

```md
[ ] 能稳定定位 interpreter / dispatcher / output sink
[ ] 能说明 bytecode / payload / runtime config 来源
[ ] 能记录关键宿主 API 依赖
[ ] 能跑通至少一条核心路径
[ ] 能解释最终输出的组成
[ ] 能说明哪些值固定、哪些值动态
[ ] 能指出最小补环境集合
[ ] 能在至少 3 组样本上复现
```

---

## 九、落地顺序建议

如果当前任务既要“过验收”，又要“沉淀模板”，优先级如下：

1. 先完成当前验收最短链路
2. 再回收边界、轨迹、差分记录
3. 再抽象出通用模板
4. 最后才沉淀可复用工具

不要为了写模板而阻塞当前任务验收。
