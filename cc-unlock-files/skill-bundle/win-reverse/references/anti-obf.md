## 反混淆策略

### 混淆类型识别决策树
```
遇到混淆代码
  ├─ 控制流复杂化
  │   ├─ switch-case分发+状态变量 → CFF(控制流平坦化) → 见CFF反混淆
  │   ├─ 永真/永假分支+克隆块 → BCF(虚假控制流) → 见BCF反混淆
  │   └─ call [全局变量+掩码] → IndirectCall → 反向切片+符号执行
  ├─ 数据混淆
  │   ├─ 字符串加密 → 见字符串解密5种方法
  │   ├─ 常量拆分(mov rax,A; add rax,B; ...) → 模式匹配折叠
  │   └─ 结构体字段拆分 → Polaris AliasAccess → 全局变量聚合
  ├─ 指令级混淆
  │   ├─ 垃圾指令插入 → 死代码消除
  │   ├─ 等价指令替换 → 模式匹配还原
  │   └─ 运行时代码修改 → SMC(自修改代码) → 见SMC处理
  └─ VM保护 → 见 references/packers.md VMP章节
```

### 字符串解密（5种方法按场景选用）
```
方法1(动态调试): 解密函数断点 → 运行到断点 → 读解密后缓冲区
方法2(Unicorn模拟): 提取解密函数机器码 → Unicorn执行 → 读输出缓冲区
方法3(IDA插件): 检测栈上字符串引用 → Unicorn动态模拟 → 自动注释结果
方法4(angr callable): 解密函数设为callable → 传入密文 → 自动返回明文
方法5(r2pipe+angr): r2pipe分析结构 → angr符号执行求密钥 → 批量解密

快速路径: 对可疑字节数组做 xref -> 找密钥材料 -> 优先用 IDAPython 脚本（见 static-analysis.md 脚本 5/6）或方法3/4静态模拟解密；
若静态模拟不可行（动态密钥/反射加载），再用 Pattern 1/2 hook -> onLeave dump 明文 -> 回写 IDA/JEB 注释。
.NET：先 de4dot，再考虑是否需要 hook 委托。
```

### CFF(控制流平坦化)反混淆（4种方法）
```
识别特征: dispatcher块(高入度) + switch变量(PHI节点) + case块常量驱动

方法A - IDA Microcode值域分析(首选):
  gen_microcode(MMAT_CALLS) → 找PHI节点(状态变量)
  → valrng_t/get_valranges确定每个块的入口状态值
  → VR_AT_START映射状态值→基本块 → 按原始顺序重连 → 删除分发器

方法B - 编译器优化消除:
  编写LLVM FunctionPass → 识别switch-case分发模式
  → 常量传播确定case值 → 死代码消除移除分发器 → 基本块重排序

方法C - angr符号执行:
  DFS探索记录路径约束 → 识别分发变量符号表达式
  → solver求解每个case的输入值 → 按结果重建控制流

方法D - IDA IDC脚本(手动):
  找CFF入口和状态变量 → 遍历case块 → 提取状态值和真实后继
  → 修补跳转直连真实后继 → NOP填充分发器
```

### BCF(虚假控制流)反混淆（3种方法）
```
识别特征: 不透明谓词(x*(x+1)%2==0 / y<10 || ...) + 不可达克隆块
Polaris变体: Var0=((A*Var0)%Mod-B)%Mod (模逆运算)

方法1 - angr反向切片:
  从条件跳转反向切片(DDG) → 符号执行判断永真/永假 → NOP假分支

方法2 - z3求解器:
  提取谓词表达式 → z3验证恒真/恒假 → 删除不可达块

方法3 - IDA + patch:
  手动分析不透明谓词 → 直接patch跳转指令
```

### Polaris-Obfuscator 特殊混淆
```
IndirectCall: 直接调用→全局变量+随机掩码偏移
  反混淆: 反向切片 + angr符号执行 + keystone patching

AliasAccess: 结构体字段拆分到独立全局变量
  反混淆: 识别全局变量组 + 重新聚合为结构体

MBA(混合布尔算术): 复杂数学表达式替代简单运算
  反混淆: 模式匹配 + 简化规则
```

### SMC(自修改代码)处理
```
识别: mprotect/VirtualProtect调用(改内存权限) + 代码段XOR/ADD运算

Linux: mprotect后断点 → dump解密代码段
Windows: VirtualProtect后断点 → dump解密代码段
静态: IDAPython分析解密逻辑 → 脚本批量解密(适用于简单XOR)
CTF: Newstar 2024(动态解密+z3) / jocker(VirtualProtect+idapython静态解密)
```

**加壳/保护：** 详见 `references/packers.md`（熵 > 7.2 视为加壳；OEP/IAT 修复；VMP/Themida/Enigma 专用章节）。

**PE 完整性校验绕过：** 详见 `references/protection-bypass.md`（CRC 校验、PE 头校验和、WinVerifyTrust、Anti-tamper 线程、.NET ConfuserEx）。

**CFG（Control Flow Guard）注意事项：** 详见 `references/protection-bypass.md` CFG 章节（启用标志检测、Interceptor.replace 限制、内联补丁安全方案、`_guard_check_icall` xrefs 定位）。

---
