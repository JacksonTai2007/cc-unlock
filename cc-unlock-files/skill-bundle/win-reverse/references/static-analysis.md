## 静态分析工作流：IDA / radare2 核心方法论

### 快速导航

- 分诊入口：搜 `### PE 分诊检查清单`
- IDA 工作流：搜 `### IDA Pro 核心工作流`
- radare2 工作流：搜 `### radare2 核心工作流`
- 算法恢复：搜 `### 算法恢复模式库`
- 校验/完整性分析：搜 `### 校验与完整性分析模式`
- 签名识别：搜 `### 签名与模式识别`
- 交叉引用驱动分析：搜 `### xref 驱动分析模式`
- 反编译辅助：搜 `### 反编译辅助模式`
- Electron / ASAR 静态分析：搜 `### Electron / ASAR 静态分析`

### 目录

1. PE 分诊检查清单
2. IDA Pro 核心工作流
3. radare2 核心工作流
4. 算法恢复模式库
5. 校验与完整性分析模式
6. 签名与模式识别
7. xref 驱动分析模式
8. 反编译辅助模式
9. Electron / ASAR 静态分析
10. 静态分析优先决策树

### PE 分诊检查清单
```
[ ] 识别架构：x86 / x64 / WOW64 / .NET / mixed-mode
[ ] 编译器指纹：MSVC 版本 / MinGW-GCC / Clang / Delphi / Go / Rust
[ ] 导入表快速扫描：关注 CreateFileW / RegOpenKeyEx / InternetConnect / CryptDecrypt
[ ] 资源节检查：是否有加密 blob / 嵌入 PE / 配置数据
[ ] 壳检测：UPX / Themida / VMP / Enigma / 自定义 packer
[ ] .NET 元数据：#Strings / #Blob / MethodDef 表大小
[ ] 签名验证：Authenticode 签名是否存在、是否有效
[ ] ASAR / JSC / bytecode 资产扫描（Electron 目标）
[ ] 字符串快速扫描：URL / 注册表路径 / 错误消息 / base64 blob
```

### IDA Pro 核心工作流

#### 模式 1 - 从导入表定位关键函数
```
1. 打开 Imports 窗口
2. 标记高价值导入：CreateFileW, CryptDecrypt, RegSetValueEx, InternetConnect
3. 对每个导入按 X 查看交叉引用
4. 从调用点向上追溯调用链
5. 标注每个调用点的上下文（初始化/验证/数据解析）
```

#### 模式 2 - 字符串驱动分析
```
1. Shift+F12 打开 Strings 窗口
2. 搜索关键词：license, activation, verify, check, valid, expired
3. 双击字符串跳转到数据段
4. 按 X 查看引用该字符串的代码
5. 从引用点反推控制流（if/switch 分支）
6. 标注条件分支的判据和结果
```

#### 模式 3 - 函数签名恢复
```
1. 在目标函数处按 Y 修改函数原型
2. 根据调用约定确定参数：
   - x64: RCX, RDX, R8, R9
   - x86 thiscall: ECX=this, stack params
   - x86 cdecl: 全部通过 stack
3. 重命名参数（N 键）
4. 追踪参数流向，确定数据类型
5. 重建结构体（Structures 窗口）
```

#### 模式 4 - 控制流重建
```
1. F5 反编译目标函数
2. 识别关键分支（if/switch）
3. 追踪条件变量来源
4. 标注每个分支的语义（验证通过/失败）
5. 确定入口条件（什么值触发哪个分支）
6. 记录：函数地址 + 条件表达式 + 分支语义
```

#### 模式 5 - 加密算法识别
```
1. 识别常量：AES S-Box (0x63, 0x7C, ...), SHA-256 K (0x428A2F98, ...), RSA 大数运算
2. 使用 IDA FindCrypt 插件或 FLIRT 签名匹配
3. 确认算法类型和模式（ECB/CBC/CTR 等）
4. 定位密钥材料来源（硬编码 / 派生 / 外部传入）
5. 记录：算法名称 + 模式 + 密钥来源 + IV 来源
```

