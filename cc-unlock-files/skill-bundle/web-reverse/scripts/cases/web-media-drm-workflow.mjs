export default {
  caseId: "web-media-drm-workflow",
  status: "abstract-case",
  category: "media-drm",
  tags: ["media-drm", "eme", "mse", "license", "video-frame", "decryption"],
  focus: [
    "区分播放和授权链路",
    "恢复 token 输入边界",
    "识别任务模式：模式A（license分析）或 模式B（内容解密/帧明文边界恢复）",
    "模式B下优先黑盒复用，次发明文边界，最后才拆内部",
    "支持 JSVMP+DRM 复合场景（T7）的联动分析"
  ],
  deliverables: [
    "report.md",
    "run/license-flow.md",
    "run/token-inputs.json",
    "run/verify-once.mjs",
    "run/frame-decryption-chain.md",
    "run/key-session-timeline.json"
  ],
  checkpoints: [
    "已确认 MSE / EME / license 边界",
    "已记录 token 输入",
    "已判定模式A或模式B",
    "模式B下已尝试黑盒复用并记录结果",
    "已说明受保护内容限制和合规边界"
  ],
  caveats: [
    "模式A下不要承诺绕过 DRM 或提取受保护内容",
    "模式B仅在用户明确请求时执行，且限于本地验证",
    "不要未尝试黑盒就进入深拆",
    "不要把 license 链路分析清楚当作模式B的交付"
  ]
};
