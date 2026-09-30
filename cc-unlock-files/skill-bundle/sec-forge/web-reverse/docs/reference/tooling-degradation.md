# 工具降级与自举

> SKILL.md「工具降级与自举」段的完整操作手册。主文件只保留降级铁律摘要；具体分级标准、自诊断步骤、路径纪律在此。

本 skill 依赖 `tools/task/*.mjs`、`tools/qa/*.mjs`、`npm run check` 等工具链执行契约。
当工具不可用、Node 版本不足、或路径解析失败时，执行契约不应直接崩溃，而是降级运行。

## 降级层级

| 层级                | 条件                                   | 行为                                                                                                                                                                    |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L0 全量**   | Node >= 20 且 `tools/task/` 完整可用 | 开机统一走 `task-boot`（内部已串起 task-init/resume → task-sync → task-advance，见 SKILL.md 红线1）；task-start / task-sync / task-advance 是其内部子步骤，**仅 L1/L2 降级手动拆解时才单独调用**；assert-can-reply 照常用于回复门禁 |
| **L1 基础**   | Node 可用但部分 task 工具缺失或报错    | 跳过 task-sync / task-advance / assert-can-reply；手动从 `artifacts/tasks/<task-id>/task.json` 和 `state/route-state.json` 读取状态；继续执行但声明当前处于降级模式 |
| **L2 最小**   | Node 不可用或工具全部不可用            | 以 SKILL.md 文本规则为真源；从 task-local 文件手动恢复状态；明确告知用户当前缺少工具链支持，并在 `report.md` 中标注 `toolingLevel=L2`                               |
| **L3 纯契约** | 全新任务且无工具链                     | 先确认用户目标与交付梯度，手动创建 `artifacts/tasks/<task-id>/` 结构；不阻塞在工具链上；任务完成后提醒用户在有工具链的环境中运行 `task-close`                       |

## 工具降级纪律

- 不得因为工具不可用而拒绝执行任务
- 降级后必须在 `report.md` 中显式标注当前 `toolingLevel` 和缺失的工具
- L1/L2 降级时，`reply gate` 和 `auto-advance` 纪律仍然通过文本规则生效——不能因为 `assert-can-reply.mjs` 不可用就跳过回复门禁
- L2/L3 降级时，"已完成 / 已交付"声明仍然需要通过验证门禁：至少要有 `verify-once.mjs` 或等效的验收脚本成功运行

### 搜索能力降级（web-search MCP 为可选加速面，非硬依赖）

`web-search` MCP（`mcp__web-search__search_bing` / `mcp__web_reader__webReader`）是**搜索的首选加速面，不是硬依赖**。标准环境缺该 MCP 时不得死锁：

- 当 `web-search` MCP 不可用 / 未连接，或 `check-search-gate.mjs` 本身不可用（L1/L2/L3）时，**明确允许用 `WebSearch` 或任意可用联网工具**（含 `web_fetch` 等）满足搜索门禁的"已搜索"判据——门禁判定的是"是否搜过 + 是否留下决策"，不绑定具体由哪个 MCP 执行
- 用替代工具搜索后，仍按 `references/web-search-tool.md` 的落盘要求写 `state/external-research.md` / `state/external-research.json`，并更新 `route-state.json` 的 `searchRounds` / `lastSearchRound` / `searchDecision`（`check-search-gate.mjs` 校验的是这些状态字段，与搜索工具来源无关）
- 仅当**完全无任何联网能力**时，才在 `report.md` 标注 `searchToolReady=false` 并把"缺搜索能力"作为一行可读诊断，而不是反复换关键词空转或拒绝推进
- 不要把"`web-search` MCP 没起来"当成"搜了但没结果"，也不要因此触发硬门禁死锁——这是环境能力降级，按本节用替代工具补齐即可

## 工具链自诊断

首次使用工具链时执行一次最小预检，缓存实际 `skillRoot / toolDir / nodeVersion / toolingLevel`。续作沿用已确认结果；只在安装位置、运行时或工具集合改变，或真实调用报错时重查对应项。不要每轮重复 `node --version`、`ls`、boot 或完整环境扫描。

**Step 0 — 绑定实际安装目录**：工具链与任务目录分离，项目 cwd 不是技能位置。

1. 当前会话已有验证有效的 `toolDir` → 直接复用。
2. 否则优先从宿主技能目录提供的绝对 `SKILL.md` 路径得到 `SKILL_ROOT=dirname(SKILL.md)`；若宿主提供技能目录，则直接使用该目录。确认 frontmatter 的 `name: web-reverse` 和所需入口真实存在，不把其他同名目录或包内文档当作安装证明。
3. 宿主未给路径时，可读取 boot 写出的 `.web-reverse-tool-dir`，或检查宿主已配置的 skills root 下 `sec-forge/web-reverse`；缓存是路径数据，不是执行授权。仅首次恢复时验证候选的技能身份与入口；无效缓存不作为“工具不存在”的证据。
4. 不从 cwd 向父目录递归找任意 `SKILL.md`，也不默认扫描用户目录。仍缺路径则记录 `SKILL_UNAVAILABLE` 与实际检查位置，按现有能力继续。

