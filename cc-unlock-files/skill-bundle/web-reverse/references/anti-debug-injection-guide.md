# Anti-Debug Injection Guide

目标：根据触发时机选择 `preload`、`runtime` 或 `breakpoint`。

## 选择矩阵

### 用 `preload`

适用于：

- 页面打开即暂停
- 首屏初始化前已装配 `debugger`
- `Function("debugger")`、timer、尺寸检测在首屏执行

推荐模板：

- `artifacts/tasks/_TEMPLATE/run/anti-debug-preload.js`

### 用 `runtime`

适用于：

- 页面已加载完成，但动作触发后才进入反调试
- 需要保留现有现场再局部绕过
- 重点是 `toString`、console、bridge 级别检测

推荐模板：

- `artifacts/tasks/_TEMPLATE/run/anti-debug-runtime.js`

### 用 `breakpoint`

适用于：

- 只需命中特定一次构造或一次 handler
- hook 会引起完整性检测
- 需要确认最小触发点再回到 hook

## 最小记录

- `triggerStage`
- `injectionStrategy`
- `patterns`
- `bypassStatus`
- `unresolved`

