<!-- publish: framework -->
# Eval Assertion 协议

每个 eval 条目可携带 `assertions` 数组，用于程序化验证 skill 行为。

## 断言类型

### 文件存在断言

```json
{
  "type": "artifact_exists",
  "path": "artifacts/tasks/<task-id>/report.md",
  "description": "report.md 应已生成"
}
```

### 内容包含断言

```json
{
  "type": "content_contains",
  "path": "artifacts/tasks/<task-id>/report.md",
  "needle": "taskMode",
  "description": "报告应包含 taskMode 字段"
}
```

### 路由匹配断言

```json
{
  "type": "route_matches",
  "topic": "signature",
  "description": "应路由到 signature 专题"
}
```

### 推理标签断言

```json
{
  "type": "reasoning_tag_present",
  "tag": "acceptance-boundary-first",
  "description": "应包含 acceptance-boundary-first 推理标签"
}
```

### 推理标签禁止断言

```json
{
  "type": "reasoning_tag_forbidden",
  "tag": "resume-then-advance",
  "description": "新任务不应出现 resume 推理标签"
}
```

### 无任务产物断言（用于 shouldTrigger=false）

```json
{
  "type": "no_task_artifacts",
  "description": "不应创建任何 task artifacts"
}
```

### 多文件内容断言

```json
{
  "type": "content_contains_any_file",
  "paths": ["run/signature-input-map.md", "run/signature-fixtures.json"],
  "needle": "x-sign",
  "description": "至少一个签名产物文件应包含 x-sign 字段"
}
```

## 断言生成脚本

运行 `node tools/qa/generate-eval-assertions.mjs` 可根据现有 `expectedRoutes`、`expectedArtifacts`、`expectedReasoningTags` 字段自动生成基础断言骨架。

手动审查后运行 `node tools/qa/check-eval-regression.mjs` 验证。

## 自动生成规则

基于 eval 字段自动推导断言：

| 现有字段 | 自动生成的断言类型 |
|----------|-------------------|
| `expectedArtifacts` 中的路径 | `artifact_exists` |
| `expectedReasoningTags` 中的 tag | `reasoning_tag_present` |
| `forbiddenReasoningTags` 中的 tag | `reasoning_tag_forbidden` |
| `expectedRoutes` 中的 topic | `route_matches` |
| `shouldTrigger=false` | `no_task_artifacts` |
