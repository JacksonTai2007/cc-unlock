# Frame Playbook

适用场景：目标逻辑位于 iframe / frame / 多 origin 上下文，或通过 `postMessage`、DOM 访问、共享状态在多个 frame 间协作。

## 目标

- 列出所有 frame / iframe
- 确认目标逻辑在哪个 frame 中执行
- 确认跨 frame 消息流和状态依赖
- 识别是否存在跨 origin 限制

## 建议流程

1. 枚举 frame 树和 URL
2. 标记同源 / 跨源边界
3. 记录关键逻辑所在 frame
4. 抓 `postMessage` 双向消息
5. 确认 token / sign / anti-debug / worker 是否被放在子 frame
6. 对每个关键结论标记 frame 归属

## 最低交付

- `run/frame-notes.md`
- frame 树
- 关键消息流
- 关键逻辑所属 frame

## 禁止事项

- 默认把主 frame 当作唯一执行上下文
- 只看 DOM，不看跨 frame 消息

