# 自动化任务输入模板

最少输入字段：

- `target`
- `objective`
- `requirements`
- `boundaries`

推荐补充：

- `successCriteria`
- `targetUrlPatterns`
- `targetKeywords`
- `targetFunctionNames`
- `targetActionDescription`
- `protectionHints`
- `localReproductionRequested`
- `apiCallExampleRequired`

## 填写原则

- 优先写清最终交付与验收
- 如果用户只接受边界级或路线级结果，要在 `successCriteria` 里明确写出
- 如果目标是本地复现或 Python 迁移，要显式写明
- 不要把真实 cookie / token / secret 写进模板

## 新方案下最重要的点

任务输入不是为了让模型先汇报阶段，而是为了让模型更快找到：

- 当前最值得激活的 entrypoint
- 当前最小 probe
- 当前真正的验收边界
