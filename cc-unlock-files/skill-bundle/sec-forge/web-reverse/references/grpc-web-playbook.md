# gRPC-Web Playbook

适用场景：

- 请求头或响应头出现 `application/grpc-web / x-grpc-web / grpc-status / trailers`
- 浏览器侧存在 gRPC-Web、Connect-Web 或 protobuf-over-HTTP
- 需要恢复方法名、帧格式和 schema

工作顺序：

1. 确认 transport：grpc-web-text、grpc-web、Connect 或自研包装
2. 区分 headers、body frames、trailers 和压缩层
3. 记录方法名、消息方向、frame type 和 schema 线索
4. 最后补最小 replay 或 decode 验证

最低交付：

- `run/grpc-frame-notes.md`
- `run/grpc-schema-map.md`
- `run/grpc-replay.js`

注意事项：

- 不要只截 body，trailers 常携带真实状态和错误信息
- schema 没恢复前，先保持 message boundary 和 method mapping 稳定
