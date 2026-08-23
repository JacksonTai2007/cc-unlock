## 强壳/保护处理

### VMProtect (VMP)

**版本快速识别：**
```
区段检查：.vmp0/.vmp1 存在 → 确认 VMP
入口特征：push imm32; call vm_entry  → 通用
  - v1.x-2.x (Delphi): 入口后 pushad 序列，handler 跳转表可预测
  - v2.12.3: 入口混淆 + 伪装寄存器保存 + 2字节伪码(handler索引+VR偏移)
  - v3.0+ (C++重构): push+ret代替jmp调度 + 4字节伪码 + 滚动密钥解密
  - v3.8+: Handler变形/一级二级Handler融合 + 虚拟寄存器加密偏移
  - v3.9.4: 加密调度混淆进一步增强
```

**覆盖率评估（先做）：**
```
1. IDA FLIRT -> 统计 VMP dispatcher 签名覆盖比例
2. VMP 特征：VM entry = PUSH imm32/JMP vm_dispatcher；handler 表常在 .vmp0/.vmp1 附近
3. 归类：仅虚拟化 / 仅变形 / 两者都有
4. 判断 VMP 版本（见上方版本表）-> 决定后续策略
```

**VM 入口分析步骤：**
```
1. 在被保护函数设断点 → 单步进入.vmp区段
2. 识别寄存器保存序列(pushad/pushfd 或逐个push)
3. 确认VM上下文初始化(VIP/VSP赋值)
4. 调度机制识别：
   - v2.x: jmp [handler_table + index*N]
   - v3.x: add edi,[edi]; push handler; ret (隐藏调度)
5. 滚动密钥解密(v3.x): xor eax,[ebp+key]
6. 虚拟寄存器映射：建立 VR编号 ↔ context偏移 表
```

**Handler 语义还原（4种方法按条件选用）：**
```
方法A - 源码对比法（v1.x ~ 3.5.1，需泄露源码）：
  编译VMP Debug x64 → 对比Handler实现与目标二进制 → 直接映射语义

方法B - Triton污点分析（通用，v3.x+）：
  x64dbg跟踪Handler序列 → 导出跟踪数据 → Triton过滤垃圾指令
  → 映射Handler语义（实战：v3.9.4 CMP/JNE需映射238个Handler）

方法C - 符号执行自动还原（通用）：
  收集Handler跟踪 → 施加符号约束 → 自动识别分支 → 生成等价指令
  工具：Triton + Miasm + Keystone

方法D - 编译器视角（概念驱动）：
  去混淆 ≈ 编译器优化：汇编 → VM语义 → C表达式 → 编译器优化
```

**VMP 7种混淆策略识别（v3.8+）：**
```
策略                    表现                          对策
───────────────────────────────────────────────────────────────
全指令变形              伪码读取/解密/Handler计算全变形  符号执行恢复语义
内存地址常量加密        每次运行地址不同               动态跟踪获取真实地址
Handler变形            VR地址计算与Handler合并         分离地址计算与Handler逻辑
一级Handler融合        链式Handler跳过中间存储         识别链式模式语义合并
二级Handler融合        跳过虚拟栈中间存储             栈抽象+值传播
寄存器释放             接近VM退出时恢复真实寄存器      识别退出序列
轮转寄存器替换         VR编号与物理寄存器动态映射      建立运行时映射表
```

**部分去虚拟化（覆盖率 < 40%）：**
```
1. IDA：定位 VM entry stub -> 标注 vm_entry_XXXXXX
2. x64dbg：对 vm_dispatcher 下硬件执行断点 -> 跟踪一个入口 -> 记录 p-code
3. Frida：hook vm_dispatcher -> 捕获 (entry imm32 -> native addr) 映射（Pattern 13）
4. 回写 IDA 注释；将 VM block 视为黑盒并记录 I/O
```

**完全去虚拟化（仅在关键路径覆盖 < 20% 时考虑）：**
```
1. VMPDump / vmprofiler 提取 .vmp 段
2. 构建 handler 表：映射 handler ID 到语义指令（MOV/ADD/XOR/PUSH/POP/JMP）
3. 重建 p-code 流并抬升为伪汇编；用 Frida Stalker 校验
4. VMP v3：如有 vtil（VMP Translator IL）优先；否则需要手工跟踪
```

**VMP OEP 定位（5种方法）：**
```
方法1(环境比较): 硬件断点 esp-4，OEP地址出现在栈上
方法2(API断点): CreateToolhelp32Snapshot作"暂停点"绕过硬件断点检测
方法3(内存断点): .vmp0区段执行断点
方法4(VM OEP): 识别VM退出序列(popad/popfd → jmp OEP)
方法5(签名匹配): VC6.0等编译器签名匹配定位OEP
```

