#!/usr/bin/env python3
"""
slide-gap.py — 滑块缺口距离识别

两种方法：
  1) ddddocr（推荐，简单）：slide_match(slide, bg)
  2) OpenCV Canny + matchTemplate（无依赖 ddddocr 时的回退）

用法：
  python scripts/captcha/slide-gap.py bg.png slide.png            # 自动选可用方法
  python scripts/captcha/slide-gap.py bg.png slide.png --cv       # 强制用 OpenCV
  python scripts/captcha/slide-gap.py bg.png --full full_bg.png   # 完整图 vs 带缺口图(纯cv)

依赖（任选）：
  pip install ddddocr
  pip install opencv-python numpy

配套：references/captcha-slider-playbook.md
"""
import argparse
import sys


def gap_by_ddddocr(bg_path: str, slide_path: str) -> int:
    import ddddocr
    det = ddddocr.DdddOcr(det=False, ocr=False, show_ad=False)
    with open(bg_path, "rb") as f:
        bg = f.read()
    with open(slide_path, "rb") as f:
        slide = f.read()
    res = det.slide_match(slide, bg, simple_target=True)
    # res['target'] = [x1, y1, x2, y2]
    return int(res["target"][0])


def gap_by_opencv(bg_path: str, slide_path: str) -> int:
    import cv2
    bg = cv2.imread(bg_path, 0)
    slide = cv2.imread(slide_path, 0)
    if bg is None or slide is None:
        raise FileNotFoundError("无法读取图片，检查路径")
    bg_edge = cv2.Canny(cv2.GaussianBlur(bg, (3, 3), 0), 100, 200)
    slide_edge = cv2.Canny(cv2.GaussianBlur(slide, (3, 3), 0), 100, 200)
    result = cv2.matchTemplate(bg_edge, slide_edge, cv2.TM_CCORR_NORMED)
    _, _, _, max_loc = cv2.minMaxLoc(result)
    return int(max_loc[0])


def gap_full_vs_bg(full_path: str, bg_path: str) -> int:
    """完整背景图 vs 带缺口背景图：差分定位缺口 x 坐标"""
    import cv2
    import numpy as np
    full = cv2.imread(full_path)
    bg = cv2.imread(bg_path)
    diff = cv2.absdiff(full, bg)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    _, thr = cv2.threshold(gray, 30, 255, cv2.THRESH_BINARY)
    cols = np.where(thr.sum(axis=0) > 0)[0]
    if len(cols) == 0:
        raise ValueError("未检测到差异区域")
    return int(cols.min())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bg", help="背景图(带缺口)路径")
    ap.add_argument("slide", nargs="?", help="滑块小图路径")
    ap.add_argument("--full", help="完整背景图(差分法)")
    ap.add_argument("--cv", action="store_true", help="强制使用 OpenCV")
    args = ap.parse_args()

    if args.full:
        print(gap_full_vs_bg(args.full, args.bg))
        return

    if not args.slide:
        ap.error("需要 slide 参数，或使用 --full")

    if not args.cv:
        try:
            print(gap_by_ddddocr(args.bg, args.slide))
            return
        except ImportError:
            print("[slide_gap] ddddocr 未安装，回退 OpenCV", file=sys.stderr)
    print(gap_by_opencv(args.bg, args.slide))


if __name__ == "__main__":
    main()
