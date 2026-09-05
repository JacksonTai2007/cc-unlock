export default {
  caseId: "android-java-api-workflow",
  status: "abstract-case",
  category: "java-api",
  tags: [
    "java-api",
    "retrofit",
    "okhttp"
  ],
  focus: [
    "client 初始化",
    "baseUrl 与鉴权上下文",
    "endpoint 枚举"
  ],
  deliverables: [
    "report.md",
    "run/api-map.md"
  ],
  checkpoints: [
    "已识别 client 或 service 构造点",
    "已识别 baseUrl、path 或请求构造模型",
    "已把接口映射写入 run/api-map.md"
  ],
  entrypoints: [
    {
      id: "E1",
      hypothesis: "先从 Retrofit/OkHttp/Volley 入口恢复 client 与 baseUrl",
      firstProbe: "检查 builder、service interface、interceptor、baseUrl 与 endpoint 注解",
      expandWhen: "已定位请求构造路径与鉴权边界",
      parkWhen: "网络 client 被动态配置或 Native 包装遮蔽"
    },
    {
      id: "E2",
      hypothesis: "若 client 定义噪音大，先从真实请求或日志回推接口定义",
      firstProbe: "结合抓包、日志、字符串与 endpoint 常量反查 service 与鉴权代码",
      expandWhen: "已形成 endpoint 到代码的可回指映射",
      parkWhen: "请求样本与代码定义无法互相印证"
    }
  ],
  probeSequence: [
    "先恢复 client 与 endpoint",
    "再恢复鉴权、签名与动态配置边界",
    "最后沉淀 API map"
  ],
  evidenceAnchors: [
    "Retrofit/OkHttp/Volley 定义、builder、interceptor、注解",
    "抓包样本、日志、endpoint 常量、鉴权实现"
  ],
  pivotSignals: [
    "baseUrl 来自远端配置或 Native",
    "请求体在发送前二次封装",
    "接口定义与真实流量不一致"
  ],
  successSignals: [
    "已建立 endpoint、鉴权与 client 的映射",
    "已指出需继续深挖的签名或动态配置点"
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
    "不要只列 URL 字符串，必须同时说明鉴权、签名或拦截器上下文"
  ]
};
