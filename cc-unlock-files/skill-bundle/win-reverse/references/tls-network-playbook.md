# TLS Network Playbook

适用：WinHTTP / WinINet / Schannel / OpenSSL / BoringSSL / mbedTLS / raw socket / TLS 明文还原。

## 命中信号

- 导入 `ws2_32.dll`: `connect`/`send`/`recv`/`WSAStartup`
- 导入 `winhttp.dll`: `WinHttpOpen`/`WinHttpConnect`/`WinHttpSendRequest`
- 导入 `wininet.dll`: `InternetOpenA/W`/`HttpOpenRequest`/`HttpSendRequest`
- 导入 `secur32.dll`: `InitializeSecurityContextW`/`EncryptMessage`/`DecryptMessage`
- 导入 `bcrypt.dll`: `BCryptEncrypt`/`BCryptDecrypt`/`BCryptGenerateSymmetricKey`
- 字符串: `https://`/`wss://`/TLS 证书相关/OUI/CA 名称

## 最小目标

1. 识别目标使用的 TLS 库和网络 API 栈
2. 建立 `明文 → 加密 → 网络` 的完整数据流
3. 获取 TLS 加密前的明文或解密后的明文
4. 落盘 `run/network-protocol.md`、`run/tls-decrypt-notes.md`

## 阶段工作流

```
命中网络/TLS 信号
 ├─ 阶段1: TLS 库识别
 │   ├─ 查导入表 → 确定 TLS 实现栈
 │   ├─ 静态链接检测 → S-Box 特征 / 字符串 / 函数指纹
 │   └─ 确定协议: TLS 1.0/1.1/1.2/1.3 / DTLS / QUIC
 ├─ 阶段2: 明文截取点选择
 │   ├─ OpenSSL: SSL_read/SSL_write（frida.md OpenSSL 块）
 │   ├─ Schannel: DecryptMessage/EncryptMessage（frida.md Schannel 块）
 │   ├─ WinHTTP/WinInet: 上层 API hook（ReadData/InternetReadFile）
 │   ├─ CNG/BCrypt: BCryptEncrypt/BCryptDecrypt 参数捕获
 │   └─ 原始 socket: send/recv hook（未加密场景）
 └─ 阶段3: 协议层分析
     ├─ HTTP: 解析 header + body
     ├─ 自定义二进制: magic + length + payload 解析
     ├─ Protobuf/MessagePack: 反序列化
     └─ WebSocket: 帧 opcode + payload 解析
```

## TLS 库识别

```
导入表出现 winhttp.dll → WinHTTP 栈
导入表出现 wininet.dll → WinINet 栈
导入表出现 secur32.dll / schannel.dll → Schannel（Windows 原生 TLS）
导入表出现 libssl*.dll / libcrypto*.dll / openssl.dll → OpenSSL
导入表出现 bcrypt.dll + BCryptEncrypt/BCryptDecrypt → CNG (BCrypt API)
静态链接 OpenSSL → 字符串 "OpenSSL" / S-Box 特征 / SSL_read/SSL_write 内部符号
静态链接 mbedTLS → 字符串 "mbed TLS" / mbedtls_x509 相关符号
无 TLS 相关导入 + 存在网络调用 → 自实现加密 或 白盒加密 → 需动态确认

静态 OpenSSL 指纹:
  1. AES S-Box 字节序列 (256 字节常量):
     63 7C 77 7B F2 6B 6F C5 30 01 67 2B FE D7 AB 76...
  2. 字符串 "OpenSSL x.y.z" / "SSLv3" / "TLSv1.2"
  3. 函数签名: SSL_CTX_new / SSL_new / SSL_connect / SSL_read / SSL_write
  4. IDA FLIRT 签名匹配（如果有 openssl.pdb 符号）
```

## 证据层分离

三层独立收集，不混淆：

- **网络层**：connect / send / recv / WSASend / WSARecv → IP:Port、原始字节
- **TLS 层**：加密前明文 / 解密后明文 / 密钥材料 / 证书校验点
- **协议层**：TLS 解密后的业务数据结构（HTTP 头、自定义二进制、Protobuf 等）

## 各栈 Hook 策略

### WinHTTP / WinINet（上层 API）

```
WinHTTP 关键 API:
  WinHttpOpen → 会话创建
  WinHttpConnect → 服务器连接（获取主机名和端口）
  WinHttpOpenRequest → 请求创建（获取 Method 和 URL 路径）
  WinHttpSendRequest → 发送请求头 + 可选 body
  WinHttpWriteData → 发送 body 数据
  WinHttpReceiveResponse → 接收响应
  WinHttpReadData → 读取响应 body（明文！WinHTTP 内部处理 TLS）

WinINet 关键 API:
  InternetConnect → 服务器连接
  HttpOpenRequest → 请求创建
  HttpSendRequest → 发送请求
  InternetReadFile → 读取响应（明文）

策略: hook WinHttpReadData/InternetReadFile 直接获取解密后的明文，
      无需 hook 底层 TLS。SSL Pinning 绕过需额外处理。
```

