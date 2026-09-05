export default {
  caseId: "web-beacon-reporting-workflow",
  status: "abstract-case",
  category: "beacon-reporting",
  tags: ["beacon-reporting", "sendbeacon", "reportingobserver", "pagehide"],
  focus: [
    "识别隐蔽上报通道",
    "控制页面生命周期触发",
    "记录 beacon log"
  ],
  deliverables: [
    "report.md",
    "run/beacon-log.jsonl",
    "run/reporting-map.md",
    "run/verify-once.mjs"
  ],
  checkpoints: [
    "已确认上报通道",
    "已记录触发阶段",
    "已记录 beacon log 和 reporting map"
  ],
  caveats: [
    "不要忽略 hidden / unload 阶段的上报"
  ]
};
