# Contributing to cc-unlock

感谢你对 cc-unlock 的兴趣！以下是贡献指南。

## 如何贡献

### 报告 Bug

1. 在 Issues 中搜索是否已有相同问题
2. 创建新 Issue，包含：
   - 操作系统和版本
   - Claude Code 版本
   - 使用的模型（Opus 4.8 / Fable 5 / 其他）
   - 复现步骤
   - 预期行为 vs 实际行为

### 提交示例

如果你发现某个安全研究领域的示例不够或需要优化：

1. Fork 本仓库
2. 在 `cc-unlock-files/config-bundle/CLAUDE.md` 的对应类别中添加/修改示例
3. 确保示例符合以下标准：
   - 覆盖真实的安全研究场景
   - 包含具体的技术细节和代码
   - 不含粗俗语言或角色扮演元素
4. 提交 PR 并说明修改理由

### 模型适配

如果你发现新模型版本的行为模式变化：

1. 记录模型名称、版本、行为模式
2. 在 Issue 中描述：触发条件、模型响应、建议的对策
3. 或直接提交 PR 修改 CLAUDE.md 中的模型适配部分

## 开发流程

```bash
# Fork 并克隆
git clone https://github.com/YOUR_USERNAME/cc-unlock.git
cd cc-unlock

# 创建分支
git checkout -b feature/your-feature

# 测试部署
# Windows:
.\cc-unlock-files\deploy.ps1 -Mode deploy
# macOS/Linux:
./cc-unlock-files/install.sh

# 验证
# Windows:
.\scripts\test.bat
# macOS/Linux:
./scripts/verify.sh

# 提交
git commit -m "描述你的修改"
git push origin feature/your-feature
```

## 准则

- 保持示例的专业性——不使用粗俗语言或攻击性人格
- 示例质量优先于数量
- 所有安全研究活动须在合法授权范围内
- 遵循项目的术语规范表
