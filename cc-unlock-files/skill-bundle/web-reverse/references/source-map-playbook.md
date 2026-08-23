# Source Map Playbook

Version: 1

适用场景：存在 `sourceMappingURL`、SourceMap 响应头、内联 map、隐藏 map、chunk 与源码定位需求。

## 目标

- 确认 map 是否存在
- 恢复原始文件路径和 chunk 关系
- 用源码层定位目标函数、sign 链路、关键常量

## 建议流程

1. 检查 bundle 尾部 `sourceMappingURL`
2. 检查响应头中的 source map 线索
3. 记录 map 获取方式：内联 / 外链 / 隐式
4. 恢复原始 sources 列表
5. 建立 `bundle -> source file -> function` 映射
6. 用源码定位目标函数，再回到运行时验证

## 最低交付

- `run/source-map-notes.md`
- 原始 sources 列表
- 关键函数与 bundle/chunk 对照

## 禁止事项

- 有 source map 时仍只停留在压缩 bundle 层分析
- 只记录 map 存在，不恢复 sources 和函数落点