### radare2 核心工作流

#### 模式 1 - 快速分诊
```bash
r2 -A target.exe          # 打开并自动分析
iI                        # 二进制信息（arch, bits, compiler）
ii                        # 导入表
iE                        # 导出表
iz~keyword                # 字符串搜索
afl~keyword               # 函数列表搜索
```

#### 模式 2 - 函数分析
```bash
s sym.function_name       # 跳转到函数
pdf                       # 反汇编函数
VV                        # 可视化控制流图
afn new_name              # 重命名函数
afv                       # 查看局部变量
axt @ addr                # 交叉引用到此处
axf @ addr                # 交叉引用从此处
```

#### 模式 3 - 算法恢复
```bash
pdc @ addr                # 伪代码反编译
pxw 256 @ addr            # 十六进制 dump（搜索常量）
/w keyword                # 搜索字符串
/x 428a2f98               # 搜索 hex pattern（SHA-256 K 常量）
```

### 算法恢复模式库

#### 模式 1 - RSA 签名验证恢复
```
1. 定位 crypto.publicDecrypt 或 BCryptVerifySignature 调用
2. 确认公钥来源（硬编码 / 资源 / 配置文件）
3. 确认签名数据来源（文件 hash / license blob / 网络响应）
4. 追踪验证结果的消费者（哪个 if 分支使用验证结果）
5. 记录完整的验证链：数据 -> hash -> 签名 -> 验证 -> 分支
```

#### 模式 2 - 自定义校验和/哈希恢复
```
1. 从校验失败的处理代码反向追踪
2. 找到校验函数（通常返回 bool / 设置标志位）
3. 反编译校验函数，识别算法结构
4. 检查是否为标准算法变体（CRC32 / Adler32 / MurmurHash / xxHash）
5. 如果是自定义算法，逐条还原计算步骤
6. 记录：输入数据范围 + 算法步骤 + 期望值比较
```

#### 模式 3 - 许可证字段解析
```
1. 从许可证格式相关字符串定位解析代码
2. 识别许可证数据结构（JSON / protobuf / 自定义二进制）
3. 追踪每个字段的读取和验证逻辑
4. 记录字段语义：email / machineCode / expiry / feature flags
5. 确定哪些字段参与签名验证，哪些是明文
6. 完整记录许可证结构和验证链
```

#### 模式 4 - 协议格式恢复
```
1. 从网络发送/接收函数定位协议处理代码
2. 识别数据包结构（magic / header / payload）
3. 追踪序列化/反序列化函数
4. 确认加密层（TLS / 自定义加密 / 无加密）
5. 记录完整的协议格式和字段语义
```

### 校验与完整性分析模式

#### 模式 1 - ASAR 完整性校验分析
```
1. 在 Typora.exe 中搜索 hash/sha256/verify 相关字符串
2. 定位读取 ASAR 文件的函数（ReadFile / CreateFileMapping）
3. 追踪文件内容到 hash 计算函数的调用链
4. 确认 hash 算法（SHA256 / CRC32 / 自定义）
5. 确认 hash 比较目标（硬编码值 / 数字签名 / 配置文件中存储的值）
6. 记录：hash 算法 + 比较目标 + 校验触发时机
7. patch 策略：修改比较指令（je->jmp）或 hook hash 函数返回期望值
```

#### 模式 2 - PE 自校验分析
```
1. 搜索 .text 节的 CRC / checksum 验证代码
2. 定位校验函数（通常在启动早期或定时器回调中）
3. 确认校验范围（整个 PE / 特定节 / 关键函数）
4. 记录校验触发点和绕过方案
```

#### 模式 3 - 重启/配置验证分析
```
1. 定位注册表读取函数（RegOpenKeyEx / RegQueryValueEx）
2. 追踪读取到的值到验证函数的调用链
3. 确认验证逻辑：本地校验 / 远程校验 / 混合
4. 确认验证失败后的行为（清空 / 弹窗 / 退出）
5. 记录完整的验证链和触发条件
```

