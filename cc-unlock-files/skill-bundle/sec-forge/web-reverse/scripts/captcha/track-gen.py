#!/usr/bin/env python3
"""
track-gen.py — 滑块轨迹生成

提供两种轨迹模型：
  1) ease_out_expo —— 平滑加速（多数平台通用起点）
  2) three_stage   —— 三段式：加速(70%) → 超冲 → 回撤 → 对齐（更拟人）

用法（作为库）：
  # 命令行优先；如需作为库，用 importlib 按路径加载

命令行：
  python scripts/captcha/track-gen.py 120                 # 打印 three_stage 轨迹 JSON
  python scripts/captcha/track-gen.py 120 --ease          # 用 ease_out_expo
  python scripts/captcha/track-gen.py 120 --scale 1.97 --offset 30   # 自动化缩放/初始偏移修正

配套：references/captcha-slider-playbook.md
"""
import argparse
import json
import math
import random


def gen_ease_out(distance: float, steps: int = 100):
    """ease_out_expo 平滑加速轨迹。返回 [[x, y, t_ms], ...]"""
    track = []
    t = 0
    for i in range(steps):
        progress = i / steps
        x = int(distance * (1 - math.pow(2, -10 * progress)))
        y = random.choice([-1, 0, 0, 1])  # 轻微上下抖动
        track.append([x, y, t])
        t += random.randint(7, 17)
    track.append([int(distance), 0, t])
    return track


def gen_three_stage(distance: float):
    """三段式拟人轨迹：加速 → 超冲 → 回撤 → 对齐"""
    track = []
    t = 0
    current = 0.0
    v = 0.0
    overshoot = distance + random.randint(2, 5)  # 超冲目标

    # 阶段1+2：加速到超冲点（前 70% 加速，后段减速）
    mid = overshoot * 0.7
    while current < overshoot:
        a = random.uniform(2, 4) if current < mid else -random.uniform(2, 3)
        v += a
        if v < 0.5:
            v = 0.5
        current += v
        y = random.choice([-1, 0, 0, 0, 1])
        track.append([int(min(current, overshoot)), y, t])
        t += random.randint(8, 18)

    # 阶段3：回撤对齐（从超冲点退回 distance）
    back = int(current)
    while back > distance:
        back -= random.randint(1, 2)
        track.append([back, random.choice([-1, 0, 1]), t])
        t += random.randint(15, 30)

    track.append([int(distance), 0, t])
    return track


def correct_for_automation(distance: float, scale: float = 1.0, offset: float = 0.0) -> float:
    """自动化场景：距离需除以页面缩放比，再减去滑块初始偏移"""
    return distance / scale - offset


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("distance", type=float, help="缺口距离(px)")
    ap.add_argument("--ease", action="store_true", help="使用 ease_out_expo")
    ap.add_argument("--scale", type=float, default=1.0, help="页面缩放比(默认1.0)")
    ap.add_argument("--offset", type=float, default=0.0, help="滑块初始偏移(默认0)")
    args = ap.parse_args()

    d = correct_for_automation(args.distance, args.scale, args.offset)
    track = gen_ease_out(d) if args.ease else gen_three_stage(d)
    print(json.dumps(track, ensure_ascii=False))


if __name__ == "__main__":
    main()
