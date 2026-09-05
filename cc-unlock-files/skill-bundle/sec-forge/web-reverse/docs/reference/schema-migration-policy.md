# Schema Migration Policy

本仓库的“schema”主要指三类真源：

1. `topics/*/topic.json`
2. `artifacts/tasks/_TEMPLATE/**`
3. `tools/task/*` / `tools/qa/*` 所依赖的 task state 结构

## 1. 版本化原则

- 小幅新增字段：优先保持向后兼容
- 重命名 / 删除字段：必须补 migration 说明
- 若会影响 task 解析或 QA 语义，必须同步更新：
  - `README.md`
  - `CHANGELOG.md`
  - 相关 guide / reference 文档

## 2. topic manifest 变更流程

改动 `topics/*/topic.json` 后，必须同步执行：

```bash
npm run sync:topics
npm run check:fast
```

若涉及 task contract、deliverable 或 route semantics，再补：

```bash
npm run check:full
```

## 3. task template / state schema 变更流程

改动以下任一层时：

- `artifacts/tasks/_TEMPLATE/**`
- `tools/task/validation.mjs`
- `tools/task/route-state.mjs`
- `tools/task/task-init.mjs`
- `tools/task/task-start.mjs`

必须补：

- 迁移说明
- 兼容性判断
- 必要时的 seed / sync / closeout 更新

## 4. 迁移说明最少应包含

- 变更背景
- 受影响文件
- 是否向后兼容
- 对旧 task-local 的影响
- 是否需要重新 seed / sync / rebuild generated docs
- 对 QA / eval 的影响

## 5. 推荐记录位置

- 面向发布：`CHANGELOG.md`
- 面向维护细节：对应 `docs/reference/*.md` 或 `docs/guides/release-workflow.md`

## 6. 禁止事项

禁止出现以下情况：

- 改了 `topic.json`，没同步 generated docs
- 改了 task template，却没更新 validation / docs
- 改了 contract，却没有任何 changelog / migration note
- 在 `PROMPTS.md` 先改规则，但 manifest / runtime 真源未更新