### 签名与模式识别

#### 模式 1 - 编译器/库签名
```
1. 使用 IDA FLIRT 签名匹配识别已知库函数
2. 标记已识别函数，减少分析面
3. 关注未匹配的自定义函数（这些是目标逻辑）
4. 常见库：OpenSSL, Crypto++, Boost, protobuf
```

#### 模式 2 - 加密常量识别
```
AES:       0x63, 0x7C, 0x77, 0x7B (S-Box 首字节)
SHA-1:     0x67452301, 0xEFCDAB89, 0x98BADCFE (初始哈希值)
SHA-256:   0x6A09E667, 0xBB67AE85 (初始哈希值)
MD5:       0x67452301, 0xEFCDAB89 (与 SHA-1 共享前两个)
CRC32:     常见于 0xEDB88320 (多项式反转)
Blowfish:  0x243F6A88, 0x85A308D3 (P-array 初始值)
RC4:       无常量特征，需要识别初始化循环 (0-255 递增的 S-Box 构建)
ChaCha20:  "expand 32-byte k" (0x61707865, 0x3320646e)
```

#### 模式 3 - 反调试模式
```
IsDebuggerPresent:      直接调用，检查 PEB.BeingDebugged
NtQueryInformationProcess: ProcessDebugPort(7), ProcessDebugObjectHandle(30)
CheckRemoteDebuggerPresent: 通过 API 检查
Timing checks:          GetTickCount / QueryPerformanceCounter 差值检测
Hardware breakpoints:   GetThreadContext 检查 DR0-DR3
SEH chain manipulation: 异常处理器中检测调试器
```

### xref 驱动分析模式

#### 模式 1 - 从结果反推原因
```
1. 从可观察的行为入口开始（弹窗 / 网络请求 / 文件写入）
2. 追溯到触发该行为的代码
3. 继续向上追溯条件变量
4. 重复直到找到根本判断逻辑
5. 这是最可靠的分析路径：从结果到原因
```

#### 模式 2 - 从输入追踪到输出
```
1. 从用户输入点开始（文件读取 / 注册表 / 网络响应）
2. 追踪数据流经的每个函数
3. 记录数据转换（解析 / 解密 / 验证）
4. 最终到达影响程序行为的分支点
5. 完整记录数据流路径
```

#### 模式 3 - 环形依赖分析
```
1. 当函数 A 调用函数 B，B 又调用 A 时
2. 标记所有递归和环形调用
3. 识别环形结构的目的（重试 / 状态机 / 事件循环）
4. 不要假设，通过 xref 确认每个调用路径
```

### 反编译辅助模式

#### 模式 1 - 类型恢复
```
1. 从函数调用约定推断参数类型
2. 从内存访问模式推断结构体布局
3. 从字符串操作推断缓冲区大小
4. 使用 IDA 结构体窗口定义重建的结构体
5. 应用类型到反编译输出，提高可读性
```

#### 模式 2 - 交叉验证
```
1. 静态分析得出假设后，不要直接 patch
2. 用另一种方法验证：如果通过 xref 分析得出结论，用字符串搜索确认
3. 如果通过反编译得出结论，用汇编级别检查确认
4. 至少两种独立方法确认同一个结论
5. 记录两种方法和各自的证据
```

#### 模式 3 - 批量标注
```
1. 识别一组相似函数（如多个加密函数）
2. 对整组函数使用一致的命名约定
3. 在每个函数入口添加注释说明用途
4. 记录组内函数的调用关系
5. 在 notes.md 中记录整体分析结论
```

### Electron / ASAR 静态分析

#### 模式 1 - ASAR 结构分析
```
1. 使用 asar list 列出 ASAR 内所有文件
2. 搜索关键文件：license, activation, verify, auth, main
3. 提取关键 JS 文件进行静态分析
4. 搜索关键字符串：publicKey, verify, license, activation
5. 追踪验证流程的完整调用链
```

