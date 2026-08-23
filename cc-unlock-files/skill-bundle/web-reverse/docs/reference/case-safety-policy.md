<!-- publish: framework -->
# Case 安全规范

## 目标

- 把公开层与 task-local 执行层分开
- 不把站点细节、凭证、敏感数据写入公共文档

## 约束

- `artifacts/tasks/<task-id>/` 只服务当前任务
- Cookie、storage、header、响应样本默认只保留**最小验证快照**；能摘要就不要整包保存
- 如必须保留会话样本，优先写 redact 后版本，例如只保留键名、长度、哈希、前后缀或过期时间
- `live-browser-response-body.txt`、原始 cookie 串、整包响应正文不应成为默认交付；只有在无法替代且对当前任务验证必要时才保留
