# scripts 索引

> 这些是**机械工序脚本**（直接 `node`/`python` 调用，勿重写）。与 `tools/`（任务契约/QA 机制）不同，
> 本目录是"具体怎么做"的即跑工具，由 nweb-reverse 精华吸收而来。落盘约定不变：本任务产生的
> impl/样本/中间数据一律进 `artifacts/tasks/<task-id>/run/`（红线 2）；本目录脚本本身是 skill 包内工具，不属于任务产物。

## 验证双闸门（核心）

| 脚本 | 作用 | 何时跑 |
|------|------|--------|
| `verify/verify-algo.py` | **控制变量自检**：钉死随机源后纯算输出与浏览器输出逐字节相等 → 验**算法对不对** | 算法还原后、服务端验收前 |
| `verify/verify-offline.py` | **服务端验收（Python 路线）**：脱机纯算生成参数被服务器稳定接受 → 验**真成功**，对随机免疫 | 声称完成前（与 `run/verify-once.mjs` 二选一） |

二者共用实现契约 `generate(ctx, pinned=None)`：`pinned=None` 随机照常（验收），`pinned` 给定替换随机源（自检）。详见 `references/algorithm-selfcheck-playbook.md`。

## 反混淆 / VM / 补环境

| 脚本 | 作用 | 配套 playbook |
|------|------|---------------|
| `deob/deob-ob.cjs` | OB(obfuscator.io) 标准混淆反混淆器（大数组+解密函数→字面量） | `references/string-array-deobfuscation-playbook.md` |
| `vm/jsvmp-instrument.cjs` | JSVMP 解释器 switch 分发器自动插桩，收 opcode 序列 | `references/vmp-playbook.md` |
| `env/proxy-env.cjs` | 补环境 Proxy 自吐器 + 最小 Node mock | `docs/reference/env-patching.md` |

## 验证码 / 滑块

| 脚本 | 作用 | 配套 playbook |
|------|------|---------------|
| `captcha/slide-gap.py` | 滑块缺口距离识别（ddddocr 首选 / OpenCV 回退） | `references/captcha-slider-playbook.md` |
| `captcha/track-gen.py` | 滑块轨迹生成（ease_out / 三段式拟人） | 同上 |
| `captcha/geetest-w.py` | GeeTest v3/v4 `w` 参数构造（AES-CBC + RSA） | 同上 |

## 依赖安装（按需）

- Python：`pip install -r scripts/requirements.txt`（各脚本头注释标了自己的最小依赖）
- Node：`deob-ob.cjs` / `jsvmp-instrument.cjs` 需 `@babel/parser @babel/traverse @babel/generator @babel/types`；
  在 `scripts/` 下 `npm i @babel/parser @babel/traverse @babel/generator @babel/types` 即可。`proxy-env.cjs` 仅用内置 `crypto`，零依赖。
