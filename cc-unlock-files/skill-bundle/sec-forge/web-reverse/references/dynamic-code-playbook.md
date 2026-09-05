# Dynamic Code Playbook

Version: 1

适用场景：

- `eval(...)`
- `Function(...)`
- `setTimeout("code")` / `setInterval("code")`
- 运行时拼接脚本再执行
- 动态生成 `blob:` / `data:` / inline module
- `import()` 的真实载荷在运行时构造
- 自解包 / 自防护 / 二阶段解密后再落入执行器

目标不是“让代码跑起来”本身，而是回答下面四个问题：

1. 动态代码从哪里来
2. 在什么边界被解码、拼接或替换
3. 哪一段才是后续真实业务逻辑
4. 如何在离线或最小副作用环境中稳定复现

## 1. 观察优先级

优先确认是否存在以下信号：

- 字符串数组还原后紧接 `eval` / `Function`
- 大段 base64 / hex / unicode escape / 自定义解码器
- 自执行函数里出现一次性 loader
- `toString` / `debugger` / 尺寸检测与动态执行同时出现
- 只在首屏、点击、滑块、提交、挑战成功后才生成代码
- `import()` 参数不是静态字面量
- 先写入 `Blob` 再 `URL.createObjectURL`

如果动态代码只是某个已有专题的一部分，也不要跳过本专题：

- 与反调试共存时，先判定触发顺序，再决定先反调试还是先截获动态代码
- 与 VM 共存时，要区分“动态代码负责解包 VM”还是“动态代码本身就是业务壳层”
- 与 chunk loader 共存时，要区分“动态载入模块”与“动态生成脚本”

## 2. 推荐抓取顺序

1. 先记录触发动作、入口函数、页面阶段
2. 再低侵入 hook `eval` / `Function` / timer string handler / `import()` 包装层
3. 先抓摘要：
   - 长度
   - hash
   - 前后 120 字符
   - 调用栈摘要
4. 确认命中后，再决定是否落全量源码
5. 只有当副作用可控时，才在离线沙箱中执行解包后的代码

## 3. 必抓边界

至少覆盖一条真实动态执行链：

- 原始密文或压缩体
- 解码函数
- 解码后字符串
- 进入 `eval` / `Function` / 动态模块构造前的最后一步

建议按以下边界建证据：

- `decode boundary`: 密文变明文
- `assembly boundary`: 多段字符串拼接成完整脚本
- `execution boundary`: 明文进入执行器
- `reuse boundary`: 明文如何被缓存、二次调用或下发到 worker / frame

## 4. 常见抓取点

### `eval`

- 包装 `globalThis.eval`
- 记录参数长度、片段、摘要 hash、调用栈
- 默认不要直接改写返回值语义

### `Function`

- 包装构造器参数
- 特别关注最后一个参数体
- 识别只注入 `debugger` / 自防护分支的伪代码体

### string timer

- 拦截 `setTimeout` / `setInterval` 的字符串参数
- 记录触发延迟和循环频率
- 与反调试专题联动判断是否为“无限 debugger 定时器”

### 动态模块

- 关注：
  - `import(someExpr)`
  - `Blob([code], { type: "text/javascript" })`
  - `URL.createObjectURL(blob)`
  - `<script>.text`
  - `<script src=blob:...>`

### worker / frame 下发

- 记录是否通过 `postMessage` / `Blob URL` / `srcdoc` 传播
- 如果动态代码只在 worker 或 iframe 中执行，主页面证据不算完成

## 5. 离线沙箱要求

动态代码的“捕获”和“执行”必须分离。

推荐最小策略：

- 先保存原文
- 在本地脚本中替换危险 sink
- 只保留必须的全局对象
- 默认禁止真实网络、副作用存储和导航

离线验证至少回答：

- 能否稳定重复产出同一份明文
- 能否在不依赖页面完整状态的情况下复现关键输出
- 是否存在二阶段动态生成

## 6. 自防护与误判

以下现象不要直接当作“业务算法”：

- `Function("debugger")`
- 只做 `toString` / devtools / timing 检测的动态片段
- 用于投毒调试器的假 opcode / 假分支
- 用于污染栈、日志或覆盖全局对象的诱饵代码

如果动态代码只负责防护而不负责业务逻辑，报告中必须拆开描述：

- 防护层动态代码
- 真实业务层动态代码

## 7. 交付要求

命中动态代码专题时，至少补充：

- `task.json.dynamicCode`
- `run/dynamic-code-capture-template.js`
- `run/dynamic-code-notes.md`
- `report.md` 中的 `动态代码状态`

报告必须写清：

- 动态执行面：`eval / Function / timer-string / import / blob-script / worker`
- 捕获状态
- 是否已获得明文
- 离线沙箱状态
- 未解决的副作用或触发前提
