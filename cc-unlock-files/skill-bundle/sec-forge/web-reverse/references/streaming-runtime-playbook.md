# Streaming Runtime Playbook

Version: 1

适用场景：目标使用 `ReadableStream`、`TransformStream`、`TextDecoderStream`、BYOB reader、增量解码、边下边算或边下边执行业务逻辑。

## 目标

- 识别 stream source、transform、sink 与业务边界。
- 识别增量解码、拆包、缓存、拼包或中间态缓冲策略。
- 识别 stream 是否与 dynamic-code、binary-codec、compression、wasm 交织。

## 建议流程

1. 先画出 `source -> transform -> sink` 管线，不要只盯某个回调。
2. 记录 chunk boundary、flush 时机、buffer 重用与错误恢复。
3. 记录业务逻辑首次稳定出现在哪个 stage。
4. 如果 stream 下游是 eval、WASM、二进制或压缩，补读相邻专题。

## 最低交付

- `run/streaming-runtime-notes.md`
- `run/stream-pipeline.json`

## 禁止事项

- 只记单个 callback，不建立整条 pipeline。
- 不记录 chunk 边界与 flush 时机。
- 混淆 transport streaming 与业务增量执行。
