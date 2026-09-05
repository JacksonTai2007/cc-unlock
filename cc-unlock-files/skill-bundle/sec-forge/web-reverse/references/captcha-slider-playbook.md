# Captcha / Slider Playbook（滑块 / 点选 / 旋转验证码）

Version: 1

> **何时读我**：`challenge-orchestration` 命中 **visual challenge**——目标是滑块/点选/旋转验证码
> （出现 `gettype`、`w` 参数、滑块底图，平台如 GeeTest/数美/顶象/百度/易盾）时。先在
> `challenge-orchestration-playbook.md` 建好状态机，再进本文做密文还原。
> **配套脚本**：`scripts/captcha/slide-gap.py`（缺口识别）、`scripts/captcha/track-gen.py`（轨迹）、`scripts/captcha/geetest-w.py`（w 参数）。

## 一、通用流程（全平台一致）

```
1. 抓包建图谱（记录完整请求序列）——并落进 run/challenge-state-machine.json
   GeeTest v3: gettype → get(图) → ajax(空滑块) → ajax(带w)
   GeeTest v4: load → verify  | 易盾: getconf→up→get→check | 数美: captcha→verify
2. 定位密文参数（通常 1~2 个）
3. XHR 断点 → 调用栈回溯 → 找参数赋值行
4. 识别加密算法（见 §二）
5. 还原底图 → 识别缺口 → 生成轨迹 → 构造密文 → 提交
```

验收口径：**端到端服务端返回成功**（求解器实际通过、`error==0` 且业务校验通过），不是"格式被接受"。
对应 SKILL.md 模式 A 红线——由 `run/verify-once.mjs` 复现，未复现前 claimLevel 最高 `provisional`。

## 二、各平台加密差异

| 平台 | 加密方式 | 关键参数 |
|------|---------|---------|
| GeeTest v3/v4 | AES-CBC + RSA-PKCS1v15 | `w` = AES(payload) + RSA(key) |
| 数美 | DES-ECB + ZeroPadding | `gg`=DES(距离), `hg`=DES(轨迹) |
| 顶象 | btoa(拼接字段) | `ac` = btoa(多字段) |
| 百度旋转 | AES-ECB 双层 | key 由接口 `as` 末位字符 hash 派生 |
| 易盾 | 自定义 RSA + AES | `d` 字段多层加密 |

## 三、GeeTest w 参数结构

```python
# w = AES_CBC(payload) + RSA_PKCS1(aes_key)
# AES: CBC, IV=b'\x00'*16, PKCS7, 输出 hex
# RSA: n=0x00C1E3934D1..., e=0x010001
# 关键：同一次验证流程所有请求共用同一个 key，扣代码时只生成一次！
import random
def gen_key(): return ''.join(hex(random.randint(0,15))[2:] for _ in range(16))
```
完整 AES+RSA 实现见 `scripts/captcha/geetest-w.py`（n 与 payload 需按目标站点扣取替换）。

## 四、GeeTest v3 底图还原（固定乱序数组）

```python
Ut = [39,38,48,49,41,40,46,47,35,34,50,51,33,32,28,29,27,26,36,37,
      31,30,44,45,43,42,12,13,23,22,14,15,21,20,8,9,25,24,6,7,3,2,
      0,1,11,10,4,5,19,18,16,17]
def restore(img):
    s = Image.new("RGBA", (260, img.height)); a = img.height // 2
    for idx, val in enumerate(Ut):
        c = val % 26 * 12 + 1; u = a if val > 25 else 0
        s.paste(img.crop((c, u, c+10, u+a)), (idx%26*10, a if idx>25 else 0))
    return s
# 定位还原代码：Event Listener Breakpoints → Canvas → Create canvas context
```

## 五、缺口识别

```python
import cv2
def get_gap(bg, slide):
    r = cv2.matchTemplate(cv2.Canny(cv2.imread(bg,0),100,200),
                          cv2.Canny(cv2.imread(slide,0),100,200), cv2.TM_CCORR_NORMED)
    return cv2.minMaxLoc(r)[3][0]
# 或 ddddocr：det.slide_match(slide_bytes, bg_bytes, simple_target=True)['target'][0]
```
脚本：`python scripts/captcha/slide-gap.py bg.png slide.png`（自动选 ddddocr，回退 OpenCV）。

## 六、轨迹生成

```python
import math, random
def ease_out_expo(t): return 1 - math.pow(2, -10*t)
def gen_track(distance):
    track, t = [], 0
    for i in range(100):
        track.append([int(distance*ease_out_expo(i/100)), 0, t]); t += random.randint(7,17)
    return track
# 三段式：加速(70%) → 超冲 → 回撤(-1~-2px) → 对齐
# 自动化时距离需除以页面缩放比(约/1.97)再减初始偏移(约30px)
```
脚本：`python scripts/captcha/track-gen.py <距离> --scale 1.97 --offset 30`。

## 七、验证码识别方案

| 类型 | 方案 |
|------|------|
| 滑块缺口 | cv2 Canny+matchTemplate 或 ddddocr.slide_match |
| 旋转 | `rotate-captcha-crack` |
| 文字点选/九宫格 | ResNet18 特征+余弦相似度（约 500 样本起） |
| 算术/字符 OCR | ddddocr |

## 八、常见坑

- 同一 key 复用：GeeTest 同流程多个 w 共用 AES key，只生成一次
- challenge 混用：rp 用图片接口返回的 challenge，非 gettype
- 图片缩放：易盾背景 480px 计算时需 resize 到 420px
- 动态时间戳 `?cdnversion=xxx` 无法断点 → DevTools Overrides 重写 URL
