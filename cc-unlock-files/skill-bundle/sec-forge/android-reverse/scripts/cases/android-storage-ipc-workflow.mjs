export default {
  caseId: "android-storage-ipc-workflow",
  status: "abstract-case",
  category: "storage-ipc",
  tags: [
    "storage-ipc",
    "provider",
    "binder"
  ],
  focus: [
    "本地存储",
    "数据库",
    "Provider / Intent / Binder"
  ],
  deliverables: [
    "report.md",
    "run/storage-ipc-notes.md"
  ],
  checkpoints: [
    "已识别关键数据落点",
    "已识别组件间传递方式",
    "已沉淀数据与 IPC 证据"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从 SharedPreferences、SQLite、Room、MMKV 恢复本地状态与敏感字段",
      firstProbe: "检查数据库、偏好文件、key 名称、schema、迁移与读写调用点",
      expandWhen: "已确认关键状态与数据流入口",
      parkWhen: "本地数据并不承载目标状态"
    },
    {
      id: "E2",
      hypothesis: "若目标通过组件或系统通道流转，先恢复 Provider、Intent、Binder 边界",
      firstProbe: "检查 ContentProvider、Intent extra、AIDL/Binder、广播与 URI 权限",
      expandWhen: "已把 IPC 入口与敏感状态接回业务动作",
      parkWhen: "IPC 通道无法解释目标现象"
    }
  ],
  probeSequence: [
    "先区分本地存储与 IPC 主线",
    "再恢复敏感字段、权限边界和调用入口",
    "最后记录证据与残留问题"
  ],
  evidenceAnchors: [
    "SharedPreferences/SQLite/Room/MMKV 文件与调用点",
    "Provider/Intent/Binder 边界、敏感字段、storage-ipc-notes"
  ],
  pivotSignals: [
    "目标状态不在本地而在跨进程组件中",
    "敏感字段经过二次编码或 Native 处理",
    "IPC 入口只在特定权限或进程下可见"
  ],
  successSignals: [
    "已恢复关键存储位置或 IPC 入口",
    "已指出后续应验证的字段、权限或调用点"
  ],
  caveats: [
    "不把普通配置项误报为敏感数据"
  ]
};

