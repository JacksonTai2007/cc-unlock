# BCF .bss Patch Template
# Requires: IDA 8.0+
# Purpose: Remove Bogus Control Flow by patching .bss opaque predicates

import ida_segment
import ida_bytes
import idc
import ida_xref

def patch_bss_segment(value=2, make_readonly=True):
    """Patch all .bss dwords to a fixed value and optionally set segment readonly.

    Principle: BCF opaque predicates depend on .bss global variables x, y
    (e.g., y >= 10 && ((x-1)*x & 1) != 0 is always false).
    Setting them to a fixed constant (2) and making .bss readonly causes
    IDA's constant propagation to eliminate the false branches automatically.

    Args:
        value: the constant to write to each dword (default: 2)
        make_readonly: whether to set the segment as readonly
    """
    seg = ida_segment.get_segm_by_name(".bss")
    if not seg:
        print("[BCF] .bss segment not found")
        return False

    # Patch all dwords
    ea = seg.start_ea
    count = 0
    while ea < seg.end_ea:
        ida_bytes.patch_dword(ea, value)
        ea += 4
        count += 1

    # Set segment readonly
    if make_readonly:
        seg.perm = 0b100  # readonly
        ida_segment.update_segm(seg)

    # Rebuild data items so IDA re-analyzes
    ea = seg.start_ea
    while ea < seg.end_ea:
        idc.del_items(ea)
        ida_bytes.create_dword(ea, 4, True)
        ea += 4

    print(f"[BCF] Patched {count} dwords in .bss to {value}, readonly={make_readonly}")
    print("[BCF] Press F5 to refresh decompilation")
    return True

def patch_x86_bcf_xrefs(bss_var_ea):
    """Patch x86 instructions referencing a .bss variable.

    Replaces `mov reg, [mem]` (0x8B prefix) with `mov reg, 0` (0xB8+reg).
    NOTE: This only works for x86/x86_64 targets. For ARM, use patch_bss_segment() instead.

    Args:
        bss_var_ea: address of the .bss variable to patch references to
    """
    xref = ida_xref.get_first_dref_to(bss_var_ea)
    count = 0
    while xref != idc.BADADDR:
        byte0 = idc.get_wide_byte(xref)
        byte1 = idc.get_wide_byte(xref + 1)
        if byte0 == 0x8B:
            # Extract register from ModR/M byte [7:5]
            reg_code = (byte1 & 0b00111000) >> 3
            # Replace with mov reg, 0
            ida_bytes.patch_byte(xref, 0xB8 + reg_code)
            ida_bytes.patch_byte(xref + 1, 0x00)
            ida_bytes.patch_byte(xref + 2, 0x00)
            ida_bytes.patch_byte(xref + 3, 0x00)
            ida_bytes.patch_byte(xref + 4, 0x00)
            count += 1
        xref = ida_xref.get_next_dref_to(bss_var_ea, xref)

    print(f"[BCF] Patched {count} x86 references to .bss var at 0x{bss_var_ea:X}")
    return count

# Usage:
# patch_bss_segment(value=2, make_readonly=True)
# For x86 targets with specific .bss variables:
# patch_x86_bcf_xrefs(0x12345)  # address of the .bss variable
