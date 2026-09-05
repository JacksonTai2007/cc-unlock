export default {
  caseId: "android-apk-triage-workflow",
  status: "abstract-case",
  category: "static-triage",
  tags: [
    "static-triage",
    "manifest",
    "component"
  ],
  focus: [
    "Manifest",
    "组件映射",
    "保护面初判"
  ],
  deliverables: [
    "report.md",
    "task.json",
    "run/static-triage-notes.md",
    "run/component-map.md"
  ],
  checkpoints: [
    "已识别入口组件并回填 component map",
    "已识别关键网络库",
    "已识别 JNI 或动态加载迹象"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先用 Manifest、资源和字符串恢复应用主入口与目标功能位置",
      firstProbe: "检查组件、权限、provider、asset、network security config 与字符串",
      expandWhen: "已找到目标页面、接口或加载链相关锚点",
      parkWhen: "基础分诊无法产生任何可继续追踪的业务入口"
    },
    {
      id: "E2",
      hypothesis: "若主入口被壳、分包或框架容器遮蔽，先恢复包装形态",
      firstProbe: "检查 split、stub Application、DexClassLoader、Flutter/Hermes/Unity 痕迹",
      expandWhen: "已确认真实代码承载位置",
      parkWhen: "包装层仍无法归因且没有更细的运行时证据"
    }
  ],
  probeSequence: [
    "先恢复包结构、组件图和主功能入口",
    "再判断是否存在壳、分包、动态加载或框架容器",
    "最后把结果转成后续 Capture 阶段入口"
  ],
  evidenceAnchors: [
    "Manifest、资源、字符串、证书、asset、res/xml",
    "组件关系、导出面、加载器与运行时类型证据"
  ],
  pivotSignals: [
    "base.apk 与实际功能明显不一致",
    "主代码位于动态模块、外部资源或 Native 容器",
    "静态入口无法解释运行时行为"
  ],
  successSignals: [
    "已给出主入口与主保护面的初步裁定",
    "已产生可执行的下一条逆向主线"
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
    "不下运行时结论"
  ]
};

