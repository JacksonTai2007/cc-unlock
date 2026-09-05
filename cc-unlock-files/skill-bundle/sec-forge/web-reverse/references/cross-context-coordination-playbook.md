# Cross-Context Coordination Playbook

适用场景：

- 除 frame / worker 外，还出现 `BroadcastChannel / storage event / SharedArrayBuffer / Atomics / Worklet`
- 需要还原多上下文状态同步或消息协同
- 请求参数依赖多个上下文共同构造

工作顺序：

1. 先枚举上下文类型：window、iframe、worker、worklet、shared memory
2. 再记录消息通道、共享状态和触发时序
3. 区分广播、同步、回调和共享内存四类协同方式
4. 最后产出 message graph 和复验脚本

最低交付：

- `run/context-map.md`
- `run/message-graph.json`
- `run/verify-once.mjs`

注意事项：

- 先固定触发动作和时间窗，再做消息追踪
- `SharedArrayBuffer / Atomics` 先记录角色和同步点，不要急着全量 dump
