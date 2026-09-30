# Changelog

## v3.0-stable / 3.0.0 — 2026-10-01

### 历史上下文维护

- Codex 运行中也可一键处理磁盘历史，不以运行状态阻止字段清理，不要求先扫描。
- 仅置空命中旧 Collaboration Mode 模板的 developer 指令字段；保留对话、用户/助手消息、邻接行、其他字段及 SQLite。
- 锁目录从当前用户主目录动态解析，固定先删除其中所有文件（含隐藏和子目录文件，保留目录），再清理匹配字段；不要求 Codex 退出，不依据进程状态跳过，失败如实记录。运行中的 writer 可能在删除后重新建锁。
- 使用匹配 token 的等长定位写入，保留并发追加及文件偏移；变更冲突、短写和访问失败报告部分完成。删锁不取得独占写入，磁盘清理不代表当前已载入上下文更新，同一位置仍有乐观并发限制。

### 部署与技能

- Claude 使用原版客户端与工作区 `CLAUDE.md + sec-forge`；不包含改版/副本客户端，不替换原生 `systemPrompt`。
- 不部署记忆、rollout 摘要、子 agent、rules 或 agent-memory；保留独立任务范围与平台拒绝的真实记录。
- `sec-forge` 收紧目标路由和验证预算，不默认重复哈希或扩大任务范围。
- `win-reverse` 升级到 0.3.0，去除硬编码目标和重复完整性检查，修正门禁语义。
- `web-reverse` 升级到 0.1.1，采用实际宿主路径和当前浏览器能力文档，复用首次预检。

### 构建与发布

- 统一版本 `3.0.0` / `v3.0-stable`，Windows 便携与安装器入口为 `scripts/build-portable.cjs`、`scripts/build-installer.cjs`。
- 构建依赖由 `scripts/build-dependencies.cjs` 解析，NSIS 使用显式 `CC_UNLOCK_MAKENSIS` 或本地 `.build-tools` 编译器。
- 源码与运行目录、会话、构建中间件及发行包分离，发布文档不声称绕过 provider safeguard 或改善未经评测的模型拒绝率。

历史版本的客户端副本、多层记忆部署、统一提示词和离线清理要求不代表当前行为。旧实现请查对应仓库历史；当前操作见 [README](README.md)。
