export const smokeScenarios = [
  {
    id: "login-jni-native-network",
    taskId: "smoke-login-jni-native-network",
    description: "Flutter 容器、JNI、Native 网络栈与本地复现闭环",
    taskInput: "references/task-input-examples/login-jni-native-network.json",
    initArgs: [],
    phase: "Port",
    nextAction: "执行 closeout 并清理 task-local。",
    facts: [
      "Flutter 容器负责 UI，登录签名经 JNI 进入 liblogin.so。",
      "真实发包位于子进程中的 Cronet builder，Java TrustManager 未直接命中。",
      "Pinning 在 Native 层校验证书指纹，Java 侧仅负责会话组装。"
    ],
    inferences: [
      "优先恢复框架容器、JNI 边界与 Native 网络栈分层，比单点 patch 更稳。",
      "Pinning 绕过应与网络分层放在同一条时间线上记录，避免误判。"
    ],
    unresolved: [
      "后台刷新 token 的次级进程仍需在真实样本上补抓一次。"
    ],
    topicOutcomes: {
      "static-triage": {
        keyFindings: [
          "识别 Flutter 容器与登录入口 Activity。",
          "静态分诊已把 Cronet 与 JNI 风险前置暴露。"
        ],
        artifacts: {
          "run/static-triage-notes.md": [
            "# 静态分诊",
            "",
            "- 主入口: `com.demo.login.LoginActivity`",
            "- 容器: Flutter (`libapp.so`)",
            "- 风险面: JNI + Cronet + pinning + 子进程"
          ].join("\n"),
          "run/component-map.md": [
            "# Component Map",
            "",
            "- `LoginActivity` -> `FlutterActivity` 容器",
            "- `AuthRepository` -> `nativeSign()` -> `liblogin.so`"
          ].join("\n")
        }
      },
      "framework-runtime": {
        keyFindings: [
          "Flutter 容器负责 UI 与路由，签名逻辑不在 Dart 层。",
          "真实登录请求在 `AuthRepository` 之后进入 Native。"
        ],
        artifacts: {
          "run/framework-runtime-notes.md": [
            "# Framework Runtime Notes",
            "",
            "- 容器: Flutter",
            "- UI 入口: `LoginActivity` / `FlutterActivity`",
            "- 业务边界: Dart -> MethodChannel -> JNI `nativeSign`"
          ].join("\n"),
          "run/framework-runtime-map.json": {
            "runtime": "flutter",
            "entryActivity": "com.demo.login.LoginActivity",
            "container": "io.flutter.embedding.android.FlutterActivity",
            "bridge": "AuthRepository.nativeSign",
            "nativeLibrary": "liblogin.so"
          }
        }
      },
      "jni-bridge": {
        keyFindings: [
          "`AuthRepository.nativeSign` 通过 RegisterNatives 绑定到 `Java_com_demo_login_NativeSigner_sign`。",
          "JNI 返回值直接进入 Cronet 请求头组装。"
        ],
        artifacts: {
          "run/register-natives-trace.js": [
            "Java.perform(function () {",
            "  var NativeSigner = Java.use('com.demo.login.NativeSigner');",
            "  NativeSigner.sign.overload('[B').implementation = function (input) {",
            "    var result = this.sign(input);",
            "    console.log('[trace] NativeSigner.sign => ' + JSON.stringify(result));",
            "    return result;",
            "  };",
            "  console.log('[trace] RegisterNatives hook installed for com.demo.login.NativeSigner');",
            "});"
          ].join("\n"),
          "run/jni-bridge-map.md": [
            "# JNI Bridge Map",
            "",
            "- Java: `AuthRepository.nativeSign(byte[])`",
            "- RegisterNatives: `Java_com_demo_login_NativeSigner_sign`",
            "- Return: `X-Sign` header material"
          ].join("\n")
        }
      },
      "native-so": {
        keyFindings: [
          "liblogin.so 内部同时包含签名拼装与证书指纹比较。",
          "关键常量与请求时间戳在 Native 层合成。"
        ],
        artifacts: {
          "run/native-notes.md": [
            "# Native Notes",
            "",
            "- 关键库: `liblogin.so`",
            "- 关键导出: `Java_com_demo_login_NativeSigner_sign`",
            "- 附加观察: 指纹比较函数与签名主链共库"
          ].join("\n")
        }
      },
      "native-network": {
        keyFindings: [
          "真实发包走 Cronet 子进程，不经 Java TrustManager。",
          "Pinning 命中点位于 Native 指纹比较回调。"
        ],
        artifacts: {
          "run/network-stack-notes.md": [
            "# Network Stack Notes",
            "",
            "- Java: 仅组装请求参数",
            "- Native: Cronet builder + cert pin check",
            "- 进程: `:cronet` 子进程"
          ].join("\n")
        }
      },
      "art-runtime": {
        keyFindings: [
          "关键发包位于子进程，必须 `spawn` 后转 `attach-name`。",
          "早期 hook miss 与进程选择有关，不是逻辑未执行。"
        ],
        artifacts: {
          "run/art-runtime-notes.md": [
            "# ART Runtime Notes",
            "",
            "- 选择: `spawn` 首屏后切 `attach-name com.demo.login:cronet`",
            "- 风险: 早期初始化位于子进程",
            "- 结论: 需要把时机和网络分层一起记录"
          ].join("\n")
        }
      },
      "protection-bypass": {
        keyFindings: [
          "Root、Frida 与 Integrity 为启动前保护，pinning 为发包前保护。",
          "Pinning 通过 Native hook 绕过，其余子面已裁定不阻塞主链。"
        ],
        surfaceMatrix: {
          "root": {
            "status": "not-applicable",
            "triggerStage": "startup",
            "notes": [
              "Root 检测存在，但当前测试环境未触发阻塞。"
            ]
          },
          "frida": {
            "status": "bypassed",
            "triggerStage": "startup",
            "notes": [
              "通过 stealth gadget 形态避免默认端口检测。"
            ]
          },
          "integrity": {
            "status": "not-applicable",
            "triggerStage": "startup",
            "notes": [
              "本轮样本未强制校验 Play Integrity。"
            ]
          },
          "pinning": {
            "status": "bypassed",
            "triggerStage": "pre-request",
            "notes": [
              "Native 指纹比较已被旁路。"
            ]
          }
        },
        artifacts: {
          "run/anti-root-bypass.js": [
            "Java.perform(function () {",
            "  var RootChecker = Java.use('com.demo.security.RootChecker');",
            "  RootChecker.isRooted.overload().implementation = function () {",
            "    console.log('[bypass] RootChecker.isRooted => false');",
            "    return false;",
            "  };",
            "  console.log('[bypass] Root detection bypassed for current route');",
            "});"
          ].join("\n"),
          "run/anti-frida-bypass.js": [
            "Java.perform(function () {",
            "  try {",
            "    var FridaDetector = Java.use('com.demo.security.FridaDetector');",
            "    FridaDetector.isFridaRunning.overload().implementation = function () {",
            "      console.log('[bypass] FridaDetector.isFridaRunning => false');",
            "      return false;",
            "    };",
            "  } catch (e) {",
            "    console.log('[bypass] Frida detection class not found, relying on stealth injection');",
            "  }",
            "});"
          ].join("\n"),
          "run/integrity-bypass.js": [
            "Java.perform(function () {",
            "  var IntegrityApi = Java.use('com.demo.security.IntegrityVerifier');",
            "  IntegrityApi.verify.overload().implementation = function () {",
            "    console.log('[observe] Integrity surface observed, not blocking current path');",
            "    return this.verify();",
            "  };",
            "});"
          ].join("\n"),
          "run/cert-pinning-bypass.js": [
            "Java.perform(function () {",
            "  var TrustManager = Java.use('com.demo.net.CustomTrustManager');",
            "  TrustManager.checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String').implementation = function (chain, authType) {",
            "    console.log('[bypass] cert pinning bypassed, accepting all certs');",
            "  };",
            "});"
          ].join("\n")
        }
      }
    }
  },
  {
    id: "split-dex-crypto",
    taskId: "smoke-split-dex-crypto",
    description: "Split Delivery、Dex 装载、运行时 hook 与协议夹具闭环",
    taskInput: "references/task-input-examples/split-dex-crypto.json",
    initArgs: [],
    phase: "Capture",
    nextAction: "根据已保存的协议夹具，决定下一轮是转 PureExtraction 还是补更多动态样本。",
    facts: [
      "支付签名逻辑位于动态特性模块中的二次 Dex。",
      "DexClassLoader 在支付页点击后装载 `feature_pay.dex`。",
      "HMAC 输入字段已通过 hook 与夹具固定下来。"
    ],
    inferences: [
      "split 布局、Dex 装载与协议恢复必须同时观察，否则容易把缺失逻辑误判成不存在。"
    ],
    unresolved: [
      "风险仍在于真实设备上支付页触发时机可能早于当前 hook。"
    ],
    topicOutcomes: {
      "static-triage": {
        keyFindings: [
          "静态分诊已确认支付逻辑不在 base.apk。",
          "Manifest 与资源提示支付能力由动态模块承载。"
        ],
        artifacts: {
          "run/static-triage-notes.md": [
            "# 静态分诊",
            "",
            "- 支付入口 Activity 位于动态特性模块",
            "- base.apk 仅保留壳层与占位路由"
          ].join("\n"),
          "run/component-map.md": [
            "# Component Map",
            "",
            "- `PayEntryActivity` -> feature module `feature_pay`",
            "- `PayBridge` -> DexClassLoader -> `feature_pay.dex`"
          ].join("\n")
        }
      },
      "split-delivery": {
        keyFindings: [
          "目标逻辑位于动态特性模块 `feature_pay`。",
          "安装布局已覆盖 base、ABI split 与 feature split。"
        ],
        artifacts: {
          "run/split-delivery-notes.md": [
            "# Split Delivery Notes",
            "",
            "- base: `base.apk`",
            "- config: `split_config.arm64_v8a.apk`",
            "- feature: `feature_pay.apk`"
          ].join("\n"),
          "run/split-layout.json": {
            "base": "base.apk",
            "configSplits": [
              "split_config.arm64_v8a.apk"
            ],
            "featureSplits": [
              "feature_pay.apk"
            ],
            "targetFeature": "feature_pay"
          }
        }
      },
      "dex-loader": {
        keyFindings: [
          "DexClassLoader 在点击支付按钮后装载 `feature_pay.dex`。",
          "类加载 trace 已定位到 `com.demo.feature.pay.SignatureBuilder`。"
        ],
        artifacts: {
          "run/class-loader-trace.js": [
            "Java.perform(function () {",
            "  var DexLoader = Java.use('dalvik.system.DexClassLoader');",
            "  DexLoader.$init.overload('java.lang.String', 'java.lang.String', 'java.lang.String', 'java.lang.ClassLoader').implementation = function (dexPath, optDir, libPath, parent) {",
            "    console.log('[trace] DexClassLoader loading: ' + dexPath);",
            "    return this.$init(dexPath, optDir, libPath, parent);",
            "  };",
            "});"
          ].join("\n"),
          "run/dex-loader-dump-notes.md": [
            "# Dex Loader Notes",
            "",
            "- 触发点: 点击支付按钮",
            "- 加载器: `DexClassLoader`",
            "- 目标类: `SignatureBuilder`"
          ].join("\n")
        }
      },
      "runtime-hooking": {
        keyFindings: [
          "Java hook 抓到 HMAC 输入字段，Native hook 抓到输出摘要。",
          "双栈 hook 已证明协议主链稳定。"
        ],
        artifacts: {
          "run/frida-java-template.js": [
            "Java.perform(function () {",
            "  var SignatureBuilder = Java.use('com.demo.feature.pay.SignatureBuilder');",
            "  SignatureBuilder.buildSignature.overload('java.lang.String', 'java.lang.String').implementation = function (body, nonce) {",
            "    var result = this.buildSignature(body, nonce);",
            "    console.log('[hook] buildSignature(' + body + ', ' + nonce + ') => ' + result);",
            "    return result;",
            "  };",
            "});"
          ].join("\n"),
          "run/frida-native-template.js": [
            "Interceptor.attach(Module.findExportByName('libpay.so', 'hmac_sha256'), {",
            "  onEnter: function (args) {",
            "    console.log('[hook] hmac_sha256 key=' + args[0] + ' data=' + args[1]);",
            "  },",
            "  onLeave: function (retval) {",
            "    console.log('[hook] hmac_sha256 => ' + retval);",
            "  }",
            "});"
          ].join("\n")
        }
      },
      "crypto-protocol": {
        keyFindings: [
          "协议使用固定字段顺序与 HMAC-SHA256。",
          "夹具已固化时间戳、nonce 与 body 摘要。"
        ],
        artifacts: {
          "run/protocol-notes.md": [
            "# Protocol Notes",
            "",
            "- 算法: HMAC-SHA256",
            "- 输入: bodyDigest + nonce + timestamp",
            "- 输出: `X-Pay-Sign`"
          ].join("\n"),
          "run/crypto-fixtures.json": {
            "algorithm": "HMAC-SHA256",
            "fixture": {
              "bodyDigest": "e3b0c44298fc1c149afbf4c8996fb924",
              "nonce": "demo-nonce-01",
              "timestamp": "1712000000"
            },
            "expectedHeader": "X-Pay-Sign"
          }
        }
      }
    }
  },
  {
    id: "webview-storage-smali",
    taskId: "smoke-webview-storage-smali",
    description: "WebView 桥、Storage/IPC、调用链与 smali patch 闭环",
    taskInput: "references/task-input-examples/webview-storage-smali.json",
    initArgs: [
      "--topics=java-api,call-flow"
    ],
    phase: "Patch",
    nextAction: "在真实样本上复验 patch 后是否仍保留 JS bridge 与本地缓存行为一致性。",
    facts: [
      "JS bridge 将认证 token 写入 MMKV，并通过 ContentProvider 提供给宿主页。",
      "模拟器检测点在 `isDebuggerConnected` 与 `ro.kernel.qemu` 双路径触发。",
      "最小 smali patch 仅裁掉 debug gate，不影响后续桥接逻辑。"
    ],
    inferences: [
      "先恢复 WebView -> Storage -> Provider 链，再 patch 调试检测，能降低副作用。"
    ],
    unresolved: [
      "真实设备上 Provider 权限裁定仍需补一次。"
    ],
    topicOutcomes: {
      "webview-hybrid": {
        keyFindings: [
          "WebView JS bridge 暴露 `NativeAuthBridge.storeToken`。",
          "桥接调用最终进入宿主缓存链。"
        ],
        artifacts: {
          "run/webview-bridge-notes.md": [
            "# WebView Bridge Notes",
            "",
            "- Bridge: `NativeAuthBridge.storeToken(token)`",
            "- JS 调用后进入 MMKV + Provider 链"
          ].join("\n")
        }
      },
      "storage-ipc": {
        keyFindings: [
          "MMKV 保存认证 token，Provider 暴露只读查询。",
          "缓存路径与导出面已记录。"
        ],
        artifacts: {
          "run/storage-ipc-notes.md": [
            "# Storage / IPC Notes",
            "",
            "- Storage: MMKV `auth_cache`",
            "- IPC: `content://com.demo.hybrid.token/provider`"
          ].join("\n")
        }
      },
      "java-api": {
        keyFindings: [
          "Java API 层入口为 `AuthBridgeRepository.storeToken`。",
          "接口层与缓存层映射已形成。"
        ],
        artifacts: {
          "run/api-map.md": [
            "# API Map",
            "",
            "- `AuthBridgeRepository.storeToken(String)`",
            "- `TokenProvider.query()`"
          ].join("\n")
        }
      },
      "call-flow": {
        keyFindings: [
          "调用链已从 WebViewActivity 收敛到 `TokenProvider.query`。",
          "入口和终点都已有证据回指。"
        ],
        artifacts: {
          "run/call-chain.md": [
            "# Call Chain",
            "",
            "- `WebViewActivity.onPageFinished`",
            "- `NativeAuthBridge.storeToken`",
            "- `AuthBridgeRepository.storeToken`",
            "- `TokenProvider.query`"
          ].join("\n")
        }
      },
      "anti-emulator-debug": {
        keyFindings: [
          "模拟器与调试检测由 Java 层 gate 统一阻断。",
          "当前 patch 前，目标链路在点击后立即被截断。"
        ],
        artifacts: {
          "run/anti-emulator-bypass.js": [
            "Java.perform(function () {",
            "  var DebugGate = Java.use('com.demo.hybrid.DebugGate');",
            "  DebugGate.isBlocked.overload().implementation = function () {",
            "    console.log('[bypass] DebugGate.isBlocked => false');",
            "    return false;",
            "  };",
            "});"
          ].join("\n")
        }
      },
      "smali-patching": {
        keyFindings: [
          "smali patch 只移除 debug gate 分支，不改 token 存储行为。",
          "重签后 WebView bridge 与 Provider 查询仍然一致。"
        ],
        artifacts: {
          "run/smali-patch-notes.md": [
            "# Smali Patch Notes",
            "",
            "- Patch 点: `Lcom/demo/hybrid/DebugGate;->isBlocked()Z`",
            "- 策略: return false",
            "- 验证: JS bridge 与 Provider 均正常工作"
          ].join("\n")
        }
      }
    }
  },
  {
    id: "ctf-crackme",
    taskId: "smoke-ctf-crackme",
    description: "Android crackme 与 CTF 求解脚本闭环",
    taskInput: "references/task-input-examples/ctf-crackme.json",
    initArgs: [],
    phase: "Port",
    nextAction: "执行 closeout，清理任务产物。",
    facts: [
      "flag 校验由本地算法完成，不依赖网络。",
      "求解脚本已能复现正确 flag 生成路径。"
    ],
    inferences: [
      "该样本适合直接 Port 成 solver，而不是继续扩大动态取证。"
    ],
    unresolved: [],
    topicOutcomes: {
      "ctf": {
        keyFindings: [
          "校验路径已恢复为可重复执行的本地算法。",
          "solver 模板已改成可直接运行的 smoke 版本。"
        ],
        artifacts: {
          "run/solver-template.py": [
            "import hashlib",
            "import hmac",
            "",
            "",
            "def solve(seed: str) -> str:",
            "    key = b'smoke-ctf-key'",
            "    reversed_seed = seed[::-1]",
            "    signature = hmac.new(key, reversed_seed.encode(), hashlib.sha256).hexdigest()[:8]",
            "    return f'FLAG{{{reversed_seed}_{signature}}}'",
            "",
            "",
            "if __name__ == '__main__':",
            "    print(solve('demo'))"
          ].join("\n")
        }
      }
    }
  }
];

export function getSmokeScenario(id) {
  return smokeScenarios.find((scenario) => scenario.id === id) || null;
}
