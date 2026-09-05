# Userland Crypto Playbook

适用场景：

- 页面使用 `CryptoJS / forge / jsrsasign / 自研 AES / RSA / SM / XOR`
- 签名或加密逻辑不走 `crypto.subtle`
- 密码逻辑和编码、压缩、签名链混在一起

工作顺序：

1. **先执行"算法识别强制检查"**（见SKILL.md）：在假设"自定义加密"之前，必须排查已知标准算法（TEA/XOR/AES/RC4/SM4/DES/HMAC/SHA家族等），并完成完整输出观察
2. 再区分明文边界、编码层、压缩层和密码层
3. 记录核心调用图，明确 key、iv、salt、padding、mode 来源
4. 采集明密文样本，标记随机源、时间源、nonce、IV 或 padding 策略，验证是否达到语义等价复现。**样本必须覆盖完整输入输出，存在截断时必须显式标注**
5. 再做纯算法提取，产出 `pure-crypto.js`

最低交付：

- `run/crypto-callgraph.md`
- `run/plain-cipher-pairs.json`
- `run/pure-crypto.js`

注意事项：

- **严禁在未执行"算法识别强制检查"前假设"自定义算法"**——看到"只改了4字节"不等于"简单替换"，必须先排查TEA等轻量块加密
- 先拆边界再提纯，否则容易把编码或压缩误当加密
- 先用真实样本做一次浏览器内复验，再迁移到纯脚本
- 对 `RSA / OAEP / PKCS#1 v1.5 / random iv / salt` 场景，不要要求最终密文逐字一致；优先验证下游解密、验签或接口验收是否通过
- **样本必须覆盖完整输入输出（完整NAL/segment/body），截断样本上建立的局部假说不得直接进入深度验证**
- **观察到统计映射（如 (x,y)→(a,b) 映射关系）时，必须先排查已知算法，不得直接下"自定义S-box/查找表"结论**
