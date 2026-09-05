# JSVMP Advanced Playbook

适用场景：

- 多层 VM / VM + WASM
- bytecode decode 链超过一层，且解码逻辑掺杂反调试或动态代码
- dispatcher 与 handler table 被拆散、代理、内联或按需生成
- 需要把“能看到 trace”推进到“能稳定去虚拟化”

## 前置条件

本 playbook 仅在 VM 分流结论为 `deep-analysis` 时使用。若 VM 可被黑盒复用，不进入本流程。
执行前先确认 `route-state.json.vmTriage.triageResult=deep-analysis`。

## 1. 目标

这个专项不是为了“快速猜几个 opcode”，而是为了建立可复跑、可验证、可交付的去虚拟化主骨架：

1. 找到 VM boundary
2. 固定 bytecode decode 链
3. 采集 dispatcher / handler / bridge 运行时证据
4. 建立 opcode book 与 handler 分类
5. 记录 UNKNOWNS 与退出门槛

## 2. 误判排查

遇到以下结构时，不要直接下 VM 结论：

- 只有 CFG 扁平化，没有字节码载荷
- 只有大型 switch，没有独立状态对象
- 只有状态机，没有 opcode -> handler table
- 只有解释风格调用，没有稳定的 pc / stack / regs 语义

先完成 `误判排查`，再升级到 `T4 / T6 / T7`。

## 3. bytecode decode 链

必须确认：

- 原始载荷来自哪里：常量、远端请求、动态拼接、WASM 返回值
- decode 链每一层做了什么：base64 / xor / inflate / table-lookup / delta / custom unpack
- 进入 VM 前的最终 bytecode 形态：`string / Uint8Array / Array / DataView`
- decode 结果是否稳定，是否依赖浏览器环境或一次性种子

交付要求：

- `run/vm-decode-notes.md`
- `run/vm-trace.jsonl` 中至少一条 decode 相关样本

## 4. dispatcher 追踪

按优先级插桩：

1. bytecode decode 出口
2. dispatcher 入口
3. handler 入口
4. bridge / host call
5. return / trap / exception

至少保留两类信号：

- `pc / opcode`
- `stack delta / regs read-write / bridge in-out`

## 5. handler 分类

先按骨架分，不要一开始就按业务命名：

- control: `jmp / jcc / call / return / throw`
- data: `push / load / store / move / const`
- object: `getprop / setprop / define / delete`
- invoke: `call / apply / new / bridge`
- arithmetic: `add / sub / mul / xor / cmp`

交付要求：

- `run/vm-handler-clusters.md`
- `run/vm-opcodes.txt`

## 6. 多层 VM / VM + WASM

若命中 `多层 VM / VM + WASM`：

- 外层先拆 boundary，不要试图一次性贯穿全部层级
- 每一层单独产出 decode / dispatcher / bridge 证据
- 如 VM 调 WASM：先保留 JS 侧 call bridge，再去确认 wasm imports/exports
- 如 WASM 回填 VM 状态：先记录线性内存边界，再回看 opcode 语义

### VM+WASM 卡住时的强制推进协议（新增）

当出现“长时间无进展 / 同层 hook 循环 / 不断换低层 surface”时，必须强制执行：

1. **默认两轮上限**：同一语义层默认连续两轮没有新增 `decode/dispatcher/bridge/request-use` 验收证据，当前切入点标记为 `PARKED` 或 `EXHAUSTED`
   - 若当前 VM microRoute 已开启 `deepDivePermit`，则改为：当前 microRoute 连续两轮没有新增高价值证据，或达到 `maxRounds / exitCondition`
   - permit 场景默认只停当前 microRoute，不直接停掉整个 VM 专题
2. **跨层 pivot**：下一轮必须跨层推进（例如 `decode -> dispatcher`、`dispatcher -> wasm bridge`、`wasm bridge -> request-use`）
3. **permit 续期条件**：只有当当前微路线持续产出 `handler clustering / dispatcher semantics / bridge mapping / direct-call / request-use bridge` 这类高价值证据时，才允许续期
4. **最小闭环目标**：本轮至少补齐下面链路中的一个缺口：  
   `bytecode decode -> dispatcher -> wasm imports/exports -> memory bridge -> request-use`
5. **禁止假推进**：`document.cookie / script.src / appendChild / setAttribute` 之间切换不算有效 pivot

## 7. 退出门槛

达到以下条件后，才允许进入更高层语义提升或 pure extraction：

- 已确认 `VM boundary`
- 已确认 `bytecode decode 链`
- 已有可复跑的 dispatcher trace
- 已产出最小 opcode book
- 已把未确认部分写入 `UNKNOWNS`

这就是 JSVMP 专项的 `退出门槛`。
