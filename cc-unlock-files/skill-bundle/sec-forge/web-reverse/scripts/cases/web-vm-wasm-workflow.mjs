export default {
  caseId: "web-vm-wasm-workflow",
  status: "abstract-case",
  category: "vm-wasm",
  tags: ["vm", "wasm", "hybrid"],
  focus: [
    "VM dispatcher 定位",
    "bytecode 来源与解码路径确认",
    "opcode / WAT 产物",
    "运行时中间值捕获",
    "bridge call 与 handler 分类",
    "VM -> WASM imports/exports -> memory bridge -> request-use 闭环"
  ],
  deliverables: [
    "report.md",
    "run/vm-opcodes.txt",
    "run/vm-trace.jsonl",
    "run/dispatcher-map.md",
    "run/wasm-imports-exports.json",
    "run/wasm-notes.md"
  ],
  checkpoints: [
    "已确认 VM boundary",
    "已拿到至少一条 pc -> opcode 轨迹",
    "已建立最小 opcode 映射",
    "已标注未确认 handler",
    "已确认至少一条 VM/WASM bridge 证据（imports/exports 或 memory IO）"
  ],
  caveats: [
    "未完成反虚化前不得下高置信语义结论",
    "需要把未完成部分写入 UNKNOWNS",
    "不要在未确认字节码边界前直接写伪反编译器",
    "同一语义层两轮无新增证据后必须 PARKED/EXHAUSTED 并跨层 pivot"
  ]
};
