# cc-unlock v3.0.1-stable

个人工程分析工作台。部署 Claude / Codex 工作区指令与 `sec-forge` 技能，维护 Codex 磁盘历史。应用版本为 `3.0.1`。

## 功能与边界

- **Claude**：向选定工作区部署 `CLAUDE.md` 和 `.claude/skills/sec-forge/`，继续使用原版 Claude Desktop / Claude Code。不包含 Claude 客户端副本，不替换其原生 `systemPrompt`。
- **Codex**：部署 `system-prompt.md`、`AGENTS.md` 和 `sec-forge`，保留用户选定的模型。对话编辑简化为“编辑 → 保存”。
- **一键清理历史指令**：无需先扫描，也无需退出 Codex；仅清理历史记录中命中旧 `Collaboration Mode: Default` 模板的 developer 指令字段。保留记录结构、其他字段、用户及助手消息，不删除对话或 SQLite 数据库。
- **固定顺序**：按当前用户主目录解析 `~/.codex/thread-writer-locks`，先删除其中所有文件（包含隐藏文件、子目录内文件，保留目录），再清理匹配的历史字段。不要求退出 Codex，不以活动/未知进程状态跳过锁清理；删除失败如实记录。
- **最小部署**：不部署 memory、rollout 摘要、子 agent、rules 或 agent-memory；不写全局 Claude `settings.json`。独立 `jit-harness` 不在部署包中，通用执行流程由主提示词提供。

**清理的是磁盘历史，不是热替换已载入的模型上下文。** 已打开任务需要重新载入才可能使用新历史。清理采用匹配 token 的等长定位写入，保留并发追加及原有字节偏移；发现文件被替换、截短或目标内容已变化时报告部分完成，不覆盖整个文件。移除锁不代表获得独占写入；比对到写入之间仍有同一目标位置的并发竞争窗口，不能保证任意并发改写都安全。写后复核失败时以日志中的部分完成/不确定结果为准。

这是一次删除操作；运行中的 Codex 之后可能重建锁，不是持续锁守护，也不终止 Codex 进程。

提示词和技能不扩大任务范围或宿主权限，也不能关闭服务端 safeguard、保证请求不被拒绝。静态检查和隔离测试不等于真实模型行为评测。

## Windows 锁状态与日志

锁已被系统标记删除但句柄仍被持有时显示“等待释放”，不误报权限失败，也不计作文件已消失。只有原生状态确认才这样分类；真实权限/共享失败仍报告。界面显示已读取/已枚举的历史文件数，删锁结果与历史字段处理结果独立。每次操作覆盖当前用户应用数据目录中的 `logs/context-clean-latest.jsonl`，窗口显示实际日志路径；不保存对话正文。

## 安装与使用

Windows x64 安装器文件：`cc-unlock-Setup-v3.0.1-stable.exe`。在仓库 [Releases](https://github.com/JacksonTai2007/cc-unlock/releases) 获取发布产物。安装前退出旧 cc-unlock 部署工具，避免旧可执行文件被占用；进行上下文清理时 Codex 本身可以保持运行。

安装部署工具后，选择 Claude 的实际工作区再部署；Codex 部署作用于当前用户的 `.codex`。修改指令后新建或重新加载任务，核对实际加载内容。现有 `CLAUDE.md` 与部署文本不同会停止，检查后才显式确认覆盖。

“修改对话”需要 **Python 3.10+**；可用 `CC_UNLOCK_PYTHON` 指定解释器绝对路径。Node 技能工具要求 **Node.js 20+**。安装器不包含 Python 或原版 Claude / Codex 客户端。

PowerShell 部署 Claude 的最小入口：

```powershell
.\cc-unlock-files\deploy.ps1 -Path 'C:\path\to\workspace'
.\cc-unlock-files\deploy.ps1 -Path 'C:\path\to\workspace' -Verify
```

这里的示例路径需替换为你的工作区。命令不会顺带部署 Codex；需要时显式使用 `-Codex`。历史个人记忆和子 agent 文件不因文件名相似而自动删除。

## 技能更新

- `sec-forge` 按实际目标选 Android、Web、Windows 路线，不自行增加对象或操作；普通文本/config 修改不默认计算哈希，验证复用仍有效证据。
- `win-reverse` **0.3.0**：去除任务推进中的特定软件硬编码和重复哈希，将“权限锁死”表述修正为工作流门禁。
- `web-reverse` **0.1.1**：工具路径采用宿主实际技能目录，预检只在首次或失效时运行；浏览器能力依据当前文档，包含 `mcp__cua_repl`，不假定旧 API 可用。

## 从源码构建 Windows 产物

以下命令在仓库根目录运行。锁定的 Electron 构建依赖要求 **Node.js 22.12+**；这高于技能工具的 Node 20 最低要求。需要本机 NSIS 编译器，不自动下载编译器。

```powershell
npm --prefix cc-unlock-codex ci
node scripts/sync-prompts.cjs --write
node scripts/test-prompt-contract.cjs
node scripts/build-portable.cjs
$env:CC_UNLOCK_MAKENSIS = 'C:\path\to\NSIS\Bin\makensis.exe'
node scripts/build-installer.cjs --preflight
node scripts/build-installer.cjs
```

`CC_UNLOCK_MAKENSIS` 未设置时使用 `.build-tools/nsis/Bin/makensis.exe`。`scripts/build-dependencies.cjs` 优先查 `CC_UNLOCK_BUILD_MODULES` 或两个应用的 `node_modules`；本地工作站可复用已有依赖，新检出仓库应执行上面的 `npm ci`。

便携产物位于两个应用各自的 `dist/cc-unlock-*-win32-x64/`；统一安装器输出为 `release/cc-unlock-Setup-v3.0.1-stable.exe`。已有便携输出需要重建时可用 `node scripts/build-portable.cjs --refresh`；安装器不会静默覆盖同名已发布产物。上述两个根目录构建脚本是当前发布入口，各应用旧 `npm run dist` 不是统一安装器命令。

## 定向检查

```powershell
node scripts/test-context-thread-locks.cjs
node --test scripts/test-context-host.cjs
node scripts/test-prompt-deployment.cjs
node scripts/test-claude-minimal-deploy.cjs
```

上下文测试采用合成记录/锁和隔离 HOME，不运行真实会话清理。源码、打包和模型效果应分别记录验证范围。旧版本行为请查仓库[历史发布标签](https://github.com/JacksonTai2007/cc-unlock/tags)，当前行为以本页、[发行说明](docs/RELEASE_NOTES.md)和 [CHANGELOG](CHANGELOG.md) 为准。
