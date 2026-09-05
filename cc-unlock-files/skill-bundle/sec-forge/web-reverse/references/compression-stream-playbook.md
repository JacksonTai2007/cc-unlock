# Compression Stream Playbook

Version: 1

适用场景：浏览器在协议链路或 challenge 链路中使用 `CompressionStream`、`DecompressionStream`、gzip/deflate/brotli、pako 或自定义压缩封装。

## 目标

- 识别压缩前明文边界、压缩算法和输出 carrier。
- 识别压缩是否发生在 binary codec 前后或 stream pipeline 中。
- 为 replay 或 pure extraction 提供稳定的压缩前后样本。

## 建议流程

1. 先确认压缩发生在 request 前、response 后还是 transform 中。
2. 记录压缩前明文结构与压缩后 carrier，不要只保留压缩后字节。
3. 记录算法、字典、flush 策略或 chunk 边界。
4. 如果压缩嵌在流式或二进制处理中，补读相邻专题。

## 最低交付

- `run/compression-stream-notes.md`
- `run/compression-samples.json`

## 禁止事项

- 只看压缩后 payload，不记录压缩前明文。
- 不确认压缩发生顺序，就直接迁移纯算法。
- 混淆 codec、compression、streaming 三个边界。
