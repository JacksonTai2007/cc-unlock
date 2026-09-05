export default {
  caseId: "android-native-network-workflow",
  status: "abstract-case",
  category: "native-network",
  tags: [
    "native-network",
    "cronet",
    "pinning"
  ],
  focus: [
    "Cronet / BoringSSL / native TLS",
    "pinning layer identification",
    "network evidence capture"
  ],
  deliverables: [
    "report.md",
    "run/network-stack-notes.md"
  ],
  checkpoints: [
    "已识别网络栈分层",
    "已定位 pinning 或 verify 命中层",
    "已给出 hook 或旁路路径"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先判断请求究竟走 Java 网络栈还是 Native 网络栈",
      firstProbe: "检查 OkHttp/TrustManager、Cronet builder、BoringSSL、SSL_CTX 与证书回调",
      expandWhen: "已明确分层和 pinning 命中层",
      parkWhen: "分层证据相互矛盾且无法复现真实请求"
    },
    {
      id: "E2",
      hypothesis: "若 Java 未命中，优先在 Native verify 或明文边界取证",
      firstProbe: "补查 JNI 桥接、SSL_CTX、pinset 载入点、明文抓取点和子进程发包",
      expandWhen: "已确认旁路、明文抓取或协议恢复路径",
      parkWhen: "Native 层只得到噪音回调，无法接回业务请求"
    }
  ],
  probeSequence: [
    "先分层 Java 与 Native 网络栈",
    "再定位 pinning 或 verify 命中层",
    "最后选择 bypass、明文抓取或协议恢复路径"
  ],
  evidenceAnchors: [
    "Cronet、BoringSSL、SSL_CTX、证书回调、builder 配置",
    "network-stack-notes、hook 日志、抓包或明文样本"
  ],
  pivotSignals: [
    "TrustManager 未命中但请求真实失败",
    "真实发包发生在子进程或 Native 线程",
    "unpin 成功但业务数据仍不可见"
  ],
  successSignals: [
    "已明确网络栈分层与 pinning 命中层",
    "已给出稳定的旁路或取证路径"
  ],
  caveats: [
    "未分清 Java 与 Native 网络栈前不下 pinning 结论"
  ]
};

