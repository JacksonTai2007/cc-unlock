export default {
  caseId: "web-streaming-runtime-workflow",
  status: "abstract-case",
  category: "streaming-runtime",
  tags: ["streaming-runtime", "readablestream", "transformstream"],
  runtime: "browser-observe",
  focus: [
    "建立 source -> transform -> sink 管线",
    "确认 chunk 边界与 flush 时机",
    "确认业务语义首次稳定出现的 stage"
  ],
  deliverables: [
    "report.md",
    "run/streaming-runtime-notes.md",
    "run/stream-pipeline.json"
  ],
  checkpoints: [
    "已建立至少一个 pipeline",
    "已确认 chunk boundary",
    "已确认业务或协议落在哪个 stage"
  ],
  caveats: [
    "不要把 transport streaming 与业务增量执行混为一个概念"
  ],
  stages: ["Observe", "Capture", "Rebuild", "Patch", "PureExtraction", "Port"],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/streaming-runtime-notes.md",
    "run/stream-pipeline.json"
  ],
  notes: [
    "streaming-runtime 优先记录管线图，再决定往 dynamic-code/wasm/binary-codec 深挖"
  ]
};
