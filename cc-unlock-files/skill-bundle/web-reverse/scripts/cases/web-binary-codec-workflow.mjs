export default {
  caseId: "web-binary-codec-workflow",
  status: "abstract-case",
  category: "binary-codec",
  tags: ["binary-codec", "protobuf", "msgpack"],
  runtime: "browser-observe",
  focus: [
    "识别 framing 与 codec 家族",
    "建立字段或消息类型线索",
    "连接 encode / decode 与 replay 链路"
  ],
  deliverables: [
    "report.md",
    "run/binary-codec-notes.md",
    "run/binary-samples.json"
  ],
  checkpoints: [
    "已记录二进制边界",
    "已确认至少一个 schema 线索",
    "已确认写回或 decode 入口之一"
  ],
  caveats: [
    "不能只留下十六进制片段，必须说明二进制边界与字段线索"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/binary-codec-notes.md",
    "run/binary-samples.json"
  ],
  notes: [
    "优先确认 framing，再决定是否继续补 protocol/compression/wasm"
  ]
};
