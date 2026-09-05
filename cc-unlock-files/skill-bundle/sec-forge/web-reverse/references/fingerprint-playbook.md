# Fingerprint Playbook

Version: 2

适用场景：目标站点存在浏览器指纹、自动化检测、设备画像、风控挑战或补环境前必须先确认的环境采样逻辑。以及环境值参与签名/加密/算法运算的场景。

## 核心定位

`fingerprint` 主题不是"把浏览器所有表面都补齐"，而是先回答 5 个问题：

1. 实际读了哪些向量，探测顺序是什么。
2. 哪些属于通用指纹，哪些属于自动化泄漏。
3. 哪些读点真正进入 challenge、签名或上网字段。
4. **哪些读点经变换后成为算法输入（哈希、位运算、拼接、数组索引）。**
5. 在此基础上，最小 patch 面是什么。

如果这 5 个问题没有回答清楚，就不应该进入大范围补环境。

---

## 现代指纹分类

### 通用浏览器/设备向量

- `navigator`：`userAgent`、`platform`、`languages`、`hardwareConcurrency`、`deviceMemory`
- `UA Client Hints`：`navigator.userAgentData` 及 `getHighEntropyValues()`
- `screen`：尺寸、像素比、色深、横竖屏
- `timezone / locale / intl`
- `canvas / offscreen canvas`
- `webgl`
- `audio`
- `fonts`
- `rtc / media capabilities`

### 自动化泄漏

- `navigator.webdriver`
- `chrome.runtime`、`permissions`、异常的 `plugins / mimeTypes`
- Playwright / Puppeteer / CDP 注入痕迹
- `Function.prototype.toString`、`sourceURL`、错误栈、全局特征
- headless only 特征、修补过度导致的 descriptor 异常

### 执行上下文一致性

- `window`
- `iframe`
- `worker / shared worker / service worker`
- 必须确认不同上下文是否共用同一套采样与校验逻辑

### 传输绑定

- 指纹摘要是否写入请求头、query、body、cookie、storage
- 是否只参与本地风险评分，不直接上网
- 是否只决定 challenge 分支，不直接决定签名参数

### 算法输入绑定（新增）

- 指纹向量是否经过变换后进入签名/加密算法
- 指纹向量是否作为 VMP 字节码选择/生成的种子
- 指纹向量是否作为 WASM 算法的输入参数
- 指纹向量是否参与位运算、哈希、拼接等运算

---

## 推荐流程

1. 先列 probe order。
2. 按 detector family 分桶：`generic-fingerprint / automation-leaks / execution-context-consistency / network-binding / algorithm-input`。
3. 将本地读点映射到实际请求、challenge、缓存或风控状态机。
4. **将本地读点映射到算法输入链：读取 → 变换 → 消费目标。**
5. 确认 first divergence 是"值差异"还是"descriptor / prototype / scheduler / context / algorithm-output 差异"。
6. 只设计最小 patch 面，并记录为什么不补其它表面。

---

## 取证重点

### Probe Order

- 哪个入口最先触发指纹采样
- 是否是串行探测还是多模块并发探测
- 哪些探测失败会导致后续降级或换分支

### Detector Families

- 通用指纹模块
- 自动化泄漏模块
- 跨上下文一致性模块
- 网络绑定与 challenge 路由模块
- **算法输入模块（新增）**

### Algorithm Input 分析（新增）

对进入算法运算的指纹向量，必须追踪：

1. **读取点**：哪个属性被读取（如 `navigator.userAgent`）
2. **变换链**：读取后经过什么运算（如 `userAgent.split(' ').pop().hashCode()`）
3. **消费目标**：变换后的值去了哪里
   - `sign-field`：签名参数
   - `crypto-input`：加密算法输入
   - `vm-seed`：VMP 字节码种子
   - `wasm-input`：WASM 算法输入
   - `control-flow`：条件分支选择
4. **敏感度**：修改该值是否改变最终输出

### Execution Contexts

- 指纹脚本运行在 `window / iframe / worker` 的哪一层
- 同一字段在不同上下文是否读值不同
- patch 是否要跨上下文同步

### Network Binding

- 哪些字段真正进入 header / body / query / cookie
- 哪些只是本地评分或缓存 key
- challenge token、风控分数、指纹摘要的生成顺序

---

