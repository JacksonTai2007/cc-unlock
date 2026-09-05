# Protocol Playbook

Version: 2

适用场景：目标使用 WebSocket、SSE、WebTransport、二进制帧、自定义消息格式、心跳包、消息 schema、protobuf/msgpack/XOR 混淆。

## 目标

- 确认协议类型与连接入口
- 确认消息方向、分组、心跳，以及 stream / datagram 语义
- 确认消息编码与 schema
- 确认协议和签名 / token / worker / frame 的关系

## 建议流程

1. 列出连接与入口 URL
2. 区分握手、心跳、业务消息；若是 `WebTransport`，再拆 datagram、单向流、双向流
3. 对二进制帧或 stream chunk 做首字节、长度和 flush 时机分组
4. 判断编码：JSON / protobuf / msgpack / XOR / 自定义
5. 建立消息类型、字段和调用链映射
6. 若 transport 不是 `WebSocket`，也要把 transport-specific 证据落到 `run/websocket-frame-notes.md`，并明确它实际承载的是 stream/datagram 观察记录

## 最低交付

- `run/protocol-notes.md`
- `run/websocket-frame-notes.md`
- 消息类型清单
- 心跳与业务消息区分
- 若命中 `WebTransport`，至少补 datagram / stream 边界说明

## 禁止事项

- 只抓到连接 URL 就停止
- 不区分心跳和业务消息
- 把 `WebTransport` datagram、stream、握手层全部压平成“和 WebSocket 一样的帧”
- 不建立 schema 就直接写重放脚本
