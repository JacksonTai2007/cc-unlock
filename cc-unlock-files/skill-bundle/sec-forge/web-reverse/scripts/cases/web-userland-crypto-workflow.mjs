export default {
  caseId: "web-userland-crypto-workflow",
  status: "abstract-case",
  category: "userland-crypto",
  tags: ["userland-crypto", "cryptojs", "forge", "cipher"],
  focus: [
    "拆明文边界和密码边界",
    "建立调用图",
    "提取纯算法实现并说明非确定性边界"
  ],
  deliverables: [
    "report.md",
    "run/verify-once.mjs",
    "run/crypto-callgraph.md",
    "run/plain-cipher-pairs.json",
    "run/pure-crypto.js"
  ],
  checkpoints: [
    "已确认算法家族",
    "已采集明密文样本",
    "已完成至少一次语义等价复验或下游验签/解密通过"
  ],
  caveats: [
    "不要把编码层或压缩层误识别为密码层",
    "RSA / 随机 IV / padding 场景不要要求密文逐字一致"
  ]
};
