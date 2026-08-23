<!-- publish: framework -->
# First Response Contract

正式进入执行后的第一轮，优先用最小结构固定工作面，而不是先铺开长篇阶段汇报。

## 核心 5 项（必填）

- `taskMode`：当前主模式（A:请求验收 / B:内容边界 / C:浏览器可控复用 / D:本地复现 / E:纯算法提取）
- `deliverableTier`：当前最小交付梯度
- `currentStage`：当前阶段（通常为 Observe 或 Capture）
- `activeEntrypoint`：当前活跃切入点（如 `sign-call -> request-use`）
- `successCriteria`：本轮成功判据（具体可验证的条件，不是"了解更多"）

## 按需扩展（3~8 项，只选与当前任务直接相关的）

不确定的项直接标 `provisional`，不要伪装成已锁定。不需要的项直接省略。

- `primaryTopic / secondaryTopics`：feature bundle 已能判断时填写
- `minimalProbe`：entrypoint 已确定时填写
- `provisionalEvidence`：已有初步观察时填写
- `blockingUnknown`：已知阻塞项时填写
- `acceptanceGap`：验收边界已明确时填写
- `nextEvidenceGate`：知道下一道证据门时填写
- `truthRoots`：续跑 / 外部 workspace 时建议写 `workspaceRoot / taskLocalRoot / artifactTruthRoot / workspaceKind`

## 专题门禁字段（命中指定场景时升级为准必填）

命中签名 / 加密 / 解密 / WASM / 媒体链时：

- `boundaryStatus`：边界是否已完整确认（`full / partial / not-started`）
- `familyShortlist`：候选算法家族（如 `HMAC / AES-GCM / canonicalization bug`）
- `directCallDecision`：是否需要 direct-call 路线
- `searchDecision`：是否需要外部搜索纠偏

命中 VM / WASM / 混淆专题时：

- `microRoute`：当前微路线（如 `dispatcher naming / wasm export mapping / string decoder`）
- `deepDivePermit`：是否已开启深入许可（`on / off`）
- `highValueEvidenceGoal`：本轮期望的高价值证据

命中视频 / TS / PES / NAL / 分片媒体流时：

- `sampleCoverage`：样本覆盖范围
- `controlDataSplit`：控制层与数据层是否已分离

## 推荐写法

```text
- taskMode: 浏览器内可控复用
- deliverableTier: browser-harness-accepted-request
- currentStage: Capture
- activeEntrypoint: sign-call -> request-use
- successCriteria: 生成的请求在浏览器 harness 中稳定 accepted
- primaryTopic: signature
- secondaryTopics: session, instrumentation-hooking
- provisionalEvidence: baseline ok, local generated rejected
- blockingUnknown: signer state carrier 是否来自 storage->memory 镜像
- acceptanceGap: 当前还差 request-use -> server accept 的直接闭环证据
- nextEvidenceGate: 拿到 signer state reader 命中最终 header 的 capture
- truthRoots: workspaceRoot=E:/cases/demo, taskLocalRoot=E:/cases/demo/artifacts/tasks/demo-sign, artifactTruthRoot=E:/cases/demo/artifacts/tasks/demo-sign, workspaceKind=external-workspace
- boundaryStatus: request body 全量边界已确认
- familyShortlist: HMAC / AES-GCM / canonicalization bug
- directCallDecision: 当前无 wasm internal call，暂不做 direct-call
- searchDecision: 已做一轮搜索，优先保留 canonicalization 方向
- microRoute: canonicalization diff -> request-use
- deepDivePermit: off
- highValueEvidenceGoal: 找到 canonical payload 最终进入 header 的直接证据
```

## 纪律

- 不确定项直接标 `provisional`，不要伪装成已锁定
- 首轮结构要服务下一步动作，不是为了写漂亮总结
- 首轮如果发现主模式选错，立即切到 `retrospective + reclassify`
- 后续每一轮也应保留一个最便宜的停损条件，避免"本轮先试试看"无限复制
- 不要为了填满所有字段而编造值——缺少信息是正常的，标 `provisional` 就是正确的处理方式
- 如果首轮 feature bundle 尚不足以确定主专题，允许先做一次低成本 triage（快速浏览网络请求、检查关键脚本 URL），此时 `primaryTopic` 可标 `provisional`
