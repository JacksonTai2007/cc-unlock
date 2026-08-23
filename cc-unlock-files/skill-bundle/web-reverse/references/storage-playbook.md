# Storage Playbook

适用场景：目标依赖 cookie、localStorage、sessionStorage、IndexedDB、CacheStorage 或 token 生命周期。

## 目标

- 确认哪些存储参与请求、签名、登录或风控
- 确认值的来源、更新时机和使用时机
- 确认哪些值只是 carrier，哪些值会被镜像到内存 signer state
- 输出最小可复用快照

## 建议流程

1. 先确认**哪些值真的参与请求验收 / signer / challenge**
2. 优先找 `reader / sign / request-use`，再回看 `cookie / localStorage / sessionStorage`
3. 再看 IndexedDB / CacheStorage
4. 标记每个值的角色：认证 / token / seed / fingerprint / cache
5. 建立“写入 -> 读取 -> 请求使用”链路
6. 如存在 stateful signer，补齐“storage / cookie -> memory signer state -> sign -> request”链路
7. 生成最小脱敏快照

关键原则：

- 不要把“carrier 来源考古”误当成主线；先证明这个值确实进入 `reader / signer / payload / request-use`
- 如果已经知道某个值被请求使用，就优先闭合 `reader -> sign -> request-use`，不要在低层 `cookie setter / storage setter` 上无限细挖
- `document.cookie`、storage setter 只回答“谁写了 carrier”，回答不了“谁在用它”；真正影响验收的通常是 `reader / payload builder / request builder`

## 最低交付

- `run/storage-snapshot.json`
- `run/storage-notes.md`
- token 生命周期说明

命中 stateful signer 时，额外补充：

- `run/signer-state-map.md`
- 明确写出当前主线停在 `reader / writer / request-use` 的哪一段，避免把“还没追到请求使用”误写成“storage 已搞清”

## 禁止事项

- 把所有 storage 全量原样导出
- 不区分认证值和噪音缓存
- 只看 storage 当前值，不追踪它何时被同步进 signer state
- 把 `cookie / storage` 低层写入点之间来回切换，当作已经完成了 pivot
- 只证明“写入存在”，不证明 `reader / sign / request-use` 如何消费它