#### 模式 2 - 宿主 EXE 分析
```
1. 在 Electron 宿主 EXE 中搜索 ASAR 相关字符串
2. 定位 ASAR 文件路径构造和完整性校验代码
3. 确认校验算法和校验触发时机
4. 分析 node 模块加载机制
5. 记录修改 ASAR 后的校验绕过方案
```

#### 模式 3 - JSC/Bytecode 分析
```
1. 识别 V8 bytecode 文件（.jsc）
2. 使用 v8-bytecode-decompiler 或类似工具反编译
3. 搜索关键函数签名
4. 追踪调用链
5. 注意：JSC 分析可能需要结合 JS 源码交叉验证
```

### IDAPython 自动化脚本库

#### 脚本 1 - 导入表扫描 + xref 映射
```python
# 自动扫描导入表，对高价值 API 生成 xref 报告
import idautils, idc, idaapi

HIGH_VALUE_APIS = [
    "CreateFileW", "CreateFileA", "ReadFile", "WriteFile",
    "RegOpenKeyExW", "RegQueryValueExW", "RegSetValueExW",
    "CryptDecrypt", "CryptEncrypt", "CryptDeriveKey",
    "InternetConnectW", "HttpSendRequestW",
    "CreateRemoteThread", "VirtualAllocEx", "WriteProcessMemory",
    "BCryptVerifySignature", "BCryptDecrypt",
]

for i in range(idaapi.get_import_module_qty()):
    name = idaapi.get_import_module_name(i)
    def cb(ea, fn_name, ordinal):
        if fn_name and fn_name.decode() in HIGH_VALUE_APIS:
            api_name = fn_name.decode()
            refs = list(idautils.CodeRefsTo(ea, 0))
            if refs:
                print(f"[IMPORT] {api_name} @ 0x{ea:X}")
                for ref in refs:
                    func = idaapi.get_func(ref)
                    func_name = idc.get_func_name(ref) if func else "no_func"
                    print(f"  <- called from {func_name} @ 0x{ref:X}")
    idaapi.enum_import_names(i, cb)
```

#### 脚本 2 - 字符串引用追踪
```python
# 搜索关键词字符串，生成引用点到函数的映射
import idautils, idc, idaapi

KEYWORDS = ["license", "activation", "verify", "valid", "expired",
            "trial", "register", "serial", "check", "hash", "signature"]

for s in idautils.Strings():
    text = str(s)
    if any(kw in text.lower() for kw in KEYWORDS):
        addr = s.ea
        refs = list(idautils.DataRefsTo(addr))
        if refs:
            print(f"[STRING] 0x{addr:X}: \"{text[:80]}\"")
            for ref in refs:
                func = idaapi.get_func(ref)
                fn = idc.get_func_name(ref) if func else "no_func"
                print(f"  <- referenced in {fn} @ 0x{ref:X}")
```

#### 脚本 3 - 加密常量扫描
```python
# 在二进制中搜索已知加密算法常量
import idc, idautils, idaapi

CRYPT_CONSTANTS = {
    0x67452301: "SHA-1/MD5 init H0",
    0xEFCDAB89: "SHA-1/MD5 init H1",
    0x98BADCFE: "SHA-1 init H2",
    0x6A09E667: "SHA-256 init H0",
    0xBB67AE85: "SHA-256 init H1",
    0x61707865: "ChaCha20/NaCl 'expa'",
    0x3320646E: "ChaCha20/NaCl 'nd 3'",
    0x428A2F98: "SHA-256 K[0]",
    0x428A2F98: "SHA-256 K[0]",
    0x5A827999: "SHA-1 K[1]",
    0x6ED9EBA1: "SHA-1 K[2]",
    0x63: "AES S-Box[0]",
}

for seg in idautils.Segments():
    seg_start = idc.get_segm_start(seg)
    seg_end = idc.get_segm_end(seg)
    for addr in range(seg_start, seg_end, 4):
        val = idc.get_wide_dword(addr)
        if val in CRYPT_CONSTANTS:
            print(f"[CRYPT] 0x{addr:X}: 0x{val:08X} = {CRYPT_CONSTANTS[val]}")
```

