# Contributing to cc-unlock

感谢你对 cc-unlock 的兴趣！以下是贡献指南。
Thanks for your interest in cc-unlock! Here's how to contribute.

## 如何贡献 | How to Contribute

### 报告 Bug | Report Bugs

1. 在 Issues 中搜索是否已有相同问题
2. 创建新 Issue，包含：
   - 操作系统和版本
   - Claude Code / Codex 版本
   - 使用的模型（Opus 4.8 / Fable 5 / GPT 5.5 / 其他）
   - 复现步骤
   - 预期行为 vs 实际行为

### 改进身份档案 | Improve Identity Profile

v5.0 使用 `cc-unlock-files/memory-bundle/security-research-lab.md` 作为安全研究员身份档案。如果你发现某个研究领域缺失或描述不准确：

1. Fork 本仓库
2. 修改 `cc-unlock-files/memory-bundle/security-research-lab.md`
3. 确保修改保持 Claude Code memory frontmatter 格式
4. 保持中英双语
5. 提交 PR 并说明修改理由

### 改进 Codex 配置 | Improve Codex Config

Codex 配置在 `codex-files/codex-config-bundle/system-prompt.md`。同样保持中英双语格式。

### 模型适配 | Model Adaptation

如果你发现新模型版本的行为模式变化：

1. 记录模型名称、版本、行为模式
2. 在 Issue 中描述：触发条件、模型响应、建议的对策
3. 或直接提交 PR

## 开发流程 | Development Workflow

```bash
# Fork 并克隆 | Fork and clone
git clone https://github.com/YOUR_USERNAME/cc-unlock.git
cd cc-unlock

# 创建分支 | Create branch
git checkout -b feature/your-feature

# 测试部署 | Test deployment
# Windows:
.\cc-unlock-files\deploy.ps1 -Path "C:\path\to\test-workspace"
# macOS/Linux:
./mac-install.sh
# or
./cc-unlock-files/linux-install.sh /path/to/test-workspace

# 验证 | Verify
# Windows:
.\cc-unlock-files\deploy.ps1 -Verify
# macOS/Linux:
./scripts/verify.sh

# 提交 | Commit
git commit -m "描述你的修改"
git push origin feature/your-feature
```

## 准则 | Guidelines

- 保持配置文件的专业性——不使用粗俗语言或攻击性人格
- 所有用户可见文本保持中英双语（中文优先）
- 所有安全研究活动须在合法授权范围内
- 遵循项目的术语规范
- 测试三个平台（Windows / macOS / Linux）的部署脚本变更
