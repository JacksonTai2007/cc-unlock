## CTF 模式（PE/Windows）

### 分类

| 类型 | 首选动作 | 工具链 |
|---|---|---|
| Crackme（序列号/keygen） | strings + IDA 初筛；定位校验 | IDA -> Frida 参数捕获 -> keygen |
| 加壳 crackme | 熵值 -> OEP | x64dbg + ScyllaHide -> IDA |
| 反调试 crackme | 先绕过 | Frida 绕过 -> IDA |
| 自定义加密 | 通过 S-box/魔数识别 | IDA -> crypto 扫描 -> Python 求解 |
| VM crackme（自定义 VM） | dispatch + handler 表 | IDA 枚举 -> Stalker -> p-code -> 求解 |
| 约束重（分支多） | 符号执行候选 | angr/z3 -> SMT 求解 -> flag |
| .NET crackme | de4dot -> dnSpy | de4dot -> dnSpy -> Frida CLR |

### 快速初筛清单（<5 分钟）
```
[ ] strings -> 搜索 flag 格式（CTF{, FLAG{）
[ ] file + DIE -> 格式与壳判断
[ ] IDA imports：crypto（CryptXxx, EVP_, SHA, AES）+ anti-debug（IsDebuggerPresent, NtQueryInformationProcess）
[ ] Trace 入口 -> 首个有意义的分支
[ ] 搜索与常量字符串比较（serial/flag compare）
[ ] 比较附近出现 XOR/ROL/ROR -> 可能自定义加密
[ ] argv[1] 或 stdin -> 确认输入方式
[ ] 统计输入路径分支数 -> >30 -> 考虑 angr/z3
```

### 符号执行（angr）模板
```python
import angr, claripy, sys

proj = angr.Project("crackme.exe", auto_load_libs=False)

# Symbolic input: 16-char flag
flag_chars = [claripy.BVS(f"flag_{i}", 8) for i in range(16)]
flag       = claripy.Concat(*flag_chars)

state = proj.factory.entry_state(
    args=["crackme.exe", "AAAAAAAAAAAAAAAA"],
    add_options={angr.options.SYMBOL_FILL_UNCONSTRAINED_MEMORY,
                 angr.options.SYMBOL_FILL_UNCONSTRAINED_REGISTERS}
)
# Locate argv[1] pointer: inspect state.regs.rsp + offset or use concrete eval
# Typically argv[1] = state.memory.load(state.solver.eval(state.regs.rsp) + 0x18, 8)  # rsp+8*2 on Windows x64
argv1_ptr = state.solver.eval(state.memory.load(state.solver.eval(state.regs.rsp) + 0x18, 8, endness='Iend_LE'))
state.memory.store(argv1_ptr, flag)

# Constrain to printable ASCII
for c in flag_chars:
    state.solver.add(c >= 0x20, c <= 0x7E)

# Define success/failure addresses (from IDA)
GOOD_VA = 0x401ABC  # "Correct!" branch
BAD_VA  = 0x401DEF  # "Wrong!" branch

sm = proj.factory.simulation_manager(state)
sm.explore(find=GOOD_VA, avoid=BAD_VA)

if sm.found:
    sol = sm.found[0]
    flag_val = bytes([sol.solver.eval(c) for c in flag_chars])
    print("[*] Flag:", flag_val.decode("ascii", errors="replace"))
else:
    print("[-] No solution found - refine bounds or increase depth")
```

### z3 Keygen 模板
```python
from z3 import *

# Model extracted from IDA pseudocode
# Example: serial = f(username) with constraints
username = "testuser"
serial   = [BitVec(f"s{i}", 8) for i in range(8)]
s        = Solver()

# Constrain to alphanumeric
for c in serial:
    s.add(Or(And(c >= 0x30, c <= 0x39), And(c >= 0x41, c <= 0x5A)))

# Add reverse-engineered constraints from IDA pseudocode
h = 0
for c in username:
    h = ((h << 5) + h) ^ ord(c)
h &= 0xFFFFFFFF

# Example constraint: sum of serial bytes XOR'd = key low byte
s.add(Sum([ZeroExt(24, c) for c in serial]) == BitVecVal(h & 0xFF, 32))
# Add more constraints from IDA analysis...

if s.check() == sat:
    m = s.model()
    result = bytes([m[c].as_long() for c in serial])
    print("[*] Serial:", result.decode())
else:
    print("[-] Unsatisfiable - re-check constraints from IDA")
```

