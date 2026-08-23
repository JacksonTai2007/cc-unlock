#!/usr/bin/env python3
"""
verify-offline.py — 服务端验收（Python 纯算路线）：脱机纯算实现能否被服务器接受

定位（web-reverse 双闸门之二）：
  本脚本是 D/E 模式（本地复现 / 纯算法提取）在 Python 侧的服务端验收实现，
  与 run/verify-once.mjs（Node 侧）等价、二选一即可。无论用哪个，验收口径一致：
  脱机纯算生成参数 → 发真实请求 → 服务器【接受】（业务成功，非 403 / 非风控拦截）。

成功的定义（唯一判据）：
  在【无浏览器】环境下用纯算实现稳定产出被服务器接受。多轮均通过才算稳定。

为什么这样定义：
  - 现代签名普遍掺入随机数/时间戳/nonce/随机 key，输出几乎不重复，
    所以【不能】用"输出 == 固定期望值"做判据（那是 verify-algo.py 的活）。
  - 服务器按【语义】校验签名，不在乎具体随机值 → 此判据对随机天然免疫。
  - 本脚本【不启动任何浏览器】：偷偷依赖浏览器/RPC 的实现会在此跑不起来，
    从而同时锁死「必须纯算」这一约束（呼应红线：浏览器/RPC 不得充当交付）。

实现契约（与 verify-algo.py 共用同一签名）：
  generate(ctx: dict, pinned: dict | None = None) -> dict

用法：
  python scripts/verify/verify-offline.py --impl <run/pure-xxx.py> --rounds 5

按目标站点填写三个 TODO：build_context / build_request / is_accepted
"""
import argparse
import importlib.util
import sys


# ----- 防捷径守卫：禁止引入浏览器自动化（那等于 RPC，不是纯算） -----
_BANNED = {"playwright", "selenium", "pyppeteer", "DrissionPage",
           "undetected_chromedriver", "nodriver"}


def _assert_offline():
    leaked = _BANNED & set(sys.modules)
    if leaked:
        raise SystemExit(
            f"[verify] 检测到浏览器自动化模块 {leaked}：这是 RPC 捷径，不是纯算交付。"
            f" 服务端验收要求脱机纯算实现。")


def load_impl(path: str):
    spec = importlib.util.spec_from_file_location("impl", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "generate"):
        raise SystemExit(f"[verify] {path} 必须暴露 generate(ctx, pinned=None) -> dict")
    return mod


# ===================== 按目标站点实现下面三个函数 =====================

def build_context() -> dict:
    """构造一次请求所需的上下文（每轮调用，应产生新鲜的随机/时间戳）。
    例如：{'url': ..., 'cookies': ..., 'body': ..., 'ts': now_ms()}"""
    raise NotImplementedError("TODO: 按目标站点构造请求上下文")


def build_request(ctx: dict, sign_params: dict):
    """把 generate() 产出的签名参数组装进真实请求并发送，返回 response。
    用 requests / httpx / curl_cffi（模拟 TLS 指纹）。"""
    raise NotImplementedError("TODO: 组装并发送真实请求")


def is_accepted(resp) -> bool:
    """判定服务器是否【接受】：业务成功标志，且非 403 / 非风控。
    例如：resp.status_code == 200 and resp.json().get('code') == 0"""
    raise NotImplementedError("TODO: 判定服务器是否接受")

# ====================================================================


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--impl", required=True, help="纯算实现文件，暴露 generate(ctx, pinned=None)->dict")
    ap.add_argument("--rounds", type=int, default=5, help="验收轮数（默认5）")
    args = ap.parse_args()

    impl = load_impl(args.impl)
    _assert_offline()  # 加载实现后立刻检查：实现是否偷偷拉起了浏览器

    ok = 0
    for i in range(args.rounds):
        ctx = build_context()
        sign = impl.generate(ctx)          # 纯算：每轮随机照常参与
        resp = build_request(ctx, sign)
        accepted = is_accepted(resp)
        ok += accepted
        print(f"[round {i+1}/{args.rounds}] accepted={accepted}")

    rate = ok / args.rounds
    print(f"\n[verify] 通过率 {ok}/{args.rounds} = {rate:.0%}")
    if rate < 1.0:
        print("[verify] 未全部通过 → 算法/补环境/风控字段仍有问题，回 Observe/Capture 排查。")
        sys.exit(1)
    print("[verify] OK 验收通过：脱机纯算生成的参数被服务器稳定接受。")


if __name__ == "__main__":
    main()
