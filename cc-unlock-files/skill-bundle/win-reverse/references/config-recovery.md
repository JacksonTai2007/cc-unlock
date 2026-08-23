# Config / Blob Recovery Playbook

适用：许可证配置、资源 blob、注册表项、服务参数、加密配置、嵌入式协议模板、持久化元数据恢复。

## 命中信号

- 资源段中异常大的 `RT_RCDATA`（嵌入配置 blob）
- 注册表操作密集：`RegCreateKeyEx`/`RegSetValueEx`/`RegQueryValueEx`，路径含 `Software\<Vendor>`
- 加密 API 调用：`CryptDecrypt`/`BCryptDecrypt`/`CryptUnprotectData` 处理非通信数据
- 文件操作：`CreateFileW` + `ReadFile` 打开 `.cfg/.dat/.bin/.ini/.json/.xml` 配置文件
- 字符串线索：`"config"`/`"settings"`/`"license"`/`"activation"`/`"machine"`/`"hwid"`/`"key"`
- 自定义二进制格式：固定 magic + version + length + payload 结构

## 最小目标

1. 确定配置的存储位置和格式
2. 找到编码/加密/压缩的完整解码链
3. 提取关键字段并验证语义
4. 落盘 `run/config-recovery-notes.md`、`run/config-schema.md`、`run/blob-decode-notes.md`

## 阶段工作流

```
命中配置恢复信号
 ├─ 阶段1: 配置定位
 │   ├─ 静态: 资源段 / .rdata 常量 / 覆盖节 (overlay)
 │   ├─ 文件系统: INI/JSON/XML/自定义二进制 / %APPDATA% / %PROGRAMDATA%
 │   ├─ 注册表: HKCU\Software\<Vendor> / HKLM\SOFTWARE\<Vendor>
 │   └─ 网络: C2 下发 / 云端拉取 / 内嵌硬编码
 ├─ 阶段2: 解码链追踪
 │   ├─ 识别编码层: Base64 / Hex / 自定义 XOR / RC4 / AES / RSA
 │   ├─ 识别压缩层: zlib / aPLib / LZNT1 (RtlDecompressBuffer)
 │   ├─ 识别序列化: JSON / MessagePack / Protobuf / 自定义 TLV
 │   └─ 绘制完整链: raw blob → decode(X) → decompress(Y) → deserialize(Z) → fields
 └─ 阶段3: 字段提取与验证
     ├─ 提取关键字段（C2 地址、密钥、开关、时间戳等）
     ├─ 通过运行时行为验证字段语义
     └─ 无法确认的放入 UNKNOWNS
```

## IDA 分析技巧

### 资源 Blob 定位

```
1. View → Open Subviews → Resources (Shift+F7 → .rsrc 节)
2. RT_RCDATA 类型资源 → 查看大小和内容
3. IDA 中资源通过 FindResourceW/LoadResource/LockResource 链加载
4. 定位加载代码: xref 到资源 ID → LockResource 返回值即为 blob 指针
5. 常见模式:
   blob 结构: [magic 4B][version 2B][length 4B][encrypted_payload][checksum 4B]
```

### 自定义 XOR/RC4 解密识别

```
XOR 特征:
  1. 循环中每个字节与固定 key 异或: xor byte ptr [reg], imm8
  2. 多字节 key XOR: 按 key_length 取模循环
  3. IDA 模式: 小循环体 + 数组索引 + XOR 指令

RC4 特征:
  1. KSA (Key Scheduling Algorithm): 256 次循环的 swap 操作
  2. PRGA: 两个索引 i/j 递增 + swap + XOR 输出
  3. IDA 模式: 两个嵌套循环 + 256 元素 S-box 数组
  4. 常与 CryptAcquireContext 交替使用（可能用系统 API 也可能自实现）

AES 特征:
  1. CryptEncrypt/BCryptEncrypt 调用 → 检查 ALG_ID/BCRYPT_ALGORITHM_HANDLE
  2. 自实现: SubBytes (S-box lookup) + ShiftRows + MixColumns + AddRoundKey
  3. 密钥位置: 传入解密函数的参数 → 追踪密钥来源（硬编码/派生/外部读取）
```

### 注册表配置追踪

