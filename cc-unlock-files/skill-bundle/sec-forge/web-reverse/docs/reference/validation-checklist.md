<!-- publish: framework -->
# Validation Checklist

如果当前是在做 closeout 收尾，建议先阅读 `docs/reference/closeout-checklist.md`。

交付前逐项确认：

- `taskContract / executionModel / acceptanceModel` 是否存在且与当前目标一致
- 当前阶段是否明确
- 目标边界是否明确
- `route-state.json` 是否存在且可恢复
- Markdown 视图是否与 JSON 真源对齐
- `report.md` 是否包含”当前阶段”和”下一步”
- `fixtures.json` 是否可解析
- 专题产物是否不再是模板占位

> **挑战/验证码类任务（模式 A）的 acceptancePath 铁律**：`acceptanceModel.acceptancePath` 必须**可回指 `run/verify-once.mjs` 的真实输出锚点**——如成功日志行、`retCode`/`error==0`、通过率等可复查的证据——不得只写一句无证据的成功措辞（"已通过/已成功/求解通过"而无对应输出锚点）。文本措辞匹配不等于验收，验收以 verify-once 复现出的端到端服务端成功为准。

Closeout 前再读 `docs/reference/closeout-checklist.md`。
