# FLA State Machine Restoration Template (IDAPython)
# Requires: IDA 8.0+, ARM64 target
# Purpose: Restore control flow from standard FLA obfuscation

import idaapi
import ida_ua
import idc
import ida_bytes
import ida_funcs

def find_dispatcher_ea(func_start):
    """Find the dispatcher address: most-referenced B target in function."""
    func = idaapi.get_func(func_start)
    if not func:
        return None
    counts = {}
    ea = func.start_ea
    while ea < func.end_ea:
        insn = ida_ua.insn_t()
        size = ida_ua.decode_insn(insn, ea)
        if size > 0:
            mnem = ida_ua.print_insn_mnem(ea)
            if mnem == "B":
                target = idc.get_operand_value(ea, 0)
                if target != idc.BADADDR and func.start_ea <= target < func.end_ea:
                    counts[target] = counts.get(target, 0) + 1
            ea += size
        else:
            ea += 1
    if not counts:
        return None
    return max(counts.items(), key=lambda x: x[1])[0]

def find_state_register(dispatcher_ea):
    """Find the state register from CMP instruction before dispatcher."""
    ea = dispatcher_ea
    for _ in range(20):
        ea = idc.prev_head(ea)
        mnem = ida_ua.print_insn_mnem(ea)
        if mnem == "CMP":
            return idc.print_operand(ea, 0)  # e.g. "W8"
    return None

def find_prev_mov_imm(ea, reg_name):
    """Trace backwards from ea to reconstruct a MOV+MOVK 32-bit constant.
    Returns the reconstructed value (bitwise OR, NOT addition)."""
    val = 0
    cur = ea
    for _ in range(10):
        cur = idc.prev_head(cur)
        if cur == idc.BADADDR:
            break
        disasm = idc.GetDisasm(cur)
        mnem = ida_ua.print_insn_mnem(cur)
        if mnem == "MOVK" and reg_name in disasm:
            high = idc.get_operand_value(cur, 1)
            val = (high << 16) | (val & 0xFFFF)
        elif mnem == "MOV" and reg_name in disasm:
            val = idc.get_operand_value(cur, 1)
            break
    return val

def extract_block_info(func_start, dispatcher_ea, state_reg):
    """Extract cur_state and next_state mappings for all blocks."""
    func = idaapi.get_func(func_start)
    cur_state_map = {}   # state_value -> block_start_ea
    next_state_list = [] # {block_ea, next_state} or {block_ea, true_state, false_state}

    ea = func.start_ea
    while ea < func.end_ea:
        insn = ida_ua.insn_t()
        size = ida_ua.decode_insn(insn, ea)
        if size <= 0:
            ea += 1
            continue

        mnem = ida_ua.print_insn_mnem(ea)

        # Detect cur_state: CMP state_reg, #imm; B.NE dispatcher
        if mnem == "CMP":
            op0 = idc.print_operand(ea, 0)
            if op0 == state_reg:
                state_val = idc.get_operand_value(ea, 1)
                next_ea = ea + size
                next_mnem = ida_ua.print_insn_mnem(next_ea)
                if next_mnem == "B.NE" or next_mnem == "B.EQ":
                    target = idc.get_operand_value(next_ea, 0)
                    if target == dispatcher_ea:
                        # This is a cur_state block; find block start
                        block_start = idc.prev_head(ea)
                        while block_start != idc.BADADDR:
                            prev_mnem = ida_ua.print_insn_mnem(block_start)
                            if prev_mnem == "B" and idc.get_operand_value(block_start, 0) == dispatcher_ea:
                                break
                            block_start = idc.prev_head(block_start)
                        if block_start != idc.BADADDR:
                            cur_state_map[state_val] = block_start

        # Detect next_state: MOV+MOVK followed by B dispatcher
        if mnem == "B" and idc.get_operand_value(ea, 0) == dispatcher_ea:
            # Check if CSEL before this B
            prev_ea = idc.prev_head(ea)
            prev_mnem = ida_ua.print_insn_mnem(prev_ea)
            if prev_mnem == "CSEL":
                # Conditional: two successors
                true_val = find_prev_mov_imm(prev_ea, idc.print_operand(prev_ea, 1))
                false_val = find_prev_mov_imm(prev_ea, idc.print_operand(prev_ea, 2))
                block_end = prev_ea
                next_state_list.append({
                    "block_ea": block_end,
                    "true_state": true_val,
                    "false_state": false_val
                })
            elif prev_mnem in ("MOV", "MOVK"):
                # Direct assignment: single successor
                val = find_prev_mov_imm(ea, state_reg)
                next_state_list.append({
                    "block_ea": idc.prev_head(prev_ea),
                    "next_state": val
                })

        ea += size
    return cur_state_map, next_state_list

def patch_b(src_ea, target_ea):
    """Patch instruction at src_ea to B target_ea."""
    # Use IDA assembler or keystone for actual patching
    # Placeholder: use ida_bytes for direct encoding
    offset = target_ea - src_ea
    insn_val = (offset >> 2) & 0x3FFFFFF
    insn_val |= 0x14000000  # B opcode
    ida_bytes.patch_dword(src_ea, insn_val)

def unflatten(func_start):
    """Main entry: restore FLA control flow for given function."""
    dispatcher = find_dispatcher_ea(func_start)
    if not dispatcher:
        print(f"[FLA] No dispatcher found in 0x{func_start:X}")
        return False

    state_reg = find_state_register(dispatcher)
    if not state_reg:
        print(f"[FLA] No state register found")
        return False

    print(f"[FLA] dispatcher=0x{dispatcher:X}, state_reg={state_reg}")

    cur_state_map, next_state_list = extract_block_info(func_start, dispatcher, state_reg)
    print(f"[FLA] Found {len(cur_state_map)} cur_state entries, {len(next_state_list)} next_state entries")

    for item in next_state_list:
        block_ea = item["block_ea"]
        if "next_state" in item:
            target = cur_state_map.get(item["next_state"])
            if target:
                patch_b(block_ea, target)
        else:
            # Conditional branch - would need B.cond patching
            true_target = cur_state_map.get(item["true_state"])
            false_target = cur_state_map.get(item["false_state"])
            if true_target and false_target:
                print(f"[FLA] Conditional at 0x{block_ea:X}: true=0x{true_target:X}, false=0x{false_target:X}")

    print("[FLA] Patching complete. Press F5 to refresh decompilation.")
    return True

# Usage:
# unflatten(0x12345)  # Pass the start address of the FLA-obfuscated function
