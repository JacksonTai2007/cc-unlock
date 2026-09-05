# GraphQL RPC Playbook

适用场景：

- 请求命中 `/graphql`
- 出现 `operationName / query / mutation / persistedQuery / sha256Hash`
- 需要恢复 APQ、批量 transport、变量归一化或签名绑定

工作顺序：

1. 记录 transport 形式：单次、批量、GET persisted query、POST body
2. 拆 `operationName / document / variables / extensions` 的真实来源
3. 区分普通 GraphQL、Persisted Query、APQ 和签名绑定层
4. 最后做最小 verify，确认 query map 与变量归一化可复现

最低交付：

- `run/graphql-ops.json`
- `run/query-map.md`
- `run/verify-once.mjs`

注意事项：

- 不要把 persisted hash 当作完整语义，需要回指 operation 和变量
- GraphQL 经常和签名、压缩、批量 transport 叠加，必须一起看
