# 快速上手

这是新方案下的最短使用路径。

## 新任务

1. 新建 task-local
2. 同步状态
3. 刷新下一步
4. 先完成首轮压缩协议，再直接进入执行

```bash
npm run task:start -- <task-id>
npm run task:sync -- <task-id>
npm run task:advance -- <task-id>
```

## 续跑任务

```bash
npm run task:sync -- <task-id>
npm run task:advance -- <task-id>
```

## 收尾

```bash
npm run task:close -- <task-id>
```

如果结果仍是：

- `execution.status=ready-to-continue`
- `pauseCategory=none`

就继续执行，不要停在汇报。

## 首轮压缩协议

第一轮最少明确：

- `taskMode`
- `deliverableTier`
- `primaryTopic / secondaryTopics`
- `activeEntrypoint`
- `minimalProbe`
- `successCriteria`

## 什么时候进行全网搜索（`mcp__web-search__search_bing`）

满足以下任一条件时，可插入一轮结构化搜索：

- 默认两轮没有逼近验收；但已开启 `deepDivePermit` 的 VM / WASM / 混淆微路线例外
- 命中 provider / SDK / protocol 高信号
- `baseline ok / generated rejected`
- 需要 GitHub / 官方文档 / issue 纠正路线

## 什么时候不要过度建设

- 用户只要浏览器内请求成功，不要默认补纯算法实现
- 用户只要 clear boundary，不要把容器可读误判为任务完成
- 浏览器 harness 已能稳定复用时，不要为了“更完整”而提前升级到 PureExtraction
- 用户只是要普通页面 smoke test / UI 自动化，不要误用本 skill

## 回复前门禁

```bash
npm run task:assert-can-reply -- <task-id>
```

## 最终收尾前门禁

```bash
node tools/task/assert-can-reply.mjs <task-id> --require-validated-deliverable
```

## 一个最小闭环命令序列

```bash
npm run task:start -- <task-id>
npm run task:sync -- <task-id>
npm run task:advance -- <task-id>
# ...执行真实逆向动作...
node tools/task/assert-can-reply.mjs <task-id> --require-validated-deliverable
npm run task:close -- <task-id>
```

## 记住四条铁律

1. 除非阻塞或交付，否则不要等待用户再输入“继续”
2. 如果默认两轮没有逼近最终验收，必须 pivot；但已开启 `deepDivePermit` 时，应先检查当前 microRoute 是否仍在持续产出高价值证据
3. 搜索只能帮助纠偏，不能替代 runtime evidence
4. 结论必须标清 `provisional / route-ready / acceptance-ready / delivered`
