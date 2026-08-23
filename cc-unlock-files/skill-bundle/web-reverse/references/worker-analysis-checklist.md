# Worker Analysis Checklist

适用目标：请求参数、签名、加密、挑战、协议封装、媒体处理等逻辑疑似由 `Worker / SharedWorker / Service Worker / Blob Worker` 异步承担。

## 1. 参数分层

- [ ] 哪些字段是初始化就存在
- [ ] 哪些字段只在点击 / submit / verify 后出现
- [ ] 哪些字段疑似晚于主线程收集
- [ ] 哪些字段只是编码出口（`btoa` / base64 / json）而不是核心算法

输出：
- 可疑字段列表
- `初始化字段 / 交互后字段 / 异步回填字段` 三分层

## 2. Worker 发现

- [ ] 搜 `new Worker`
- [ ] 搜 `new SharedWorker`
- [ ] 搜 `navigator.serviceWorker.register`
- [ ] 搜 `Blob(`
- [ ] 搜 `URL.createObjectURL(`
- [ ] 搜 `postMessage` / `onmessage`
- [ ] 搜 `importScripts`

输出：
- worker 类型
- 脚本 URL 或 blob 来源
- 创建函数与创建时机

## 3. 创建链恢复

如果命中 Blob Worker：

- [ ] `Blob` 构造参数来自哪里
- [ ] 拼接方式是字符串、数组 `join`、模板、解码器还是解包函数
- [ ] `URL.createObjectURL` 的入参对象是谁构造的
- [ ] blob URL 最终被哪个 `Worker(...)` 消费

输出：
- `创建函数 -> blob 文本拼装 -> blob URL -> worker 实例` 链
- blob 源码生成链

## 4. 消息面

- [ ] 主线程发给 worker 什么
- [ ] worker 回主线程什么
- [ ] 每条消息的触发时机
- [ ] 哪些字段与请求参数可映射
- [ ] 是否存在 MessageChannel / BroadcastChannel / 二次分发

输出：
- message schema
- `main -> worker -> output -> request field` 映射

## 5. 算法体定位

- [ ] `onmessage` 入口
- [ ] dispatcher / switch / handler map
- [ ] crypto / wasm / vm / importScripts 装载点
- [ ] 回包前最后一拍
- [ ] 输出是否还会被主线程二次编码

输出：
- 真正计算入口
- 输出 sink
- 最后一次语义变化点

## 6. Service Worker 控制面

仅在命中 Service Worker 时：

- [ ] `fetch` 是否拦截
- [ ] 缓存策略
- [ ] `install / activate / skipWaiting / clients.claim`
- [ ] `navigation preload`
- [ ] 是否改写请求头、body、响应体或缓存命中路径

输出：
- fetch/caching 角色
- 升级控制边界

## 7. 复现边界

- [ ] worker 输入是否可稳定采样
- [ ] worker 输出是否可稳定采样
- [ ] 是否依赖时间、随机数、环境值、DOM 代理值
- [ ] 先用浏览器 harness 还是直接 Node/Python 迁移

输出：
- 最小复现边界
- 当前推荐模式：浏览器内复用 / 本地复现 / 纯算法继续提取

## 8. 常见误判排除

- [ ] 只命中 `btoa` 就误判为核心算法
- [ ] 只记录 blob URL，没恢复 blob 源码链
- [ ] 只知道“字段像是 worker 生成”，没建立字段映射
- [ ] 只看主线程，没抓 worker 消息面
- [ ] 过早 pure extraction，未先固定输入输出边界

## 最低交付核对

- [ ] `run/worker-notes.md`
- [ ] worker 类型、URL / Blob 来源、创建点、创建时机、职责
- [ ] 关键消息样例
- [ ] 至少一条字段映射链
- [ ] 若命中 Service Worker，说明 fetch/caching 角色
