# Module Federation Playbook

Version: 1

适用场景：目标通过 `remoteEntry.js`、`container.get`、`share scope`、remote module manifest 或远程 runtime 拼装业务逻辑。

## 目标

- 识别 remoteEntry、share scope、remote module 与业务入口的关系。
- 识别远程模块装载顺序、依赖拼装与命名空间。
- 把远程装载边界与本地 chunk loader、frame、session 关系拆开记录。

## 建议流程

1. 先定位 `remoteEntry.js` 或等价 manifest，不要直接深挖业务模块。
2. 记录 `init`、`get`、share scope 初始化顺序与 remote namespace。
3. 把 remote loader、share dependency、业务模块分别写入产物。
4. 如果 remote module 发生在 iframe、session bootstrap 或多 origin 中，补读相邻专题。

## 最低交付

- `run/module-federation-notes.md`
- `run/remote-entry-map.json`

## 禁止事项

- 只看到 remoteEntry 就宣布入口已明。
- 不区分 share scope 与业务模块。
- 把本地 chunk loader 与远程 loader 混为一谈。
