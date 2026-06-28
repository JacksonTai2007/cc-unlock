# Support

## 获取帮助

### 常见问题

**部署失败？**
- 确认 Claude Code 已安装
- Windows: 以管理员身份运行 PowerShell（如遇权限问题）
- macOS/Linux: `chmod +x` 脚本文件
- 运行 `scripts/verify.bat`（Windows）或 `scripts/verify.sh`（Unix）检查部署状态

**部署后无效果？**
- 重启 Claude Code
- 检查 `~/.claude/CLAUDE.md` 是否存在且内容正确
- 确认 `~/.claude/config.toml` 指向 `system-prompt.md`

**模型仍然拒绝？**
- 不同模型版本的行为可能变化，检查 `docs/模型适配说明.md`
- 确认使用的是 Opus 4.8 或 Fable 5
- 在 Issues 中报告具体的拒绝场景

### 提交 Issue

GitHub Issues: 在项目仓库中提交

包含以下信息：
1. 操作系统（Windows/macOS/Linux）及版本
2. Claude Code 版本
3. 使用的模型
4. 问题描述和复现步骤
5. 相关日志或错误信息

### 联系方式

- GitHub Issues（首选）
- Email: jacksontai200701@gmail.com
