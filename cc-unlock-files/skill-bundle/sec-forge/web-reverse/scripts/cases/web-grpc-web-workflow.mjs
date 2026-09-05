export default {
  caseId: "web-grpc-web-workflow",
  status: "abstract-case",
  category: "grpc-web",
  tags: ["grpc-web", "connect-web", "protobuf", "trailers"],
  focus: [
    "识别 transport 和 frame",
    "恢复方法名和 schema",
    "区分 body 与 trailers"
  ],
  deliverables: [
    "report.md",
    "run/grpc-frame-notes.md",
    "run/grpc-schema-map.md",
    "run/grpc-replay.js"
  ],
  checkpoints: [
    "已确认 transport 类型",
    "已记录 frame / trailer 边界",
    "已恢复基础 schema map"
  ],
  caveats: [
    "不要忽略 trailers 和压缩层"
  ]
};
