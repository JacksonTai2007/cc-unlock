# Session Lifecycle Playbook

Version: 1

适用场景：

- 目标依赖登录态、访客态、挑战态或设备态
- 请求签名依赖 cookie、csrf、nonce、ticket、refresh token
- 首次进入页面与二次请求的凭证来源不同
- token 会轮换、刷新、续签或挑战后升级

本专题的目标不是“拿到一个 token”这么简单，而是回答：

1. 会话是如何建立的
2. 凭证放在哪个载体里
3. 刷新或续签由谁触发
4. 什么时候必须重新登录，什么时候只需复用现有状态

## 1. 最小映射

至少要画清以下链路：

- 入口状态：匿名 / 已登录 / 已挑战
- bootstrap 请求或初始化脚本
- 凭证载体：
  - cookie
  - `localStorage`
  - `sessionStorage`
  - `IndexedDB`
  - 内存变量
  - worker / frame 消息
- 使用点：哪些请求真正消费这些凭证
- 镜像链：哪些 cookie / storage 值会再同步进 memory / worker / frame 的 signer state
- 刷新边界：过期、401、页面恢复、定时器、用户动作

## 2. 观察优先级

优先定位：

- 首屏初始化请求
- 登录成功后的第一跳请求
- 401 / 403 / challenge 响应后的恢复动作
- `Set-Cookie`
- csrf / nonce / ticket / device id 生成点
- 刷新 token 的接口和调用方

如果目标站点要求登录，不要反复新开浏览器实例。先复用当前实例，必要时提示用户在该实例内登录，然后继续同一会话分析。

## 3. 会话分层

报告里建议至少区分：

- `transport session`: cookie、httpOnly、同站策略
- `page session`: 页面内缓存、内存变量、runtime seed
- `application token`: csrf、bearer、x-token、custom header
- `challenge state`: 滑块、验证码、风控升级态

不要把所有东西都笼统叫“token”。

## 4. 常见抓取点

- `document.cookie` 的读写
- cookie / storage 到内存变量的桥接写入点
- `fetch` / XHR 请求头与响应头
- `localStorage` / `sessionStorage` 写入点
- 初始化脚本中的配置注入
- worker / iframe `postMessage`
- 定时刷新任务
- 登出 / 失效回调

## 5. 失效与刷新

必须区分三类情况：

- 凭证失效但可静默刷新
- 凭证失效且需要挑战
- 会话彻底失效，必须用户重新登录

只有第三类才应该把 `browserSession.reloginRequired` 标成 `true`。

## 6. 交付要求

命中本专题时，至少补充：

- `task.json.sessionLifecycle`
- `run/session-notes.md`
- `report.md` 中的 `会话生命周期状态`

报告至少写清：

- bootstrap 状态
- 主要凭证载体
- 是否存在 `cookie / storage -> memory signer state` 镜像
- 刷新状态
- 失效条件
- 是否需要用户重新登录
