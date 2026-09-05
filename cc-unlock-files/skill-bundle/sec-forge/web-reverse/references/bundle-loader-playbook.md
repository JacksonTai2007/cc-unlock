# Bundle Loader Playbook

适用场景：目标使用动态 import、异步 chunk、模块预加载、运行时 loader。

## 目标

- 确认入口 chunk 和动态 chunk 关系
- 确认加载时机和加载条件
- 定位关键逻辑究竟在哪个 chunk 中

## 建议流程

1. 识别 loader 类型：Webpack / Vite / Rollup / 自定义
2. 记录 chunk 请求 URL 与触发动作
3. 建立 `entry -> async chunk -> target function` 映射
4. 如有 source map，与 chunk mapping 联动

## 从「识别 chunk」到「扣出目标模块」

本页只解决"目标逻辑在哪个 chunk / 哪个 module id"。一旦定位到目标模块、要把它**连同依赖从运行时抽出来在 Node 单跑**，转 `closure-extraction-playbook.md`：那里有 `window.webpackChunk_xxx.push` 劫持 `__webpack_require__`、dump `__webpack_modules__`、递归收集依赖闭包、搭最小 require shim 的完整骨架，以及「扣 vs 不扣」阈值。

**目标在异步 chunk（splitChunks 按需加载）时**：直接 dump `__webpack_modules__` 会找不到目标 id——必须先用 `__R.e(chunkId)` 强制加载异步 chunk 再 dump，枚举 chunkId 与可复用骨架见 `closure-extraction-playbook.md` §2.1.5。

## 最低交付

- `run/chunk-loader-notes.md`
- chunk 关系图或文本对照
- 目标逻辑所在 module id（供 `closure-extraction-playbook.md` 抽闭包）

