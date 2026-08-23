<!-- publish: framework -->
# Topic Selection Policy

专题越多，不代表路线越强；常见问题恰恰是专题泛滥、参考资料过载、主线失焦。

## 默认预算

- `1` 个主专题
- `0~2` 个辅助专题
- 只有明确命中组合保护、跨上下文协同、或混合运行时时，才扩到 `3+`

## 选择顺序

1. 先看验收边界
2. 再看当前活跃 entrypoint 位于哪一层
3. 再决定主专题
4. 辅助专题只补当前 probe 所需上下文

## 加载顺序

1. `topics/<topic>/topic.json`
2. 该 topic 指向的 `references/*playbook.md`
3. `docs/reference/*` 中和当前模式直接相关的协议
4. 只有卡住时才翻 `capability-matrix.md` / `topic-route-matrix.json`

## 何时需要重选专题

- feature bundle 明显变化
- entrypoint 已切到完全不同的语义层
- retrospective 认为原主专题只是在“解释现象”，不是“缩短到交付”
- 辅助专题默认已经连续两轮不再提供新证据，应主动移出当前预算；若辅助专题下某条 VM / WASM / 混淆 microRoute 已开启 `deepDivePermit`，则先按 permit 的 `maxRounds / exitCondition / highValueEvidence` 判断

## 一个健康的专题预算示例

- 签名问题：`primary=signature`，`secondary=session,instrumentation-hooking`
- 媒体内容层验证：`primary=media-drm`，`secondary=wasm,worker`
- 组合保护但当前只追 request-use：`primary=signature`，`secondary=anti-debug,challenge-orchestration`

关键点：
- 不是“哪个专题最酷就挂哪个”
- 而是谁最直接服务当前活跃 entrypoint 与当前交付梯度

## 禁止动作

- 一上来通读所有 `references/`
- 同时把多个辅助专题都当成主线推进
- 用“多专题全开”掩盖主模式不清楚
