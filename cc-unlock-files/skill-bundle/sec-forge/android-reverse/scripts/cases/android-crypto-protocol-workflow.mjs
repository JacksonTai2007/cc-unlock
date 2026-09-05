export default {
  caseId: "android-crypto-protocol-workflow",
  status: "abstract-case",
  category: "crypto-protocol",
  tags: [
    "crypto-protocol",
    "signature",
    "token"
  ],
  focus: [
    "算法",
    "参数",
    "签名",
    "TLS 明文"
  ],
  deliverables: [
    "report.md",
    "run/protocol-notes.md",
    "run/crypto-fixtures.json",
    "run/fixtures.json"
  ],
  checkpoints: [
    "已识别算法与参数",
    "已识别密钥或其来源",
    "已沉淀可复验夹具"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先恢复请求构造路径中的签名、加密或序列化边界",
      firstProbe: "检查 HMAC、AES、token、protobuf、时间戳与设备标识相关调用",
      expandWhen: "已定位关键输入、关键密钥或中间态",
      parkWhen: "静态路径被动态生成或 Native 包装完全遮蔽"
    },
    {
      id: "E2",
      hypothesis: "若静态定位困难，先抓运行时明文与中间态再回填算法",
      firstProbe: "在加密前、签名前、发包前布置最小 hook 或抓包/内存探针",
      expandWhen: "已获取稳定样本和输入输出对",
      parkWhen: "样本不可重现或中间态无法稳定复现"
    }
  ],
  probeSequence: [
    "先划定协议与密码边界",
    "再恢复关键输入与动态依赖",
    "最后沉淀 fixtures 与本地复现"
  ],
  evidenceAnchors: [
    "关键算法调用、常量、序列化器、请求体",
    "加密前明文、签名前中间态、夹具样本"
  ],
  pivotSignals: [
    "加密逻辑在 JNI 或远端配置中",
    "抓包只能看到二次封装结果",
    "本地复现缺少动态依赖"
  ],
  successSignals: [
    "已形成可验收的输入输出夹具",
    "已明确剩余动态依赖和复现边界"
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
    "不能只写算法名，必须写来源与顺序"
  ]
};

