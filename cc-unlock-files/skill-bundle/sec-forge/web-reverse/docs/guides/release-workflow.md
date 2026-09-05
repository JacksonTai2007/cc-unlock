# 发布流程

本流程用于减少“topic 已改、generated docs 没改”“接入 prompt 与主文档分叉”“README / guide 与真实脚本不一致”这类发布漂移。

## 最小发布前流程

```bash
npm run sync:topics
npm run check:fast
npm run check:full
```

也可以直接执行：

```bash
npm run release:prep
```

## 变更类型与额外动作

### 1. 只改 `topics/*/topic.json`

至少执行：

```bash
npm run sync:topics
npm run check:maturity
npm run check:fast
```

### 2. 改 task contract / template / route state

至少执行：

```bash
npm run sync:topics
npm run check:fast
npm run check:full
```

并补：
- `CHANGELOG.md`
- 必要的迁移说明

### 3. 改接入层 prompt / README / 顶层规则

除常规 QA 外，重点核对：
- `agents/openai.yaml`
- `SKILL.md`
- `PROMPTS.md`
- `docs/guides/task-lifecycle.md`

确保 Startup Gate、回复门禁、交付梯度、README 阅读顺序口径一致。

## 发布前人工检查

至少确认：
- 没有 generated docs 漂移
- 没有 maturity 误标
- README 的命令仍可运行
- CHANGELOG 已记录本次结构性变更
- 本次改动的真源位置清晰（manifest / reference / guide / top-level）

## 推荐 CI / PR 门禁

- CI 最低门禁建议直接跑：`npm run release:prep`
- 若 PR 修改 `topics/*/topic.json`，应同时包含 generated docs 同步结果
- 若 PR 修改 task schema / template / route state，应附迁移说明或说明“不需要迁移”
- 若 PR 修改 `SKILL.md` / `PROMPTS.md` / `agents/openai.yaml` / `README.md`，应在描述中说明口径是否已同步

## 推荐提交粒度

推荐把一次结构性改动拆成：
1. 真源改动（topic / tools / templates）
2. generated docs 同步
3. guide / changelog / migration note

这样更容易 review，也更容易追踪回归来源。