```
IDA 定位:
  1. 搜索 RegOpenKeyExW/RegCreateKeyExW 调用 → 获取注册表路径
  2. RegQueryValueExW → 读取配置值
  3. RegSetValueExW → 写入配置值
  4. 常见路径:
     HKCU\Software\<Vendor>\<Product>         — 用户级配置
     HKLM\SOFTWARE\<Vendor>\<Product>          — 系统级配置
     HKLM\SYSTEM\CurrentControlSet\Services\  — 服务参数

Frida 捕获:
  # Hook RegQueryValueExW 获取读取的值
  Interceptor.attach(Module.getExportByName("advapi32.dll", "RegQueryValueExW"), {
    onEnter(a) {
      this._name = a[1].readUtf16String();
      this._buf = a[4]; this._size = a[5];
    },
    onLeave(rv) {
      if (!this._buf.isNull() && !this._size.isNull()) {
        var sz = this._size.readU32();
        console.log("[RegQuery]", this._name, "size=", sz);
        if (sz > 0 && sz < 4096) console.log(hexdump(this._buf, {length: Math.min(sz, 256), ansi: true}));
      }
    }
  });
```

### 覆盖节 (Overlay) 分析

```
Overlay = PE 文件末尾、最后一个节之后的数据

定位:
  1. PE 头 SizeOfHeaders + 所有节的 PointerToRawData + SizeOfRawData 的最大值
  2. 文件大小 - 上述值 = Overlay 大小
  3. IDA: View → Open Subviews → Hex View → 滚动到文件末尾查看

常见用途:
  - 配置数据 / 加密 blob
  - 签名数据（某些壳在 overlay 存放数字签名）
  - 附加 PE / Shellcode（释放器/下载器）

分析:
  1. 检查 overlay 开头是否有 magic 标识
  2. 在 IDA 中搜索文件偏移 → 找到读取 overlay 的代码
  3. 代码通常通过 GetModuleHandle + 文件读写来访问 overlay
```

## Frida 模式交叉引用

```
场景                           frida.md 模式
──────────────────────────────────────────
加密参数捕获                   "PE 加密参数捕获" (CryptEncrypt/CryptDecrypt hook)
文件 I/O 监控                 "PE 网络 + 注册表 + 文件 I/O 监控" (CreateFileW/ReadFile hook)
注册表监控                    同上（RegQueryValueExW/RegSetValueExW hook）
字节特征扫描                  Pattern 4
动态 API 解析                 Pattern 8 (GetProcAddress hook)
```

## Observe

- 先确认配置可能落点：`.rdata/.data/.rsrc`、覆盖节、注册表、INI/JSON/XML、自定义数据库、服务参数、命名管道或 IPC
- 先区分"静态常量""运行时拼装""外部服务器下发"三类来源
- 不要把字符串命中直接当成最终字段语义，先找解码或归一化逻辑

## Capture

- 静态看：资源枚举、blob 长度、校验、压缩、base64/hex、自定义 XOR/RC4/AES、结构体解包
- 动态看：配置首次明文出现点、写入注册表/文件/服务配置的调用点、校验失败分支
- 若跨 native/.NET/脚本边界，分别记录每段 transform，避免把上层字段名和底层 blob 偏移混淆
- Frida 加密参数捕获块可在配置解密时一次性抓到明文

## Rebuild

- 产出 `config-schema.md`：字段名、来源、transform、语义
- 产出 `blob-decode-notes.md`：blob 从哪里来、经过哪些编码/解压/解密、如何验证
- 需要本地复现时，优先把"恢复配置所需的最小链"提纯，而不是整个样本主流程

## 验收建议

- 至少有一个字段通过运行时证据、成功重放、校验值或外部行为得到确认
- 未确认字段单独放到 `UNKNOWNS`，不要混进已确认配置

## 交付最少包含

- `run/config-recovery-notes.md`
- `run/config-schema.md`
- `run/blob-decode-notes.md`

## 常见失误

- 把加密 blob 的 Base64 编码层误认为最终内容（实际上还有解密/解压层）
- 找到密钥后忽略 IV/nonce（AES-CBC 需要 IV，AES-GCM 需要 nonce + tag）
- 注册表值类型不匹配（REG_SZ vs REG_BINARY vs REG_DWORD，解码方式不同）
- overlay 数据偏移计算错误（忘记文件对齐或 PE 头大小）
- 忽略配置校验（修改配置后校验失败导致程序拒绝加载）
