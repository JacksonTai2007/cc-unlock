export default {
  caseId: "web-wasm-runtime-workflow",
  status: "abstract-case",
  category: "wasm-runtime",
  tags: ["wasm", "runtime", "glue"],
  focus: [
    "WASM 加载链、glue 层与导入导出映射",
    "Emscripten / wasm-bindgen / custom glue 边界识别",
    "线性内存输入输出边界取证",
    "关键导出函数调用与离线复现"
  ],
  deliverables: [
    "report.md",
    "run/wasm-analysis.wat",
    "run/wasm-runtime-hook-template.js",
    "run/wasm-imports-exports.json",
    "run/wasm-notes.md"
  ],
  checkpoints: [
    "已确认 WASM 加载方式与模块来源",
    "已确认 imports / exports 概要",
    "已确认至少一条关键导出调用样本",
    "已记录至少一处线性内存边界"
  ],
  caveats: [
    "拿到 WAT 不等于完成 WASM 逆向，必须补齐 glue 与运行时边界",
    "如果导出函数依赖指针，报告必须说明内存输入输出语义"
  ]
};

