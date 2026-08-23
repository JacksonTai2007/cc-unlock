# Microfrontend Runtime Playbook

适用场景：

- 命中 `System.import / importmap / single-spa / qiankun / remote manifest`
- 需要恢复微前端 remote loader、子应用装载器或共享依赖
- 签名或风控逻辑散落在子应用和宿主之间

工作顺序：

1. 先画出宿主、remote manifest、subapp mount 关系
2. 明确 loader 类型、shared deps、sandbox 和路由切换
3. 记录业务模块来自哪个远端、在哪个阶段挂载
4. 最后验证切换路径和依赖共享不会破坏 replay

最低交付：

- `run/runtime-map.json`
- `run/remote-deps.md`
- `run/verify-once.mjs`

注意事项：

- 不要只盯 `module federation`，很多站点是自研 remote loader
- 先确认宿主边界和远端装载顺序，再深入子应用内部
