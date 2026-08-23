# WebRTC DataChannel Playbook

适用场景：

- 命中 `RTCPeerConnection / createOffer / ICE / RTCDataChannel`
- 需要恢复 signaling、SDP、ICE 和 DataChannel 自定义消息协议
- token、session 或 challenge 绑定在实时通道上

工作顺序：

1. 先区分 signaling channel 和 DataChannel 业务消息
2. 记录 offer / answer / candidate / channel label 的真实来源
3. 抽取 channel frame、握手字段和绑定 token
4. 最后说明哪些部分受网络环境影响，哪些能稳定 replay

最低交付：

- `run/signaling-map.md`
- `run/channel-frames.jsonl`
- `run/verify-once.mjs`

注意事项：

- ICE 和 NAT 会让 replay 结论不稳定，要明确网络依赖
- 优先复原业务协议和 token 绑定，不要把全部精力耗在底层连通性