## 环境值作为算法输入的验证方法

### 方法 1：单点替换验证

1. 在浏览器中 hook 某个指纹读取点（如 `navigator.userAgent`）
2. 返回一个修改后的值
3. 观察签名/请求输出是否变化
4. 若变化，记录变化幅度和方向

### 方法 2：多点组合验证

1. 同时替换多个指纹读取点
2. 使用正交实验设计（每次只改一个，保持其他不变）
3. 建立"指纹向量 → 算法输出"的敏感度矩阵

### 方法 3：追踪链验证

1. 从指纹读取点开始，向前追踪数据流
2. 标记所有变换节点（函数调用、运算符、数组索引）
3. 确认变换链的终点是否在 sign / crypto / vm / wasm 边界

---

## 交付要求

最少产物：

- `run/fingerprint-profile.json`
- `run/fingerprint-notes.md`
- `run/fingerprint-inspector-template.js`

`run/fingerprint-profile.json` 至少要覆盖：

- `probeOrder`
- `executionContexts`
- `detectorFamilies`
- `networkBindings`
- **`algorithmInputs`（新增）**
- `patchPlan`
- `vectorBuckets`

**`algorithmInputs` 结构示例：**

```json
{
  "algorithmInputs": [
    {
      "vector": "navigator.userAgent",
      "readPoint": "vm-handler-ENVREAD_NAVIGATOR",
      "transformChain": ["split(' ')", "pop()", "hashCode()"],
      "consumeTarget": "sign-field-x-ua-token",
      "sensitivity": "high",
      "swapVerified": true
    }
  ]
}
```

---

## 常见误区

- 看到大量环境读取就默认全部关键。
- 把自动化泄漏和通用指纹混成一个桶，导致 patch 面无限膨胀。
- 只看本地 getter，不确认是否真的绑定到网络字段。
- **只看本地 getter，不确认是否进入算法运算链。**
- 丢失 `iframe / worker` 上下文，导致浏览器里看似通过，真实运行仍被拦截。
- 在没有 first divergence 证据前直接迁移到 Node。
- **未验证指纹向量的算法输入链就声称"纯算法提取完成"。**
- **把"补环境通过检测"等同于"补环境产生正确算法输出"，两者可能不等价。**

---

## 外部基线仓

以下公开仓库适合用来校准"现代指纹/自动化检测"的结构化认知，不用于直接替代目标站分析：

- `fingerprintjs/fingerprintjs`
- `fingerprintjs/BotD`
- `abrahamjuliot/creepjs`
- `rebrowser/rebrowser-bot-detector`
- `rebrowser/rebrowser-patches`

使用方式：

- 先借它们校准向量分类、probe order、automation leak bucket。
- 再回到目标任务，确认哪些读点真的进入目标站 challenge / 上网字段 / **算法输入**。

### 闭环自检（不要只做认知校准，要在自己的实例上实跑一遍）

光"读仓库校准认知"不够——必须把 detector 跑在**你当前对手的浏览器实例**上，让它告诉你哪条没过，再据此定 patch 面：

1. 在当前 `stealth-browser` / `nodriver`（或 patchright / rebrowser）实例里加载 `rebrowser/rebrowser-bot-detector` 的检测页（或把其检测脚本经 `add_script_to_evaluate_on_new_document` / `evaluate` 注入跑一遍）。
2. **收集 detector 的逐项结果**，把所有"未过 / 红"的检测项（如 `navigator.webdriver`、`Runtime.enable` 泄漏、CDP 痕迹、`Function.prototype.toString` 失真、headless-only 特征）列成清单落 `run/fingerprint-notes.md`。
3. **patch 面 = 实测未过项的最小集合**，而不是"把所有指纹表面补齐"或"凭认知猜哪里会漏"。只有当某未过项确实进入目标站 challenge / 上网字段 / 算法输入（回到上文 5 问）时才补它。
4. patch 后**重跑同一 detector** 确认对应项转绿，且未引入新的 descriptor 异常（过度 patch 反成新泄漏）。

> 关键：rebrowser-bot-detector 的价值是"对手会怎么测我"的可执行复刻；停在"我知道有这些检测"而不在自己实例上跑，等于没用——真实未过项往往与认知预期不一致（如自以为 stealth 已盖住的 `webdriver` 在 worker 上下文仍泄漏）。