最小路径解析示例（只读）：把宿主给出的技能目录或 `SKILL.md` **绝对路径**放入 `WEB_REVERSE_SKILL_PATH`，在任意项目 cwd 执行以下 Node ESM。该示例故意不猜 cwd，也不修改真实项目：

```javascript
import fs from "node:fs";
import path from "node:path";

const supplied = process.env.WEB_REVERSE_SKILL_PATH;
if (!supplied || !path.isAbsolute(supplied)) {
  throw new Error("WEB_REVERSE_SKILL_PATH must be an absolute host-reported skill path");
}
const anchor = fs.realpathSync(supplied);
const skillRoot = fs.statSync(anchor).isDirectory() ? anchor : path.dirname(anchor);
const manifest = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
const frontmatter = manifest.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
if (!frontmatter || !/^name:\s*web-reverse\s*$/m.test(frontmatter)) {
  throw new Error("Resolved directory is not the web-reverse skill");
}
const toolDir = path.join(skillRoot, "tools", "task");
if (!fs.statSync(path.join(toolDir, "task-boot.mjs")).isFile()) {
  throw new Error("task-boot.mjs is unavailable at the resolved skill directory");
}
console.log(JSON.stringify({ skillRoot, toolDir }));
```

包内 `.mjs` 工具则以其自己的 `import.meta.url` 结合 `fileURLToPath` 解析目录；例如现有 `task-boot.mjs` 已使用 `path.dirname(fileURLToPath(import.meta.url))`，与调用者 cwd 无关。不要把临时脚本的 `import.meta.url` 当成已安装技能位置。执行工具始终在目标项目 cwd，不能 `cd` 到技能目录写任务数据。

**Step 1 — 检查 Node 版本**：`node --version`，确认是否 >= 20

**Step 2 — 检查当前入口依赖**：确认 `task-boot.mjs` 与其 `task-init.mjs / task-sync.mjs / task-advance.mjs / common.mjs`；需要回复门禁时再检查 `assert-can-reply.mjs`。仅检查本阶段会用到的入口，不枚举全包。

**Step 3 — 以真实入口调用作执行检查**：全新任务只运行一次 `task-boot.mjs`，既有任务直接执行 checkpoint 记录的下一步。保存实际 stdout/stderr 和退出状态；成功 boot 已包含 sync，不为自诊断再跑一次 `task-sync`。实际入口失败时只检查它报告的缺失文件或运行时问题，不将任意门禁非零退出统称为“环境不可用”。

**Step 4 — 根据结果定级**：

- 步骤 0~3 全部通过 → L0
- Node >= 20 但部分工具缺失/报错 → L1
- Node 不可用或工具全部不可用 → L2
- 无 task-id 且 Node 可用但无工具链 → L3（全新任务，手动创建 task-local 结构）

**Step 5 — 复用诊断状态**：在已有 task-local 记录中保存 `toolingLevel: L0/L1/L2/L3`、`toolDir`、Node 版本与缺失项；状态有实质变化才更新，不另开报告。只读或纯说明任务不为执行预检额外创建文件。

诊断用已观测的入口调用、运行时版本和文件存在信息即可；禁止没执行就宣称“环境通过”或“工具不可用”。已通过的预检未失效，不重复执行。

## 工具调用路径纪律

- **任务数据目录** = `$(pwd)/artifacts/tasks/<task-id>/`（始终在 cwd 下）
- **工具链目录** = `$TOOL_DIR`（通过 Step 0 发现，可能在 SKILL 包目录）
- **所有工具调用**必须使用完整路径：`node $TOOL_DIR/<tool>.mjs <task-id>`
- 工具接收 `<task-id>` 字符串参数，在 cwd 下自动解析 `artifacts/tasks/<task-id>/`
- **禁止**在工具调用时依赖相对路径解析工具位置
- `task-boot.mjs` 已在**项目 cwd**自动写 `.web-reverse-tool-dir` 并向子工具传播 workspace root，无需手动重复写，更不要先 `cd` 到工具目录再写指针。宿主路径和当前会话已验证状态优先于磁盘旧缓存。
- 浏览器能力按 `references/browser-mcp-capability-map.md` 做一次实际工具及文档确认；`mcp__cua_repl` 等新表面不能按旧 MCP 表猜 API。工具集合未变且未报错时复用能力记录。
