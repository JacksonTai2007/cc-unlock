# JS-VM / WASM 逆向（T4–T7）

> **边界声明（别用错文档）**：本页是 **VM/WASM boundary 速查清单**——用于**快速对照** boundary / dispatcher / opcode 术语与识别指纹、判断"是不是 VM / 是不是 WASM"。它**不是深拆手册**：
> - 深拆 **JSVMP**（dispatcher/opcode→handler 还原、动态插桩、语义提升）→ 回 `vmp-playbook.md`（JSVMP 总入口）。
> - 深拆 **WASM**：运行时桥接/语义恢复 → `wasm-runtime-playbook.md`；二进制结构/内存/算法识别/反编译 → `wasm-binary-analysis-playbook.md`。
> - **何时用本页而非 vmp-playbook**：刚命中疑似 VM/WASM、需要先用指纹确认类型、对齐术语、决定走哪条深拆线时，用本页速查；一旦确定要深拆，立即切到对应 playbook，不要在本页硬啃。
>
> 次序与 `SKILL.md` 路由表一致：先 `vmp-playbook.md` → 命中 WASM 桥接再 `wasm-jsvmp-bridge-playbook.md` → 媒体解密走 `media-drm-playbook.md`；本页仅作速查。

使用场景：发现 VM 调度器 / 字节码数组，或检测到 WASM 参与核心逻辑。

## JS-VM 识别与反虚化

**指纹：**

- 大型 opcode / 字节码数组（`Uint8Array` / base64 blob）
- 调度循环：`while (pc < bytecode.length) { op = bytecode[pc++]; switch(op) { ... } }`
- 虚拟寄存器或栈结构：`regs[]` / `stack.push(pop)`
- opcode → handler 映射表
- constructor / run / exec 三段式 VM 初始化
- 字节码解码链：base64 / xor / inflate / 自定义 unpack 后再进入 VM

**建议步骤：**

1. 先定位 `VM boundary`：constructor、bytecode decode、dispatcher、state object
2. 确认字节码来源和装载方式，必要时先抓解码后的 bytecode
3. 记录 opcode → handler 映射，输出 `vm-opcodes.txt`
4. 动态插桩：至少记录 `pc/opcode`，有条件再记录 `stack/regs/call bridge`
5. 对 opcode 按控制流、算术、对象访问、调用桥分类
6. 结合 AST / 运行时日志做语义提升
7. 把未确认 handler 明确写入 `UNKNOWNS`

> 深拆细则（插桩位点优先级、最小完成判据、handler 分析顺序）不在本速查页：见 `vmp-playbook.md`（JSVMP 总入口）；WASM 运行链见 `wasm-runtime-playbook.md`。本页只保留"是不是 VM"的识别与 boundary 速查骨架。

## 常见误判

- 把 CFG 扁平化误判成 VM
- 把状态机误判成字节码解释器
- 只因出现 `switch` 就认定为 dispatcher
- 没有确认 bytecode decode 就对 opcode 做静态猜测

## WASM 识别与分析

**指纹：**

- `WebAssembly.instantiate` / `instantiateStreaming`
- 网络请求 `.wasm`
- emscripten / wabt 相关特征

**建议步骤：**

1. 导出 wasm 文件
2. `wasm-dis` 生成 WAT（保存 `wasm-analysis.wat`）
3. 用反编译/二进制分析定位关键函数：有 `ida-pro-mcp` / `radare2` MCP 优先用之，皆无退 wabt——具体能力→API 映射见 `wasm-binary-analysis-playbook.md` §1.1c
4. 运行时 hook WASM 导入 / 导出函数

## 混合防护（T6/T7）

- T6：先 JS-VM 反虚化，再进入 WASM 语义恢复
- T7：外层混淆 → 中层 VM → 内层 WASM，按层剥离，分层产物交付

## 交付建议

- `run/vm-opcodes.txt`
- `run/vm-trace.jsonl`
- `run/dispatcher-map.md`
- `run/wasm-analysis.wat`
- `report.md` 中的 VMP 完整度说明

