# Cases

case 只负责提供抽象 workflow，不放真实样本。
case 字段契约见 `docs/reference/case-recipe-contract.md`。

续跑 task-local 时，阅读顺序固定为：

1. 先读技能入口与 workflow
2. 再读 `artifacts/tasks/<task-id>/task.json`
3. 再读 `artifacts/tasks/<task-id>/state/route-state.json`
4. 再读 `artifacts/tasks/<task-id>/state/route-plan.md`
5. 视需要补读 `state/clues.md`、`state/progress.md`

- `route-state.json` 是恢复真源，Markdown 只用于补充查看
- case 只负责提供抽象 workflow，不替代 task-local 当前状态
- case 需要显式声明候选 entrypoints、最小 probe 顺序、pivot 信号与成功判据
- case 的 `deliverables` 需要至少覆盖所属 topic 的 `formalValidation.requiredArtifacts`

