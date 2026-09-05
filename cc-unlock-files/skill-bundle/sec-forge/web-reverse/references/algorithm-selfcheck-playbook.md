# Algorithm Self-Check Playbook（控制变量算法自检 + 双闸门）

Version: 1

> **何时读我**：D/E 模式（本地复现 / 纯算法提取）已还原出算法、准备验证时；或服务端验收
> （`run/verify-once.mjs` / `verify-offline.py`）反复失败、需要把"算法错"与"补环境错"拆开排查时。
>
> 与既有文档的关系：`env-as-algorithm-input-playbook.md` 的"控制变量法"判定的是**哪个环境值参与算法**
> （input vs detection-only）；本文判定的是**还原出来的算法实现本身是否正确**。两者方法形似、目的不同，互补。

## 为什么需要两道闸门

签名/参数普遍掺入随机数、时间戳、nonce、随机 key，输出几乎不重复。这带来一个排查困境：
脱机实现被服务器拒绝（403/风控）时，你分不清是 **算法还原错了**，还是 **补环境/风控字段没对齐**。

把验证拆成两道独立闸门即可解耦：

| 闸门 | 脚本 | 口径 | 对随机 |
|------|------|------|--------|
| **算法自检** | `scripts/verify/verify-algo.py` | 钉死随机源后，纯算输出 == 浏览器输出（逐字节相等） | 钉死（控制变量） |
| **服务端验收** | `scripts/verify/verify-offline.py` 或 `run/verify-once.mjs` | 脱机纯算生成参数被服务器稳定接受 | 照常（语义校验，天然免疫） |

**顺序**：先过算法自检（证明算法对），再过服务端验收（证明真成功）。算法自检不过就别急着发请求——那一定是算法问题，不是补环境问题。

> ⚠️ 不要用朴素字节比对当验收：签名含随机/时间戳，同输入也不重复，**只有控制变量（verify-algo）下才该逐字节相等**；
> 验收只认服务器接受（verify-offline / verify-once）。把这两件事混在一起是高发误判。

## 统一实现契约：`generate(ctx, pinned=None)`

两道闸门共用同一个纯算实现签名，避免维护两份代码：

```python
def generate(ctx: dict, pinned: dict | None = None) -> dict | str:
    # pinned=None  → 内部随机/时间戳照常（服务端验收用）
    # pinned 给定  → 用其替换内部随机源（控制变量自检用）
    rand = (lambda: pinned["rand"]) if pinned else random.random
    ts   = pinned["ts"]  if pinned else now_ms()
    key  = pinned["key"] if pinned else gen_key()
    ...
```

成品脚本仍遵守 web-reverse 命名约定：以 `pure-` / `pure_` 开头落在 `run/`（如 `run/pure-signer.py`）。

## fixtures 怎么采（算法自检用）

在浏览器侧 Hook 固定随机源，采一组 `{ctx, pinned, expected}` 落到 `run/fixtures.json`：

```js
// document-start 注入
Math.random = () => 0.5;
Date.now    = () => 1700000000000;
// 若有随机 key 生成器，一并 hook 成定值
```

```json
[
  {"ctx": {"body": "..."},
   "pinned": {"rand": 0.5, "ts": 1700000000000, "key": "deadbeefdeadbeef"},
   "expected": "<浏览器在该 pinned 下产出的完整参数>"}
]
```

## 执行

```bash
# 1. 算法自检（先）
python scripts/verify/verify-algo.py --impl artifacts/tasks/<id>/run/pure-signer.py \
       --fixtures artifacts/tasks/<id>/run/fixtures.json
# → "OK 算法逻辑正确" 才进下一步；FAIL 时定位差异字段回去比对该段还原

# 2. 服务端验收（后；Python 路线，或改用 run/verify-once.mjs）
python scripts/verify/verify-offline.py --impl artifacts/tasks/<id>/run/pure-signer.py --rounds 5
# → 通过率 5/5 才算稳定
```

## 与 claim-hygiene / 完成门禁的关系

- 算法自检通过仅代表"算法对"，**不是验收**，claimLevel 最高停在 `provisional`/`route-ready`。
- 升到 `delivered` 仍以服务端验收（`run/verify-once.mjs` 跑通 + `fixtures.json` + `acceptanceGap` 为空）为准，见 SKILL.md「回复与完成门禁」与 `docs/reference/claim-hygiene.md`。
- `verify-offline.py` 内置防捷径守卫：检测到 playwright/selenium 等浏览器自动化模块即报错退出——呼应红线「浏览器/RPC 不得充当交付」。
