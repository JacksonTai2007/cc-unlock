# SubtleCrypto Playbook

Version: 1

适用场景：目标把 `crypto.subtle`、`importKey`、`deriveKey`、`sign`、`verify`、`encrypt`、`digest` 作为签名、challenge token 或 payload 加密入口。

## 目标

- 识别 key source、key carrier 与 key lifecycle。
- 识别算法参数、输入归一化和输出 carrier。
- 识别 WebCrypto 边界与 protocol / session / challenge 的绑定关系。

## 建议流程

1. 先确认调用发生在 `window / worker / frame / generated code` 的哪一层。
2. 记录 `importKey`、`deriveKey`、`generateKey`、`unwrapKey` 的入参与返回对象类型。
3. 记录 `sign / digest / encrypt` 的输入归一化步骤与输出去向。
4. 如 key 或参数跨过 protocol / session / challenge 边界，补读相邻专题。

## 最低交付

- `run/subtlecrypto-notes.md`
- `run/subtlecrypto-keyflow.json`

## 禁止事项

- 只记录算法名，不记录 key carrier 与 key usage。
- 还没确认输入归一化，就把摘要或签名当成最终算法结论。
- 跳过明文到协议字段的映射，只留下零散 hook 日志。
