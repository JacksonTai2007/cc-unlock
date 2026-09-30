# v2.4-alpha 提示词

- `claude.md` → `cc-unlock-files/claude-config-bundle/CLAUDE.md` → 用户选中的工作区 `CLAUDE.md`。
- `codex-system.md`、`codex-agents.md` → Codex 配置包；内容不因本次 Claude 调整而改动。

Claude 内容以用户提供的“工程分析工作笔记”为底稿，修正缺少 scope/keywords 文件时的处理、增加证据哈希和按需技能路由。保留真实任务性质，不使用虚构成功记录、术语替换或强制拒绝绕过指令。

本版不再携带或部署 memory、rollout、subagent、rules、agent-memory、修改版 Desktop。普通 Claude Desktop/CLI 的原生 System Prompt 不变；没有取得运行模型的误拦截率数据。

修改后运行 `node scripts/sync-prompts.cjs --write`、`node scripts/test-prompt-contract.cjs`、`node scripts/test-prompt-deployment.cjs`。发布构建命令见 `scripts/build-portable-v2.4.cjs` 和 `scripts/build-alpha-installer.cjs`。