### CTF 解题模板（Python）
```python
#!/usr/bin/env python3
import struct, sys

KEY   = 0xDEADBEEF       # from IDA static or Frida capture
SEED  = b"\x41\x42\x43"

def decrypt(ct: bytes, key: int) -> bytes:
    return bytes(b ^ ((key >> (8*(i%4))) & 0xFF) for i,b in enumerate(ct))

CIPHER = bytes.fromhex("AABBCCDDEEFF...")
print("[*] Flag:", decrypt(CIPHER, KEY).decode("utf-8", errors="replace"))

def keygen(username: str) -> str:
    h = 0
    for c in username: h = ((h<<5)+h) ^ ord(c)
    return "SN-" + format(h & 0xFFFFFFFF, "08X")

if len(sys.argv) > 1:
    print("[*] Serial:", keygen(sys.argv[1]))
```

### 加密常量扫描器（IDA Python）
```python
import idc, idaapi, idautils
CONSTANTS = {
    0x67452301:"MD5/SHA1 init A", 0xEFCDAB89:"MD5/SHA1 init B",
    0x6A09E667:"SHA-256 H0",      0x9E3779B9:"TEA delta",
    0xB7E15163:"RC5 magic P32",   0x9E3779B1:"XTEA delta",
    0x61C88647:"XTEA key",        0x5A827999:"SHA1 K1",
    0x6ED9EBA1:"SHA1 K2",         0x8F1BBCDC:"SHA1 K3",
    0xCA62C1D6:"SHA1 K4",         0x428A2F98:"SHA-256 K[0]",
    0xD728AE22:"SHA-512 K[0]",    0x63636363:"AES S-box marker",
}
for seg_ea in idautils.Segments():
    seg = idaapi.getseg(seg_ea); ea = seg.start_ea
    while ea < seg.end_ea - 4:
        v = idc.get_wide_dword(ea)
        if v in CONSTANTS: print(f"  [CONST] {hex(ea)}: {hex(v)} = {CONSTANTS[v]}")
        ea += 1
```

### 加密算法快速识别（常量特征表）
```
算法         特征常量                                    识别要点
──────────────────────────────────────────────────────────────────────
AES          0x63,0x7C,0x77,0x7B (S-Box首字节)          10/12/14轮
DES          PC1/PC2置换表(无单常量)                      16轮Feistel
RC4          256次循环初始化 + %256 + swap                KSA+PRGA
ChaCha20     "expand 32-byte k" (常量字符串)              20轮quarter-round
Blowfish     0x243F6A88, 0x85A308D3 (P-array)            16轮Feistel
X25519       特定曲线常量                                 密钥交换
MD5          0x67452301, 0xEFCDAB89 (初始值)              4轮×16步
SHA1         0x67452301, 0xEFCDAB89, 0x98BADCFE          5轮×20步
SHA256       0x6A09E667, 0xBB67AE85                      64轮
TEA/XTEA     0x9E3779B9 (delta)                          32轮
CRC32        0xEDB88320 (多项式)                          表驱动
ISAAC-64     0x9e3779b97f4a7c15 (黄金比例)               256元素状态数组
```

IDA Python 识别脚本已在上方"加密常量扫描器"中提供。

### SMC(自修改代码)CTF处理

SMC 识别与处理方法详见 `references/anti-obf.md` SMC 章节。CTF 实战案例：Newstar 2024（动态解密+z3）、jocker（VirtualProtect+idapython）。
```
识别: mprotect/VirtualProtect调用 + 代码段XOR/ADD运算
Linux: mprotect后断点 → dump解密代码段
Windows: VirtualProtect后断点 → dump解密代码段
静态: IDAPython分析解密逻辑 → 脚本批量解密(适用于简单XOR)
CTF实战: Newstar 2024(动态解密+z3) / jocker(VirtualProtect+idapython)
```

### IEEE 754 NaN 绕过技巧
```
NaN特性: 所有比较(NaN==x, NaN!=x, NaN<x, NaN>=x)均返回false
CTF利用: 校验函数使用浮点比较时，输入NaN可绕过所有条件分支
x86指令: UCOMISS/COMISS设置EFLAGS不同 → 需注意PF=1的NaN情况
Python: struct.pack('<d', float('nan')) 构造NaN输入
```

---

