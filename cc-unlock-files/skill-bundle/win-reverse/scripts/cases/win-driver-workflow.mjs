export default {
  caseId: "win-driver-workflow",
  status: "abstract-case",
  category: "driver",
  tags: [
    "driver",
    "sys",
    "driverentry"
  ],
  focus: [
  "DriverEntry",
  "Dispatch 例程",
  "IOCTL 语义"
],
  deliverables: [
    "report.md",
    "task.json",
    "run/driver-dispatch-map.md"
  ],
  checkpoints: [
  "已识别 DriverEntry 与设备对象",
  "已映射主要 IRP/Dispatch",
  "已记录 IOCTL 编码与缓冲区语义"
],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "PureExtraction",
    "Port",
    "Close"
  ],
  caveats: [
    "先用证据收敛，不在本 case 内替代真实 task-local 进度"
  ]
};
