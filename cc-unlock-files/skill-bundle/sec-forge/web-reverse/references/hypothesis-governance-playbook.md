# 假说治理与样本防过拟合 Playbook

当任务出现以下任一情况时，优先阅读本手册：

- 只拿到局部样本（前 256 字节、单个 offset、局部帧切片）
- 想把统计规律升级为“自定义算法 / S-box / 私有映射”
- WASM / JSVMP / 媒体链存在 opaque init side effect
- Node / Python 结果与浏览器黑盒样本矛盾
- 同一路线已经写出多个分析脚本但没有逼近验收

## 一、先区分 4 层，不要一上来就谈算法

每次都先问：

1. **manifest / 调度层**：是否只是 URL、清晰度、token、challenge、playlist 切换？
2. **container / 封装层**：是否只是封装格式边界问题（TS/fMP4/PES/NAL/appendBuffer/transmux/protobuf/header 嵌套）？容器可读 ≠ 内容已解密，不要把封装层问题误认为算法层问题。
3. **frame / clear boundary 层**：是否已经触到真正的明文帧 / 明文负载？不要因为"某个偏移窗口看起来有规律"就认定掌握了完整算法。
4. **algorithm 层**：是否真的进入了加解密函数，而不是控制信号、状态写入或转封装？

只有前 3 层被排清，才允许对算法层下重结论。

## 二、局部样本默认只是 provisional

以下证据默认都只能标记为 `provisional`：

- 只保留前 256 字节
- 只看一个 offset 窗口（如 64-67）
- 只看单个 NAL type
- 只看某一帧、某一段或某一类 keyframe
- 只看 hexdump，不看完整输入输出边界

在升级为主假说前，至少补齐：

- 完整 payload / NAL / PES / frame diff
- diff offset 列表
- block 对齐信息（8 / 16 / 32 / 64 字节）
- 首尾块是否有额外改动
- 控制帧 / 数据帧是否分层建样

## 三、标准家族优先，不要先猜“自定义”

看到局部规律时，优先排除已知家族：

| 家族 | 快速信号 | 最低成本检查 |
|---|---|---|
| TEA / XTEA / XXTEA | 8 字节块、`0x9E3779B9`、移位+异或+加法 | 检查块大小、常量、轮函数、首尾块 |
| AES / SM4 | 16 字节块、S-box / T-table、轮常量 | 查 data segment / 表常量 / 轮数 |
| RC4 | 256-byte state、KSA/PRGA 交换 | 查 256 长状态数组与双指针交换 |
| ChaCha / Salsa | 64 字节块、quarter-round 加法旋转异或 | 查 16-word state 与 rotate 常量 |
| Hash / CRC | 单向摘要、无明文恢复 | 判断是否其实不是“解密”而是校验/派生 |
| 编解码 / 转封装 | base64 / protobuf / transmux / appendBuffer | 判断是否只是变换边界，而非密码算法 |

规则：**只有在标准家族、编解码家族、no-op 都被排除后，才允许把“自定义算法”升为主假说。**

## 四、先 direct-call，再样本挖矿

若链路命中 WASM / JSVMP / Worker / 媒体解密，优先顺序是：

1. `imports/exports` mapping
2. thunk / table slot / dispatcher mapping
3. 浏览器内 direct-call / 内部函数复用
4. `wasm2wat` / data segment / section inspection
5. 黑盒样本统计

出现以下症状时，更要优先 direct-call：

- 函数返回长度正常，但输出未修改
- Init / Update 看起来成功，但真实解密无效
- 怀疑存在隐藏 side effect、writer chain、状态机
- 黑盒样本能看到规律，但无法解释为什么本地复现是 no-op

此时不要直接走“采 65536 个样本填表”。先确认是不是**根本没打到真实函数 / 没进入真实状态 / 命中了错误层**。

## 五、搜索纠偏要更早，不要等写了十几个脚本

以下场景应尽早做外部搜索纠偏：

- 第一批样本已到手，但 algorithm family 仍不透明
- 商业保护 / provider / SDK family 已露头
- 出现 wasm 函数名、导出名、错误码、特定 header / cookie 高信号
- 浏览器 baseline 成功，但本地 generated rejected / silent reject
- 准备进入第 2 个同类统计脚本 / 更大样本采集前，仍没有可解释的 family shortlist 或 direct-call 线索

搜索的目标是修正：

- provider / family 判断
- entrypoint 排序
- direct-call / export mapping 线索
- 标准算法识别线索

搜索结果不能替代浏览器证据，只能用于纠偏。

## 六、假说台账最少字段

对每个主假说至少写：

- 假说名称
- 支持证据
- 最便宜的反证 probe
- 失败条件
- 下一轮若失败要 pivot 到哪里
- 当前 `boundaryStatus`
- 当前 `familyShortlist`
- 当前 `directCallDecision`
- 当前 `searchDecision`

推荐写法：

```md
- 假说：func60 / export-8 是真实 NAL payload decryptor
- 支持：浏览器调用栈命中；输入输出长度一致；与 type 1/5 NAL 同步出现
- 反证 probe：浏览器 direct-call 同一输入，检查输出是否真的改动完整 payload
- 失败条件：只改控制 NAL，不改数据 NAL；或仅改容器层字段
- 失败后 pivot：转向 writer chain / init side effect / control NAL state writer
- boundaryStatus：完整 NAL diff 已确认；当前不是 partial-only
- familyShortlist：TEA / XTEA / transmux / no-op
- directCallDecision：已检查 wasm table slot 与 browser internal call，下一步 direct-call func60
- searchDecision：已做一轮搜索纠偏，优先采纳 TEA 线索，拒绝与当前导出名不匹配的旧版本帖子
```

建议把主假说落到 `state/hypothesis-ledger.md`（或等价 task-local 真源）中；若没有 ledger 文件，至少在 `state/route-plan.md` 中保留同等字段。

## 七、脚本预算与停损

以下任一情况出现时，必须停下做 retrospective：

- 同一主假说连续 2 轮没有新增验收证据
- 为同一假说写了 3 个以上同类脚本仍没有突破
- 只是在更换统计口径、窗口大小、offset 组合
- 只是在同一家族低层 hook 之间切换

retrospective 必须回答：

1. 我是否只看了局部样本？
2. 我是否跳过了标准家族识别？
3. 我是否还没做 direct-call / export mapping？
4. 我是否需要立刻做外部搜索纠偏？
5. 下一个更高价值 entrypoint 是什么？

执行闸门：
- 没有更新假说台账前，不要进入第 2 个同类统计脚本
- 没有 `familyShortlist + directCallDecision + searchDecision` 前，不要扩大样本规模来“填表”
- `两轮停损` 默认只停当前**微路线**，不要因为一个统计口径失效就停掉整个 VM / WASM / 混淆专题
- 若当前微路线持续产出高价值证据，可申请 `deep-dive permit` 继续 4~6 轮，但必须绑定子目标、里程碑与退出条件

## 八、媒体 / TS / NAL 场景额外提醒

> 以下仅适用于媒体流/DRM 任务。非媒体任务跳过本节。

- `ffprobe` 可识别、`0x47` TS sync byte 正常，只说明**容器层**还能读
- 真正的”内容已解密”必须看到 clear frame / 正常首帧 / 正常音视频内容
- NAL type 25/26 之类控制帧与 type 1/5 数据帧必须分离建样
- 先看完整 NAL/PES，再谈局部统计规律
