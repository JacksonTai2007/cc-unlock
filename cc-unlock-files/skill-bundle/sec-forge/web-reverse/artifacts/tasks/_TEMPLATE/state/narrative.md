<!-- source-of-truth: 本文件是「报告叙事」唯一真源。report.md 的「逆向分析过程 / 主要算法说明 / 难点与对抗 / 调用示例」四段优先取材于此。 -->
<!-- 直接用 Edit 在对应小节下追加 bullet；不写 = 渲染器在交付物里渲染显眼告警，且 reportDepth=deep 时阻断 closeout。 -->
<!-- 占位说明行（以 < / 填 / 示例： / 例如： 开头）不会被渲染，请删除占位、写入真实内容。 -->

# 报告叙事

## 逆向分析过程
<!-- 还原链路叙事：入口定位手法 → 关键取证点 → 逐步还原的关键决策/试错；即便无 pivot 也写出 3~6 个关键节点。 -->
<!-- 例如：- 从 XHR 面板定位到 X-Sign header，回溯调用栈锁定 load.min.js:t() 为签名入口 -->

## 主要算法说明
<!-- 结构化骨架，逐项写清（route-ready 及以上强烈建议非空；reportDepth=deep 时为硬门槛，阻断 closeout/verify）： -->
<!-- 示例：- 算法家族与判定依据：HMAC-SHA256，依据 crypto.subtle.sign 参数 + 32 字节输出 -->
<!-- 示例：- 输入清单：ts(时间戳) / nonce(随机) / body(请求体) / uid(会话态) -->
<!-- 示例：- 归一化规则：字段按 key 升序，& 连接，URL-encode 后小写 -->
<!-- 示例：- 密钥材料：key 硬编码于 load.min.js，iv 由 ts 派生 -->
<!-- 示例：- 输出与 carrier：base64 后放入 X-Sign header -->
<!-- 示例：- 真实样例（脱敏）：输入 {ts:1700,...} → 输出 X-Sign: ab12.. -->
<!-- 示例：- 最小伪代码：canonical=sort(params); sign=base64(hmac_sha256(key, canonical)) -->
<!-- 示例：- 数据流图：ts+nonce+body → sort → canonical → HMAC(key) → base64 → X-Sign -->

## 难点与对抗
<!-- 复盘「卡哪 → 怎么破 → 对抗什么」： -->
<!-- 示例：- 保护清单：debugger 死循环反调试 / 字符串数组混淆 -->
<!-- 示例：- 卡点→突破→验证：debugger 拦截 → 重写 Function.prototype.constructor → DevTools 可正常断点 -->
<!-- 示例：- 残余风险：仅绕过了 setInterval 反调试，定时刷新型未覆盖 -->

## 调用示例
<!-- 自包含补充说明（依赖/安装/完整请求响应等），结构化字段由 deliveryRequirements + run/ 成品脚本自动渲染： -->
<!-- 示例：- 依赖：pip install pycryptodome -->
<!-- 示例：- 完整请求：POST https://api.example.com/x  headers: X-Sign=.. body: {..} → 200 {code:0} -->