### OpenSSL（动态/静态链接）

```
明文截取点:
  SSL_read(ssl, buf, num)  → buf 中是解密后的明文（onLeave 时读取）
  SSL_write(ssl, buf, num) → buf 中是加密前的明文（onEnter 时读取）

定位 SSL_read/SSL_write:
  动态链接: Module.findExportByName("libssl.dll", "SSL_read")
  静态链接: 字节特征扫描（frida.md Pattern 4）或字符串 xref 定位

SSL Pinning 绕过:
  SSL_CTX_set_verify(ctx, mode, callback) → 将 mode 设为 SSL_VERIFY_NONE
  或: 将 callback 替换为始终返回 1 的函数

密钥提取:
  SSL_SESSION → master_secret
  或: Hook SSL_CTX_set_keylog_callback 设置 keylog 回调
  或: 环境变量 SSLKEYLOGFILE（仅部分 OpenSSL 版本支持）
```

### Schannel（Windows 原生 TLS）

```
明文截取点:
  DecryptMessage(phContext, pMessage, MessageSeqNo, pfQOP) → pMessage 中的 SECBUFFER_DATA
  EncryptMessage(phContext, MessageSeqNo, pMessage, MessageSeqNo) → pMessage 中的 SECBUFFER_DATA

结构解析:
  SecBufferDesc: { ulVersion(4B), cBuffers(4B), pBuffers(ptr) }
  SecBuffer: { cbBuffer(4B), BufferType(4B), pvBuffer(ptr) }
  BufferType=SECBUFFER_DATA(1) → 明文数据

详见 frida.md Schannel 块（已含完整 Frida 脚本，含 x86/x64 结构对齐处理）

SSLKEYLOGFILE:
  Schannel 原生支持（Windows 10 2004+ / Windows Server 2022+）
  设置环境变量后启动目标 → 自动写入 TLS session keys
  Wireshark 加载 keys.log 即可解密 TLS 流量
```

### CNG / BCrypt

```
BCrypt API 用于现代 Windows 加密操作（替代 CryptoAPI）

关键 API:
  BCryptGenerateSymmetricKey → 对称密钥创建
  BCryptEncrypt(hKey, pbInput, cbInput, pPaddingInfo, pbIV, cbIV, pbOutput, cbOutput, ...)
  BCryptDecrypt(hKey, pbInput, cbInput, pPaddingInfo, pbIV, cbIV, pbOutput, cbOutput, ...)

Hook 策略:
  onEnter: 记录 hKey、pbInput（明文/密文）、IV
  onLeave: 记录 pbOutput（密文/明文）
  注意: BCryptEncrypt 的 pbInput=明文，pbOutput=密文
        BCryptDecrypt 的 pbInput=密文，pbOutput=明文

算法识别:
  BCryptOpenAlgorithmProvider 的 pszAlgId 参数:
    "AES" / "3DES" / "RC4" / "RSA" / "ECDH" / "SHA256" 等
```

## Frida Hook 路由

以下场景直接使用 frida.md 对应章节，不需要重复编写：

- **CryptoAPI / BCrypt 参数捕获**（密钥/IV/明文）：frida.md `### PE 加密参数捕获` → CryptoAPI 块 + BCrypt 块
- **OpenSSL 明文截获**（SSL_read/SSL_write）：frida.md `### PE 加密参数捕获` → OpenSSL 块
- **Schannel 明文**：frida.md `### PE 加密参数捕获` → Schannel 块
- **网络原始流量**（connect/send/recv/WSASend/WSARecv/WinHTTP/WinInet）：frida.md `### PE 网络 + 注册表 + 文件 I/O 监控`

## SSLKEYLOGFILE

若目标使用 Schannel 且需要解密 Wireshark 抓包：

- 设置环境变量 `SSLKEYLOGFILE=C:\path\to\keys.log` 后启动目标
- Schannel 会自动将 TLS session key 写入该文件
- Wireshark → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename 指向 keys.log
- 注意：部分应用会清除该环境变量，此时需 Hook `ProcessIdToSessionId` 或直接在启动前通过注册表设置

## QUIC / HTTP3 注意

- QUIC 基于 UDP，传统 TCP proxy（Fiddler/Charles/mitmproxy）无法拦截
- 强制禁用 QUIC 回退 TLS：Chrome/Electron 启动参数 `--disable-quic`
- 或 Wireshark 3.0+ 直接解析 QUIC（需 SSLKEYLOGFILE 配合）

## 常见失误

- 在加密后 hook（send/recv）而不是加密前（SSL_write/SSL_read），只能拿到密文
- Schannel 场景用 OpenSSL hook 脚本，无法命中（两个完全不同的 TLS 栈）
- 忽略 SSL Pinning 导致连接失败（需要先绕过 pinning 才能获取明文）
- 混淆网络层和 TLS 层证据（send/recv 数据是密文，SSL_read/SSL_write 数据才是明文）
- BCryptEncrypt hook 中 onEnter 的 pbInput 是明文，onLeave 的 pbOutput 是密文 — 不要搞反