#### 脚本 4 - 函数批量重命名 + 注释
```python
# 对识别出的函数批量设置名称和注释
import idc

RENAMES = {
    # addr: (new_name, comment)
    # 在分析过程中填入
}

for addr, (name, comment) in RENAMES.items():
    idc.set_name(addr, name, idc.SN_NOCHECK)
    idc.set_cmt(addr, comment, 0)  # 0=non-repeatable comment
    print(f"[RENAME] 0x{addr:X} -> {name}")
```

#### 脚本 5 - 交叉引用链追踪
```python
# 从指定地址向上追踪调用链（深度可控）
import idautils, idc, idaapi

def trace_call_chain(addr, depth=5, visited=None):
    if visited is None:
        visited = set()
    if depth <= 0 or addr in visited:
        return
    visited.add(addr)
    func = idaapi.get_func(addr)
    if not func:
        return
    fn_name = idc.get_func_name(addr)
    callers = list(idautils.CodeRefsTo(func.start_ea, 0))
    for caller in callers:
        caller_func = idaapi.get_func(caller)
        caller_name = idc.get_func_name(caller) if caller_func else "external"
        print(f"{'  ' * (5 - depth)}{fn_name} <- {caller_name} @ 0x{caller:X}")
        if caller_func:
            trace_call_chain(caller_func.start_ea, depth - 1, visited)

# 用法: trace_call_chain(0xADDRESS, depth=5)
```

#### 脚本 6 - 模拟解密（替代 Frida onLeave dump）
```python
# 使用 Unicorn Engine 模拟执行解密函数，替代 Frida hook dump
# 需安装: pip install unicorn
from unicorn import Uc, UC_ARCH_X86, UC_MODE_64
from unicorn.x86_const import *

def emulate_decrypt(base_addr, code_bytes, encrypted_data, stack_size=0x100000):
    mu = Uc(UC_ARCH_X86, UC_MODE_64)
    # Map code + data + stack
    mu.mem_map(base_addr, len(code_bytes) * 2)
    mu.mem_write(base_addr, code_bytes)
    data_addr = base_addr + len(code_bytes) + 0x1000
    mu.mem_map(data_addr, 0x10000)
    mu.mem_write(data_addr, encrypted_data)
    stack_addr = 0x7FF0000000
    mu.mem_map(stack_addr, stack_size)
    mu.reg_write(UC_X86_REG_RSP, stack_addr + stack_size // 2)
    # Run
    try:
        mu.emu_start(base_addr, base_addr + len(code_bytes))
        result = mu.mem_read(data_addr, len(encrypted_data))
        return bytes(result)
    except Exception as e:
        print(f"Emulation failed: {e}")
        return None
```

### 静态分析优先决策树

```
目标行为已知？（弹窗/网络/文件/校验失败）
├── 是 → 从行为入口开始 xref 反推 [模式 1]
│   ├── 找到验证函数 → 反编译 + 记录算法 [算法模式 1-4]
│   ├── 找到数据来源 → 追踪数据流 [xref 模式 2]
│   └── 找到分支逻辑 → 记录条件 + 结果
└── 否 → 从导入表/字符串开始扫描 [PE 分诊]
    ├── 高价值导入 → xref 追踪调用链
    ├── 关键字符串 → 定位到代码 → 反推控制流
    └── 加密常量 → 识别算法 → 定位密钥 → 恢复协议

只有在以下条件满足时才考虑动态分析（Frida/x64dbg）：
- 静态分析无法确定运行时数据（如动态解密、反射加载）
- 需要确认静态分析的假设是否正确
- 目标有混淆/虚拟化，静态分析无法还原控制流
- 需要提取运行时生成的密钥或配置数据

决策原则：
1. 先静态后动态，不要反过来
2. 静态分析能回答的问题，不要用动态分析
3. 动态分析只在静态分析遇到硬障碍时使用
4. 每次使用动态分析前，记录"为什么静态分析不够"
```
