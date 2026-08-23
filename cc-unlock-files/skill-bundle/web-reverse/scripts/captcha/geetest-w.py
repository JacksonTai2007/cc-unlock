#!/usr/bin/env python3
"""
geetest-w.py — GeeTest v3/v4 w 参数构造（通用骨架）

w = AES_CBC(payload, key, iv=0)[hex] + RSA_PKCS1v15(key)[hex]
  - AES: CBC 模式, IV = b'\\x00'*16, PKCS7 填充, 输出 hex
  - RSA: PKCS1_v1_5, 公钥 (n, e=0x10001)
  - 关键：同一次验证流程的所有请求共用同一个 16 位 key，只生成一次！

依赖：pip install pycryptodome

注意：n 与 payload 字段名/结构随版本、随站点变化，本文件给出通用骨架，
      实际 n、payload 组装需从目标站点扣取（见 references/captcha-slider-playbook.md 第三节）。
"""
import argparse
import binascii
import json
import random

from Crypto.Cipher import AES, PKCS1_v1_5
from Crypto.PublicKey import RSA
from Crypto.Util.Padding import pad


# GeeTest 常见公钥 n（示例，需按目标站点替换）—— 务必从目标 JS 中确认
DEFAULT_N = (
    "00C1E3934D1614465B33053E7F48EE4EC87B14B95EF88947713D25EECBFF7E74"
    "C7977D02DC1D9451F79DD5D1C10C29ACB6A9B4D6FB7D0A0279B6719E1772565F"
    "09AF627715919221AEF91899CAE08C0D686D748B20A3603BE2318CA6BC2B59706"
    "92277607734B1043CF03B5F41E20E1E2912319D05A70A87C0D8324CE6F9F2D74"
    "FA1F1C2E5F0E92E0D9DC0E89F62F1F5C0E5A1F"
)
DEFAULT_E = 0x10001


def gen_key(length: int = 16) -> str:
    """生成随机 AES key（16 位十六进制字符）"""
    return "".join(hex(random.randint(0, 15))[2:] for _ in range(length))


def aes_cbc_encrypt(plaintext: str, key: str) -> str:
    """AES-CBC, IV=全0, PKCS7, 返回 hex"""
    key_b = key.encode()
    iv = b"\x00" * 16
    cipher = AES.new(key_b, AES.MODE_CBC, iv)
    ct = cipher.encrypt(pad(plaintext.encode(), AES.block_size))
    return binascii.hexlify(ct).decode()


def rsa_encrypt_key(key: str, n_hex: str = DEFAULT_N, e: int = DEFAULT_E) -> str:
    """RSA PKCS1_v1_5 加密 AES key，返回 hex"""
    n = int(n_hex, 16)
    pub = RSA.construct((n, e))
    cipher = PKCS1_v1_5.new(pub)
    enc = cipher.encrypt(key.encode())
    return binascii.hexlify(enc).decode()


def build_w(payload: dict, key: str = None, n_hex: str = DEFAULT_N) -> str:
    """构造完整 w 参数。payload 为待加密的业务字段 dict。"""
    if key is None:
        key = gen_key()
    plaintext = json.dumps(payload, separators=(",", ":"))
    aes_part = aes_cbc_encrypt(plaintext, key)
    rsa_part = rsa_encrypt_key(key, n_hex)
    return aes_part + rsa_part


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--payload", required=True, help='待加密 payload 的 JSON 字符串')
    ap.add_argument("--key", help="指定 16 位 key（不指定则随机生成）")
    ap.add_argument("--n", default=DEFAULT_N, help="RSA 公钥 n (hex)")
    args = ap.parse_args()

    payload = json.loads(args.payload)
    key = args.key or gen_key()
    w = build_w(payload, key=key, n_hex=args.n)
    print(json.dumps({"key": key, "w": w}, ensure_ascii=False))


if __name__ == "__main__":
    main()
