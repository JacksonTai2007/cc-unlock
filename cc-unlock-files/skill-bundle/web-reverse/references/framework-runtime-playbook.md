# Framework Runtime Playbook

Version: 2

适用场景：目标运行在 `Next.js`、`Nuxt`、`Remix`、`Vite`、`SvelteKit`、`Astro` 等现代框架或原生 ESM runtime 中，需要区分 SSR/CSR、hydration、islands、payload、modulepreload 与 runtime loader 边界。

## 目标

- 识别框架类型、payload 载体、hydration 边界与业务入口。
- 识别 `modulepreload`、`import.meta.*`、islands / partial hydration、RSC 或 server payload 边界。
- 识别框架 runtime 与 bundle-loader / source-map / session 的耦合关系。
- 为后续源码恢复、payload 重放或 session bootstrap 提供稳定边界。

## 建议流程

1. 先判断框架与渲染模式，不要直接在打包代码里盲找业务入口。
2. 记录 SSR payload、hydration root、client router、data fetch 与 `modulepreload` / import graph 边界。
3. 如果命中 `Vite`、`Astro`、`SvelteKit` 或 islands，先把原生 ESM runtime、岛组件 props、partial hydration 触发条件拆开记录。
4. 如果命中 RSC / server action / app router，优先区分 flight payload、HTML shell、client runtime 与业务 action carrier。
5. 把 framework runtime、业务 chunk、session bootstrap 分开记录。
6. 如果 payload 或 route 数据跨过 source-map、bundle-loader、session，补读相邻专题。

## 最低交付

- `run/framework-runtime-notes.md`
- `run/framework-payload-map.json`
- 至少一个 runtime boundary 说明：`payload` / `modulepreload` / `island` / `flight`

## 禁止事项

- 只看到 `__NEXT_DATA__` 就宣布入口已明。
- 只看到 `import.meta.env`、`modulepreload` 或 islands 标记就把框架 runtime 误判成业务逻辑。
- 不区分 framework runtime 与业务代码。
- 忽略 SSR payload 与 hydration 之间的状态传递。
