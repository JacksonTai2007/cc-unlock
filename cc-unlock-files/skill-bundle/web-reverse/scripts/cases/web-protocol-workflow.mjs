export default {
  caseId: "web-protocol-workflow",
  status: "abstract-case",
  category: "protocol",
  tags: ["protocol", "websocket", "webtransport", "schema", "stream"],
  focus: [
    "连接入口识别",
    "消息类型与心跳/stream/datagram 分组",
    "消息 schema 归纳"
  ],
  deliverables: [
    "report.md",
    "run/protocol-notes.md",
    "run/websocket-frame-notes.md"
  ],
  checkpoints: [
    "已列出协议入口",
    "已区分心跳与业务消息",
    "已建立最小消息 schema"
  ],
  caveats: [
    "不要把所有帧或 stream/datagram 都当成同一类消息"
  ]
};
