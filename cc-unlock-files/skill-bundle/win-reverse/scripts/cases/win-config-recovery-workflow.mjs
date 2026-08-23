export default {
  caseId: "win-config-recovery-workflow",
  status: "abstract-case",
  category: "config-recovery",
  tags: [
    "config-recovery",
    "blob",
    "registry"
  ],
  focus: [
    "配置载体定位",
    "解码 / 解密链",
    "字段语义与验收"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/config-recovery-notes.md"
  ],
  checkpoints: [
    "已确定配置 blob / 资源 / 注册表来源",
    "已还原关键字段或给出阻塞点",
    "已记录验证方式和未确认字段"
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
    "配置恢复要区分静态猜测、运行时明文证据与外部环境依赖"
  ]
};