**VMP IAT 修复流程：**
```
VMP IAT破坏：长跳转(jmp [mem])指向VMP模拟函数 → 模拟函数内调用真实API
修复步骤：
  1. 扫描IAT区域，对每个非系统模块地址
  2. 单步跟踪长跳转到达真实API地址
  3. x64dbg: RunToParty 1(运行到系统模块)加速定位
  4. 回写真实API地址到IAT
工具：vmp3-import-fix(开源，x86/x64) / Scylla / x64dbg脚本
```

**VMP 反调试绕过：**
```
BeingDebugged: PEB[0x02]置0
NtQueryInformationProcess: hook返回值
NtSetInformationThread(ThreadHideFromDebugger): hook忽略
TitanHide检测: 设备符号"\\\\.\\TitanHide"探测 → 卸载或隐藏驱动
```

### ASPack / UPX / 压缩壳

**压缩壳通用OEP定位：**
```
ESP定律(最快): EP处HR ESP → 运行到断点=OEP附近
UPX特征: popad/popad → jmp OEP
ASPack特征: popad → jmp [esp-4]
NSPack修复: PE头小写"pe"→改为"PE" + popfd/popad签名搜OEP
```

**通用脱壳工作流：**
```
1. PEiD/DIE查壳 → 确定壳类型和版本
2. OEP定位（见上方方法 + SFX/单步跟踪/最后一次异常）
3. Dump: LordPE/OllyDump/Scylla
   注意：Scylla在Virtual Size < Raw Size时有数据丢失bug
4. IAT修复: ImportREC/Scylla自动 / x64dbg脚本RunToParty 1
```

### Armadillo

**识别：** 双进程保护(CopyMem-II + Debug-Blocker)；OpenMutexA 互斥量；典型 Anti-Debug。

**脱壳：**
```
1. WriteProcessMemory断点 → 定位代码写入子进程
2. WaitForDebugEvent断点 → Debug-Blocker事件
3. Magic Jump补丁 → 绕过保护
4. 子进程中定位OEP → LordPE转储 + Scylla IAT修复
```

### ACProtect

**识别：** CRC校验 + SEH异常门 + IAT加密。

**通用脱壳(v1.09-2.0)：**
```
1. 内存断点 + SEH异常跟踪 → 恢复被窃取代码
2. 通过SE handler内存断点 → 捕获窃取代码
3. Magic JMP修改 → 绕过IAT加密
```

### EnigmaProtector

**识别特征：** EP_header/EP_Import 段；stub imports；导出 EnigmaGetHardwareID；XOR/ROL 字符串加密。

**流程：**
```
1. x64dbg + ScyllaHide -> 等保护初始化完成
2. 在原始代码段写入处下断点 -> 接近 OEP
3. IAT修复需分3种类型：
   类型1(模拟执行): 阻止VirtualAlloc覆盖，保留原始调用
   类型2(简单加密): 找到共享解密CALL，批量解密
   类型3(加密+模拟): 最复杂，需线程干扰对策
4. Frida：hook EnigmaGetHardwareID -> 捕获硬件指纹用于授权分析
5. Hook 字符串解密函数 -> dump 所有字符串
```

### Themida / WinLicense

**识别特征：** imports 极少（<5）；.themida/.winlice 段；TLS 回调做 SDK 初始化 + 反调试；大体积加密 overlay。

**OEP 恢复（x64dbg + ScyllaHide）：**
```
1. ScyllaHide 选择 "Themida/WinLicense" 预设 -> 运行
2. 在第一个 TLS 入口处下硬件执行断点 -> 等 SDK 初始化完成
3. 监视 VirtualAlloc(RWX) -> 新区域即解包后的 PE
4. 在 RWX 区域起始处下执行断点 -> OEP -> Scylla: Dump + Fix IAT -> 用 IDA 加载
```

**壳识别14条证据（通用）：**
```
[ ] 区段名异常(.vmp/.UPX/.enigma1等)
[ ] EntryPoint不在.text
[ ] EntryPoint指向非标准指令
[ ] RawSize远小于VirtualSize
[ ] Import Table只有1-2个DLL
[ ] IAT只有GetProcAddress/LoadLibrary
[ ] 节数量为1或异常
[ ] 存在壳特征字符串
[ ] 资源段异常大
[ ] 重定位表被清除
[ ] .text段属性异常(可写)
[ ] 存在非标准节
[ ] 壳自身的stub代码
[ ] PE头SizeOfImage与实际不符
```

### Safengine Shielden

**识别：** Hash加密API名称选项；IAT调用类型分为call/jmp/mov_reg三类。

**IAT修复(x64dbg脚本)：**
```
1. 识别三种IAT调用类型：call [addr] / jmp [addr] / mov reg,[addr]
2. 对每类分别处理：跟踪到真实API → 回写IAT
3. x64dbg脚本自动化三类修复
```

### PESpin

**识别：** 硬件断点反调试 + SEH异常驱动控制流。

**脱壳：**
```
1. 识别7个SEH异常 → 定位第3个(清除DR寄存器)
2. NOP清除DR寄存器的代码 → 绕过反硬件断点
3. 脚本化IAT修复：GetAPI/WriteIAT点批量处理
```

