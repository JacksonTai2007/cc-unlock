# Binary Codec Playbook

Version: 1

适用场景：目标在浏览器内处理 `protobuf`、`msgpack`、`cbor`、`flatbuffers`、自定义二进制帧或长度前缀编码。

## 目标

- 识别编码族、长度字段、schema 线索与消息类型边界。
- 识别 decode 入口、encode 回写与协议字段映射。
- 为 replay、stream、compression、wasm 提供稳定的字段模型。

## 建议流程

1. 先按 transport 与 framing 记录样本，不要直接把全部字节当正文。
2. 记录首字节、长度字段、tag / varint / type marker 这类结构边界。
3. 同时找 decode path 与 encode path，避免只看到 reader 不看到 writer。
4. 如存在压缩或流式分块，补读相邻专题。

## 最低交付

- `run/binary-codec-notes.md`
- `run/binary-samples.json`

## 禁止事项

- 只保存十六进制样本，不建立消息类型或字段线索。
- 只看 decode，不确认 encode 或 replay 写回路径。
- 把压缩边界、二进制边界、协议边界混在一个结论里。
