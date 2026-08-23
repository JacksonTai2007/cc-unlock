export default {
  caseId: "web-vm-generic-template-workflow",
  status: "abstract-case",
  category: "vm-template",
  tags: ["vm", "template", "jsvmp", "wasm", "env", "tooling"],
  runtime: "browser-first -> local-rebuild -> port",
  focus: [
    "把单案例经验沉淀成可迁移的 VM 方法论，而不是只过当前站点",
    "先固定 boundary / payload / runtime config / host dependency / output 五层模型",
    "优先复用运行时取证、最小补环境、first-difference 差分，而非默认全量反虚拟化",
    "把模板、脚手架、task-local 产物三者一起沉淀，避免只有文档没有落地"
  ],
  stages: [
    "Observe",
    "Capture",
    "Rebuild",
    "Patch",
    "PureExtraction",
    "Port"
  ],
  deliverables: [
    "report.md",
    "run/vm-opcodes.txt",
    "run/vm-trace.jsonl",
    "run/dispatcher-map.md",
    "run/vm-decode-notes.md",
    "run/vm-handler-clusters.md",
    "run/vm-env-reads.json",
    "run/vm-bytecode-lifecycle.md",
    "run/vm-nesting-map.md",
    "run/vm-template-profile.json"
  ],
  requiredArtifacts: [
    "task.json",
    "report.md",
    "run/fixtures.json",
    "run/vm-opcodes.txt",
    "run/vm-trace.jsonl",
    "run/dispatcher-map.md",
    "run/vm-env-reads.json",
    "run/vm-bytecode-lifecycle.md",
    "run/vm-nesting-map.md",
    "run/vm-template-profile.json"
  ],
  checkpoints: [
    "已明确当前目标是“验收优先”还是“模板沉淀优先”，避免一上来把所有任务升级成纯算法提取",
    "已固定至少一组稳定样本，并区分 engine / payload / runtime config / host dependency / output",
    "已用运行时 trace 明确最小宿主依赖，而不是拍脑袋补整个浏览器",
    "已通过 first-difference 确认至少一处浏览器/本地分叉并写入 divergence 记录",
    "已把可迁移部分沉淀成 profile / template / tool，而不是把站点私有常量写死进模板"
  ],
  caveats: [
    "通用模板沉淀不等于复制某站点字段名、常量表、cookie 公式或正则锚点",
    "黑盒复用或浏览器可控复用已满足验收时，不要为了写模板强行深拆全部 opcode",
    "没有稳定样本、没有边界图、没有 first-difference 证据时，不要宣称模板已具备迁移性",
    "模板工具只应沉淀通用 hook / replay / diff 能力，站点私有逻辑应留在 task-local"
  ],
  notes: [
    "优先参考 references/vm-generic-reverse-template.md，再按需进入 vmp-playbook / wasm-jsvmp-bridge-playbook",
    "若当前任务同时包含 VM + WASM + env 指纹，先建立层间关系图，再决定哪个层负责主算法",
    "模板沉淀的最小闭环是：抽象 workflow + task template + tools/vm 脚手架，而不是只有文字说明"
  ]
};
