export default {
  caseId: "web-webrtc-datachannel-workflow",
  status: "abstract-case",
  category: "webrtc-datachannel",
  tags: ["webrtc-datachannel", "webrtc", "ice", "datachannel"],
  focus: [
    "拆 signaling 和业务消息",
    "恢复 channel 协议",
    "标记网络依赖"
  ],
  deliverables: [
    "report.md",
    "run/signaling-map.md",
    "run/channel-frames.jsonl",
    "run/verify-once.mjs"
  ],
  checkpoints: [
    "已记录 signaling map",
    "已采集 channel frames",
    "已说明网络环境限制"
  ],
  caveats: [
    "不要把网络偶发性误判为算法不一致"
  ]
};
