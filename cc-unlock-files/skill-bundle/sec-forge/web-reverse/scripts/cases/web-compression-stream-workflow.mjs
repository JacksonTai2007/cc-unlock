export default {
  caseId: "web-compression-stream-workflow",
  status: "abstract-case",
  category: "compression-stream",
  tags: ["compression-stream", "gzip", "brotli"],
  runtime: "browser-observe",
  focus: [
    "确认压缩前明文边界",
    "确认算法与 stream/codec 顺序",
    "记录压缩前后样本与 carrier"
  ],
  deliverables: [
    "report.md",
    "run/compression-stream-notes.md",
    "run/compression-samples.json"
  ],
  checkpoints: [
    "已确认压缩位置",
    "已确认至少一种算法与 carrier",
    "已记录压缩前后样本"
  ],
  caveats: [
    "压缩专题不能只留下算法名，必须记录压缩前明文边界"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/compression-stream-notes.md",
    "run/compression-samples.json"
  ],
  notes: [
    "优先确认压缩在协议链路中的顺序，再决定是否转向 codec 或 streaming"
  ]
};
