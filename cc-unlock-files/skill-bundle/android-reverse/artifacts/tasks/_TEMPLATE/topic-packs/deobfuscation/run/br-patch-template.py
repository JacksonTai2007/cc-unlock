# BR Indirect Branch Restoration Template
# Requires: IDA 8.0+ (IDAPython parts), Frida (trace parts)
# Purpose: Identify and patch BR obfuscation patterns (4 modes)

import idaapi
import ida_ua
import idc
import ida_bytes

# ============================================================
# Part 1: BR Pattern Identification (IDAPython)
# ============================================================

def scan_br_patterns(func_start):
    """Scan function for BR/BLR instructions and classify patterns.

    Returns list of {br_addr, mode, csel_addrs} dicts.
    """
    func = idaapi.get_func(func_start)
    if not func:
        return []

    results = []
    ea = func.start_ea
    while ea < func.end_ea:
        insn = ida_ua.insn_t()
        size = ida_ua.decode_insn(insn, ea)
        if size <= 0:
            ea += 1
            continue

        mnem = ida_ua.print_insn_mnem(ea)
        if mnem in ("BR", "BLR"):
            # Classify: look backwards for CSEL instructions
            csel_list = []
            cur = ea
            for _ in range(10):
                cur = idc.prev_head(cur)
                if cur == idc.BADADDR:
                    break
                cur_mnem = ida_ua.print_insn_mnem(cur)
                if cur_mnem == "CSEL":
                    cond_str = idc.GetDisasm(cur).split(",")[-1].strip()
                    csel_list.append({"addr": cur, "cond": cond_str})
                elif cur_mnem == "B" or cur_mnem == "BL":
                    break

            if len(csel_list) == 0:
                mode = "unconditional"
            elif len(csel_list) == 1:
                mode = "single_csel"
            else:
                mode = "multi_csel"

            results.append({
                "br_addr": ea,
                "br_mnem": mnem,
                "mode": mode,
                "csel_addrs": csel_list
            })

        ea += size
    return results

def generate_frida_trace_script(br_entries, so_name="libtarget.so"):
    """Generate a Frida script to trace BR/BLR targets at runtime.

    Args:
        br_entries: list from scan_br_patterns()
        so_name: name of the target SO
    Returns:
        Frida JavaScript source code string
    """
    script_lines = [
        f'// Auto-generated BR trace script for {so_name}',
        'var module = Process.findModuleByName("' + so_name + '");',
        'if (!module) { console.log("Module not found"); }',
        'var base = module.base;',
        '',
    ]

    for i, entry in enumerate(br_entries):
        addr = entry["br_addr"]
        mnem = entry["br_mnem"]
        script_lines.append(f'// {mnem} at 0x{addr:X} (mode: {entry["mode"]})')
        script_lines.append(f'Interceptor.attach(base.add(0x{addr:X}), {{')
        script_lines.append(f'  onEnter: function(args) {{')
        if mnem == "BR":
            script_lines.append(f'    var target = this.context.pc; // will be BR target')
            script_lines.append(f'    console.log("BR #{i} target=0x" + this.context.x' +
                              str(int(idc.print_operand(addr, 0)[1:])) + '.toString(16));')
        else:
            script_lines.append(f'    console.log("BLR #{i} from=0x" + this.returnAddress.toString(16));')
        script_lines.append(f'  }}')
        script_lines.append(f'}});')
        script_lines.append('')

    return '\n'.join(script_lines)

# ============================================================
# Part 2: Unidbg Dual-Emulator Pattern (Java, for reference)
# ============================================================
# The dual-emulator pattern is used for multi-CSEL BR restoration:
#
UNIDBG_DUAL_EMULATOR = """
// Main emulator: collect CSEL+BR pairs and register snapshots
emulator.attach().addBreakPoint(cselAddr, (emu, addr) -> {
    task.registersBeforeCsel = saveRegisters(emu);
    task.cselInfo = parseCsel(emu, addr);
    return true;  // continue
});

// Temporary emulator: restore snapshot -> force true/false -> execute to BR -> read target
long trueTarget = simulateBranch(tmpEmulator, task, true);
long falseTarget = simulateBranch(tmpEmulator, task, false);

// Generate patch: CSEL -> b.cond, BR -> b
String condPatch = String.format("b.%s #0x%x", info.condition, trueTarget - cselAddr);
String uncondPatch = String.format("b #0x%x", falseTarget - brAddr);
"""

# ============================================================
# Usage
# ============================================================
# patterns = scan_br_patterns(0x12345)
# for p in patterns:
#     print(f"0x{p['br_addr']:X}: {p['mode']} ({len(p['csel_addrs'])} CSELs)")
#
# frida_script = generate_frida_trace_script(patterns, "libnative.so")
# with open("br_trace.js", "w") as f:
#     f.write(frida_script)
# Then: frida -U -f com.target.app -l br_trace.js
