#!/usr/bin/env python3
"""Inspect ELF PT_DYNAMIC, init_array, and relocation evidence.

This helper is intentionally narrow: it summarizes loader-relevant ELF facts for
shell analysis. It does not infer that an init_array entry is the decryptor.
"""

from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path


PT_LOAD = 1
PT_DYNAMIC = 2

DT_NULL = 0
DT_RELA = 7
DT_RELASZ = 8
DT_REL = 17
DT_RELSZ = 18
DT_INIT_ARRAY = 25
DT_INIT_ARRAYSZ = 27

AARCH64_RELOC_TYPES = {
    0x401: "R_AARCH64_GLOB_DAT",
    0x403: "R_AARCH64_RELATIVE",
}


def unpack(fmt: str, data: bytes, offset: int):
    return struct.unpack_from(fmt, data, offset)


def checked_slice(data: bytes, offset: int, size: int, what: str) -> bytes:
    if offset < 0 or size < 0 or offset + size > len(data):
        raise ValueError(f"{what} is outside file bounds: offset=0x{offset:x} size=0x{size:x}")
    return data[offset : offset + size]


def parse_elf_header(data: bytes) -> dict:
    if len(data) < 0x34 or data[:4] != b"\x7fELF":
        raise ValueError("not an ELF file")

    elf_class = data[4]
    endian_tag = data[5]
    if elf_class not in (1, 2):
        raise ValueError(f"unsupported EI_CLASS: {elf_class}")
    if endian_tag not in (1, 2):
        raise ValueError(f"unsupported EI_DATA: {endian_tag}")

    endian = "<" if endian_tag == 1 else ">"
    if elf_class == 1:
        fields = unpack(endian + "HHIIIIIHHHHHH", data, 0x10)
        return {
            "class": "ELF32",
            "endian": "little" if endian == "<" else "big",
            "endian_prefix": endian,
            "e_type": fields[0],
            "e_machine": fields[1],
            "e_entry": fields[3],
            "e_phoff": fields[4],
            "e_shoff": fields[5],
            "e_ehsize": fields[7],
            "e_phentsize": fields[8],
            "e_phnum": fields[9],
            "ptr_size": 4,
        }

    fields = unpack(endian + "HHIQQQIHHHHHH", data, 0x10)
    return {
        "class": "ELF64",
        "endian": "little" if endian == "<" else "big",
        "endian_prefix": endian,
        "e_type": fields[0],
        "e_machine": fields[1],
        "e_entry": fields[3],
        "e_phoff": fields[4],
        "e_shoff": fields[5],
        "e_ehsize": fields[7],
        "e_phentsize": fields[8],
        "e_phnum": fields[9],
        "ptr_size": 8,
    }


def parse_program_headers(data: bytes, header: dict) -> list[dict]:
    phoff = header["e_phoff"]
    entsize = header["e_phentsize"]
    phnum = header["e_phnum"]
    endian = header["endian_prefix"]
    is_64 = header["class"] == "ELF64"
    headers = []

    for index in range(phnum):
        offset = phoff + index * entsize
        checked_slice(data, offset, entsize, f"program header {index}")
        if is_64:
            p_type, p_flags, p_offset, p_vaddr, _p_paddr, p_filesz, p_memsz, p_align = unpack(
                endian + "IIQQQQQQ", data, offset
            )
        else:
            p_type, p_offset, p_vaddr, _p_paddr, p_filesz, p_memsz, p_flags, p_align = unpack(
                endian + "IIIIIIII", data, offset
            )
        headers.append(
            {
                "index": index,
                "type": p_type,
                "offset": p_offset,
                "vaddr": p_vaddr,
                "filesz": p_filesz,
                "memsz": p_memsz,
                "flags": p_flags,
                "align": p_align,
            }
        )
    return headers


def va_to_offset(vaddr: int, phdrs: list[dict]) -> int | None:
    for ph in phdrs:
        if ph["type"] != PT_LOAD:
            continue
        start = ph["vaddr"]
        end = start + ph["filesz"]
        if start <= vaddr < end:
            return ph["offset"] + (vaddr - start)
    return None


