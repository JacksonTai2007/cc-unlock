# Application & Protocol Reverse Playbook

适用：桌面应用逆向、通信软件逆向、签名算法还原、SSL Pinning绕过。

## 通用应用逆向流程
```
步骤1 - 信息收集: 文件类型/开发语言/框架/壳/导入表/字符串
步骤2 - 入口定位: main()/WinMain()/DialogProc()/关键初始化函数
步骤3 - 功能定位: 字符串交叉引用/导入表API追踪/窗口消息处理
步骤4 - 算法还原: 加密/签名/校验/网络协议/反编译→C伪代码
```

## 加密算法识别
```
加密算法常量快速识别 → 见 `references/ctf.md` 加密算法快速识别表（含IDA Python扫描脚本）
应用逆向高频算法: AES(S-Box)、ChaCha20("expand 32-byte k")、TEA/XTEA(0x9E3779B9)、RSA(公钥模数)
ISAAC-64: 0x9e3779b97f4a7c15 (黄金比例常量, 部分通信软件使用)
```

## 协议签名逆向通用流程
```
1. 抓包获取请求(含sign/token/密文字段) → 确认哪些字段需要逆向
2. 反编译(IDA/Ghidra/dnSpy/.NET) → 搜索sign字段名 → 追踪赋值点
3. 追踪到加密函数 → 定位Native实现(DLL导出/内部函数)
4. IDA分析DLL/EXE → 识别加密算法(常量+循环特征，见ctf.md)
5. 还原签名逻辑 → 本地复现
```

## SSL Pinning 绕过
```
方法1 - Frida Hook(通用):
  Hook SSL_CTX_set_verify / CertVerifyCertificateChainPolicy → 跳过验证
  Hook Schannel InitializeSecurityContext → 返回成功
  详见 references/frida.md TLS Hook模板

方法2 - 代理+证书注入:
  Fiddler/Charles/mitmproxy → 证书安装到Windows信任存储(受信任根CA)
  适用于非Pinning或弱Pinning场景

方法3 - DLL代理/Hook:
  替换openssl.dll/libssl.dll为代理DLL → 拦截SSL验证函数
  或Hook WinHTTP/Schannel API: WinHttpSendRequest / EncryptMessage
```

## Protobuf 协议逆向
```
方法1 - Google C++ Protobuf(桌面应用常见):
  定位google::protobuf::Message虚表 → Descriptor->field_count/field数组
  → 解析字段类型/名称/编号 → 还原.proto文件
  IDA: 搜索"google.protobuf"字符串 → 定位Message类

方法2 - nanopb(嵌入式/C客户端):
  定位pb_field_t结构数组 → 解析字段类型/名称/编号 → 还原.proto文件

方法3 - 动态抓包+protoc:
  抓取二进制数据 → protoc --decode_raw解析 → 推断字段含义

工具: BlackBoxProtobuf / protoc --decode_raw
```

## 反编译语言识别
```
易语言: krnln.fnr/krnln.fne库文件 / fnr/fne扩展名 / 专用调用约定(通过fnr导入表调度) / 窗口类名含"ThunderRT6Form" / FLAIR签名恢复函数名
Python(PYD): Cython编译 → Python C API函数调用模式
Nuitka: Python→C编译 → 需Frida动态分析通信加密
V8(Bytecode): bytenode保护 → brotli解压+fixBytecode还原
Java: arthas jad反编译 / dump class(绕过加密壳) / ognl修改静态变量
Qt6: MetaObject结构 → IDA脚本解析信号/槽/属性
```

## Windows 应用框架识别
```
Electron/CEF: asar包 → app.asar解包(npm asar extract) / DevTools调试 / V8快照
Delphi/C++Builder: VCL/FMX结构 / FLAIR签名恢复 / TurboDebugger格式 / TApplication/TForm类
MFC/ATL: CWinApp消息映射 / AFX_IDS资源 / BEGIN_MESSAGE_MAP宏特征
WPF/WinUI: XAML资源 / PresentationCore.dll / BAML反编译
Qt: MetaObject系统 / Qt5Core.dll / .qm翻译文件 / SIGNAL/SLOT字符串
Flutter: libflutter_windows.dll / Dart AOT / libapp.so(移动)或flutter_assets/
Tauri/Wails: Rust后端 + WebView2前端 / webview2_loader.dll / 嵌入式HTML资源
```

## 交付最少包含
- `run/app-reverse-notes.md`
- `run/sign-algorithm.md` (签名算法还原)
- `run/protocol-schema.md` (协议结构)
- `run/encryption-notes.md` (加密算法分析)
