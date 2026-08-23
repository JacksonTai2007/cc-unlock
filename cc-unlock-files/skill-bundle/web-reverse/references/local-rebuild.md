# Local Rebuild

目标：把页面证据转换成最小可运行的 Node 复现骨架。

与相邻文档的边界（别用错文档）：
- 本页=**起点**：从页面证据搭出最小 Node 复现骨架（固定入口/样本/存储 → 跑 `env/entry.js` → 记录首报错）。
- **补环境对齐细则**（缺符号 / 环境差异、补哪里/补到什么程度/何时停）走 `node-env-rebuild.md`（执行骨架）+ `env-drift-decision-tree.md`（判定口径）。
- **扣代码**（入口夹在混淆 bundle 里、依赖一大坨模块）走 `closure-extraction-playbook.md`。

## 原则

- 以页面证据为准
- 先最小入口，后最小宿主
- 不要一开始就全量模拟浏览器

## 必做动作

- 固定入口脚本
- 固定请求样本和时间窗
- 固定必要的存储快照
- 跑 `env/entry.js`
- 记录首个报错或首个有效输出

## 跑不通的下一步（按症状分流）

- 报错是**缺符号 / 环境差异**（`xxx is not defined`、descriptor/返回形态不一致）：转补环境，**先把首报错归类**再补——「补哪里 / 补到什么程度 / 何时停」由 `env-drift-decision-tree.md` 判定（一轮只补一个最小因果单元），执行骨架（Proxy 探测 / jsdom 铺底 / Node 侧反检测）见 `node-env-rebuild.md`。
- 入口本身**夹在混淆 bundle 里、依赖一大坨模块**：先走扣代码 `closure-extraction-playbook.md` 抽出最小闭包，再回来跑。
- "补一个最小因果单元"的精确定义见 `env-drift-decision-tree.md` §3。

