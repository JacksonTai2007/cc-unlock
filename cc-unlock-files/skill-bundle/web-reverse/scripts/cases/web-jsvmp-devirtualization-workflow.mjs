export default {
  caseId: "web-jsvmp-devirtualization-workflow",
  status: "abstract-case",
  category: "jsvmp-devirtualization",
  tags: ["jsvmp", "vm", "dispatcher", "opcode"],
  focus: [
    "VM boundary 与 bytecode decode 证据链",
    "dispatcher / handler table / bridge 三层运行时追踪",
    "handler 分类与最小 opcode book",
    "多层 VM / VM + WASM 的分层拆解"
  ],
  deliverables: [
    "report.md",
    "run/vm-opcodes.txt",
    "run/vm-trace.jsonl",
    "run/dispatcher-map.md",
    "run/vm-decode-notes.md",
    "run/vm-handler-clusters.md"
  ],
  checkpoints: [
    "已确认 bytecode decode 链至少一层",
    "已取得 dispatcher 入口和至少一类 handler 运行时样本",
    "已记录 bridge / host call 或明确其不存在",
    "已将未确认 opcode / handler 写入 UNKNOWNS"
  ],
  caveats: [
    "未确认 bytecode decode 前，不得直接手写伪反编译器",
    "未形成 handler 分类前，不得过早按业务语义命名",
    "多层样本必须按层输出证据，不得把不同层 trace 混写"
  ]
};