def parse_dynamic(data: bytes, header: dict, phdrs: list[dict]) -> dict:
    dyn = next((ph for ph in phdrs if ph["type"] == PT_DYNAMIC), None)
    if not dyn:
        return {"entries": {}, "source": None}

    endian = header["endian_prefix"]
    is_64 = header["class"] == "ELF64"
    entry_size = 16 if is_64 else 8
    fmt = endian + ("qQ" if is_64 else "iI")
    entries: dict[str, int] = {}
    count = dyn["filesz"] // entry_size

    for index in range(count):
        offset = dyn["offset"] + index * entry_size
        checked_slice(data, offset, entry_size, f"dynamic entry {index}")
        tag, value = unpack(fmt, data, offset)
        if tag == DT_NULL:
            break
        entries[str(tag)] = value

    return {
        "source": {
            "offset": dyn["offset"],
            "vaddr": dyn["vaddr"],
            "filesz": dyn["filesz"],
        },
        "entries": entries,
    }


def read_init_array(data: bytes, header: dict, phdrs: list[dict], entries: dict[str, int]) -> dict:
    addr = entries.get(str(DT_INIT_ARRAY))
    size = entries.get(str(DT_INIT_ARRAYSZ), 0)
    if not addr or not size:
        return {"address": addr, "size": size, "entries": []}
    file_offset = va_to_offset(addr, phdrs)
    if file_offset is None:
        return {"address": addr, "size": size, "fileOffset": None, "entries": []}

    ptr_size = header["ptr_size"]
    endian = header["endian_prefix"]
    fmt = endian + ("Q" if ptr_size == 8 else "I")
    result = []
    for index in range(size // ptr_size):
        entry_offset = file_offset + index * ptr_size
        checked_slice(data, entry_offset, ptr_size, f"init_array entry {index}")
        result.append({"index": index, "value": unpack(fmt, data, entry_offset)[0]})

    return {"address": addr, "size": size, "fileOffset": file_offset, "entries": result}


def parse_relocations(data: bytes, header: dict, phdrs: list[dict], entries: dict[str, int], init_addr: int | None) -> dict:
    endian = header["endian_prefix"]
    is_64 = header["class"] == "ELF64"
    relocs = []

    def collect(kind: str, tag_addr: int, tag_size: int, entry_size: int, fmt: str):
        addr = entries.get(str(tag_addr))
        size = entries.get(str(tag_size), 0)
        if not addr or not size:
            return {"address": addr, "size": size, "entries": []}
        file_offset = va_to_offset(addr, phdrs)
        if file_offset is None:
            return {"address": addr, "size": size, "fileOffset": None, "entries": []}
        touched = []
        for index in range(size // entry_size):
            offset = file_offset + index * entry_size
            checked_slice(data, offset, entry_size, f"{kind} relocation {index}")
            values = unpack(fmt, data, offset)
            r_offset = values[0]
            r_info = values[1]
            r_addend = values[2] if len(values) > 2 else None
            r_type = (r_info & 0xFFFFFFFF) if is_64 else (r_info & 0xFF)
            item = {
                "index": index,
                "offset": r_offset,
                "type": r_type,
                "typeName": AARCH64_RELOC_TYPES.get(r_type, hex(r_type)),
            }
            if r_addend is not None:
                item["addend"] = r_addend
            if init_addr is not None and init_addr <= r_offset < init_addr + 0x1000:
                touched.append(item)
        return {"address": addr, "size": size, "fileOffset": file_offset, "entriesTouchingInitArrayPage": touched}

    if is_64:
        relocs.append(("rela", collect("rela", DT_RELA, DT_RELASZ, 24, endian + "QQq")))
        relocs.append(("rel", collect("rel", DT_REL, DT_RELSZ, 16, endian + "QQ")))
    else:
        relocs.append(("rela", collect("rela", DT_RELA, DT_RELASZ, 12, endian + "IIi")))
        relocs.append(("rel", collect("rel", DT_REL, DT_RELSZ, 8, endian + "II")))

    return {name: value for name, value in relocs}


def inspect(path: Path) -> dict:
    data = path.read_bytes()
    header = parse_elf_header(data)
    phdrs = parse_program_headers(data, header)
    dynamic = parse_dynamic(data, header, phdrs)
    entries = dynamic["entries"]
    init_array = read_init_array(data, header, phdrs, entries)
    relocations = parse_relocations(data, header, phdrs, entries, init_array.get("address"))

    return {
        "path": str(path),
        "size": len(data),
        "elf": {k: v for k, v in header.items() if k != "endian_prefix"},
        "programHeaders": phdrs,
        "dynamic": dynamic,
        "initArray": init_array,
        "relocations": relocations,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("elf", type=Path)
    args = parser.parse_args()
    print(json.dumps(inspect(args.elf), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
