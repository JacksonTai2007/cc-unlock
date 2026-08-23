#!/usr/bin/env python3
"""Normalize DEX SHA-1 signature and Adler32 checksum.

The script only fixes header hashes. It rejects obvious structural problems so a
broken memory dump is not accidentally laundered into a "valid" artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import struct
import zlib
from pathlib import Path


DEX_HEADER_SIZE = 0x70
ENDIAN_CONSTANT = 0x12345678


def read_u32(data: bytes | bytearray, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def validate_dex(data: bytes | bytearray) -> None:
    if len(data) < DEX_HEADER_SIZE:
        raise ValueError(f"file too small for DEX header: {len(data)} bytes")
    if data[:4] != b"dex\n":
        raise ValueError("not a standard DEX file; compact dex/cdex is not supported")

    file_size = read_u32(data, 0x20)
    header_size = read_u32(data, 0x24)
    endian_tag = read_u32(data, 0x28)
    map_off = read_u32(data, 0x34)

    if file_size != len(data):
        raise ValueError(f"DEX file_size mismatch: header=0x{file_size:x} actual=0x{len(data):x}")
    if header_size != DEX_HEADER_SIZE:
        raise ValueError(f"unexpected DEX header_size: 0x{header_size:x}")
    if endian_tag != ENDIAN_CONSTANT:
        raise ValueError(f"unexpected DEX endian_tag: 0x{endian_tag:x}")
    if map_off and not (DEX_HEADER_SIZE <= map_off < len(data)):
        raise ValueError(f"map_off outside file: 0x{map_off:x}")


def normalize(data: bytes) -> bytes:
    out = bytearray(data)
    validate_dex(out)
    sha1 = hashlib.sha1(bytes(out[0x20:])).digest()
    out[0x0C:0x20] = sha1
    checksum = zlib.adler32(bytes(out[0x0C:])) & 0xFFFFFFFF
    struct.pack_into("<I", out, 0x08, checksum)
    validate_dex(out)
    return bytes(out)


def default_output_path(path: Path) -> Path:
    return path.with_name(path.stem + ".normalized" + path.suffix)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dex", type=Path)
    parser.add_argument("-o", "--output", type=Path, help="output path; defaults to <name>.normalized.dex")
    parser.add_argument("--in-place", action="store_true", help="overwrite the input file")
    args = parser.parse_args()

    if args.output and args.in_place:
        raise SystemExit("--output and --in-place are mutually exclusive")

    output = args.dex if args.in_place else (args.output or default_output_path(args.dex))
    fixed = normalize(args.dex.read_bytes())
    output.write_bytes(fixed)
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
