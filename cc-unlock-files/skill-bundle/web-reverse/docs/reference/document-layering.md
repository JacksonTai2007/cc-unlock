# 文档分层

这个仓库已经不是单一提示词文件，而是多层协作的执行框架。  
为了避免顶层文档继续膨胀，后续维护统一按以下分层落盘。

> **两"reference"的区分：**
> - `docs/reference/` = **治理层（policy）**：定义执行协议、交付梯度、成熟度模型——"怎么执行、怎么判断"
> - `references/` = **知识层（playbook）**：专题 playbook、深水区资料、代码片段、操作模板——"具体怎么做"

## 1. `SKILL.md`：运行时执行宪法

只保留会直接影响模型运行行为的内容：

- 何时触发 skill
- Startup Gate
- 任务模式 / 交付梯度
- 默认继续 / 回复门禁
- 深挖 permit / 停损 / pivot 原则
- 证据、结论精度、产物纪律

不应继续向 `SKILL.md` 叠加：

- 过长的专题教学内容
- 发布流程细节
- schema 演进说明
- 不会改变运行行为的维护说明

## 2. `PROMPTS.md`：操作员提示模板

用于给使用者复制、拼装和复用提示词。

适合放这里的内容：

- 新任务 / 续跑任务模板
- 验收导向模板
- 外部搜索纠偏模板
- VM / WASM / signer / 媒体专题附加句

不应把 `PROMPTS.md` 当成真源：

- 规则真源仍是 `SKILL.md`
- 专题机器契约真源仍是 `topics/*/topic.json`

## 3. `topics/*/topic.json`：专题机器契约真源

专题的结构化能力以 manifest 为准：

- `maturity`
- `signals`
- `taskSemantics`
- `formalValidation`
- `caseFiles`
- `requiredChecks`
- `synthetic`

凡是能被结构化的专题契约，优先进入 manifest，避免重复写在顶层 prompt。

## 4. `docs/reference/*`：稳定规则与治理文档

这里承载“重要但不该塞进顶层 prompt”的内容，例如：

- 首轮压缩协议
- 交付梯度
- retrospective
- claim hygiene
- maturity model
- schema migration policy

## 5. `references/*`：专题 playbook / 深水区资料

这些文档用于：

- 按需补充专题背景
- 深入特定保护层
- 提供可迁移 SOP / checklist

它们不是顶层执行宪法，也不应反向定义 skill 主行为。

## 6. `docs/guides/*`：维护与发布流程

这里放：

- 快速上手
- 任务生命周期
- 发布流程

目标是服务维护者和使用者，而不是给运行时模型追加负担。

## 维护原则

新增规则前先问三件事：

1. 它是否会直接改变运行时行为？
2. 它是否能结构化进入 topic manifest？
3. 它是否更适合做 reference / guide，而不是顶层 prompt？

默认答案顺序应是：

`topic manifest > docs/reference > docs/guides > SKILL.md`

只有必须影响运行时决策的内容，才回到 `SKILL.md`。
