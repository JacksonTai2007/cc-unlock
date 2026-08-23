#!/usr/bin/env python3
"""
verify-algo.py — 开发期算法自检：控制变量法（钉死随机后逐字节相等）

定位（web-reverse 双闸门之一）：
  本脚本验证【算法逻辑】是否还原正确，与随机/补环境解耦。它是 run/verify-once.mjs
  （服务端验收）之前的一道独立闸门——先证明「算法对」，再验「服务器接受」，
  从而把"算法错"与"补环境错/漏风控字段"两类失败彻底分开排查。

原理：把随机源（Math.random / Date.now / 随机 key / nonce）在两端钉死成同一组固定值，
      消除随机性后，纯算输出【必须】== 浏览器在相同固定值下的输出（逐字节）。
      不等 = 算法还原错了，定位差异字段回去比对该段还原。

fixtures 怎么来：
  在浏览器侧 Hook 固定随机源后采集一组样本，例如：
    Math.random = () => 0.5;
    Date.now    = () => 1700000000000;
    <随机 key 生成器> = () => 'deadbeefdeadbeef';
  然后记录 {ctx 输入, pinned 固定随机值, expected 浏览器输出}。

实现契约（统一约定，与服务端验收脚本共用同一签名）：
    generate(ctx, pinned=None)
      - pinned=None     → 内部随机/时间戳照常（服务端验收用）
      - pinned 给定     → 用其替换内部随机源（本脚本控制变量自检用）

用法：
  python scripts/verify/verify-algo.py --impl <run/pure-xxx.py> --fixtures <run/fixtures.json>

fixtures.json 形如：
  [
    {"ctx": {"body": "..."}, "pinned": {"rand": 0.5, "ts": 1700000000000, "key": "deadbeefdeadbeef"},
     "expected": "<浏览器在该 pinned 下产出的完整参数>"}
  ]

落盘约定（web-reverse）：impl 与 fixtures 均落在 artifacts/tasks/<task-id>/run/ 下。
"""
import argparse
import importlib.util
import json
import sys


def load_impl(path: str):
    spec = importlib.util.spec_from_file_location("impl", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "generate"):
        raise SystemExit(f"[verify-algo] {path} 必须暴露 generate(ctx, pinned=...)")
    return mod


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--impl", required=True)
    ap.add_argument("--fixtures", required=True, help="JSON：[{ctx, pinned, expected}, ...]")
    args = ap.parse_args()

    impl = load_impl(args.impl)
    with open(args.fixtures, encoding="utf-8") as f:
        cases = json.load(f)

    passed = 0
    for i, case in enumerate(cases):
        got = impl.generate(case["ctx"], pinned=case.get("pinned"))
        # generate 可能返回 dict 或 str；统一成字符串比对目标字段
        got_str = got if isinstance(got, str) else json.dumps(got, sort_keys=True, separators=(",", ":"))
        exp = case["expected"]
        exp_str = exp if isinstance(exp, str) else json.dumps(exp, sort_keys=True, separators=(",", ":"))
        ok = got_str == exp_str
        passed += ok
        print(f"[case {i+1}/{len(cases)}] {'OK' if ok else 'FAIL'}")
        if not ok:
            print(f"   expected: {exp_str[:120]}")
            print(f"   got:      {got_str[:120]}")

    print(f"\n[verify-algo] {passed}/{len(cases)} 通过")
    if passed < len(cases):
        print("[verify-algo] 算法逻辑仍有错（钉死随机后仍不等）。定位差异字段，回去比对该段还原。")
        sys.exit(1)
    print("[verify-algo] OK 算法逻辑正确（控制变量下逐字节一致）。可进入服务端验收。")


if __name__ == "__main__":
    main()
