# FLA Unicorn Trace Template
# Requires: Unicorn 2.0+, Capstone 4.0+, Python 3.8+
# Purpose: CPU emulation-based FLA restoration when static extraction fails

from unicorn import *
from unicorn.arm64_const import *
from capstone import *
import struct

# NZCV manipulation (PSTATE bits [31:28]: N=31, Z=30, C=29, V=28)
COND_NZCV = {
    "EQ": (0x40000000, 0x00000000),  # Z=1 / Z=0
    "NE": (0x00000000, 0x40000000),
    "GT": (0x00000000, 0x40000000),  # Z=0,N=V / Z=1
    "GE": (0x00000000, 0x80000000),  # N=V / N!=V
    "LT": (0x80000000, 0x00000000),  # N!=V / N=V
    "LE": (0x40000000, 0x00000000),  # Z=1||N!=V / Z=0,N=V
}

def set_nzcv(uc, value):
    """Set NZCV bits in PSTATE using Unicorn 2 NZCV register."""
    uc.reg_write(UC_ARM64_REG_NZCV, value)

def get_nzcv(uc):
    """Read NZCV bits from PSTATE."""
    return uc.reg_read(UC_ARM64_REG_NZCV)

def trace_function(binary_data, code_base, func_addr, func_end,
                   csel_addrs=None, real_block_ends=None,
                   stack_base=0x7F000000, stack_size=0x100000):
    """Trace FLA-obfuscated function execution, recording block transitions.

    Args:
        binary_data: raw bytes of the code segment
        code_base: base address where code is mapped
        func_addr: start address of the function
        func_end: end address (first RET or known boundary)
        csel_addrs: dict {addr: condition_string} for CSEL instructions
        real_block_ends: set of addresses marking real block endings
        stack_base: base address for stack memory
        stack_size: size of stack region
    Returns:
        trace: list of (address, nzcv) tuples at real block boundaries
    """
    cs = Cs(CS_ARCH_ARM64, CS_MODE_LITTLE_ENDIAN)
    uc = Uc(UC_ARCH_ARM64, UC_MODE_LITTLE_ENDIAN)

    uc.mem_map(code_base, len(binary_data) + 0x10000)
    uc.mem_write(code_base, binary_data)
    uc.mem_map(stack_base, stack_size)
    uc.reg_write(UC_ARM64_REG_SP, stack_base + stack_size // 2)

    if csel_addrs is None:
        csel_addrs = {}
    if real_block_ends is None:
        real_block_ends = set()

    trace = []

    def hook_code(uc_inst, address, size, user_data):
        code_bytes = uc_inst.mem_read(address, size)
        insns = list(cs.disasm(bytes(code_bytes), address))
        if not insns:
            return
        mnem = insns[0].mnemonic

        # Skip function calls
        if mnem in ('bl', 'blr'):
            uc_inst.reg_write(UC_ARM64_REG_PC, address + size)
            return

        # Stop on return
        if mnem == 'ret':
            uc_inst.emu_stop()
            return

        # Record at real block boundaries
        if address in real_block_ends:
            nzcv = get_nzcv(uc_inst)
            trace.append((address, nzcv))

    uc.hook_add(UC_HOOK_CODE, hook_code)

    try:
        uc.emu_start(func_addr, func_end, timeout=0, count=1000000)
    except UcError as e:
        print(f"[Unicorn] Emulation stopped: {e}")

    return trace

def trace_with_csel_fork(binary_data, code_base, func_addr, func_end,
                          csel_addr, cond, true_val, false_val,
                          target_reg=UC_ARM64_REG_W8,
                          **kwargs):
    """Trace function, forking at a CSEL to explore both branches.

    Returns (true_trace, false_trace).
    """
    def do_trace(force_val):
        cs = Cs(CS_ARCH_ARM64, CS_MODE_LITTLE_ENDIAN)
        uc = Uc(UC_ARCH_ARM64, UC_MODE_LITTLE_ENDIAN)

        code_size = len(binary_data) + 0x10000
        stack_base = kwargs.get('stack_base', 0x7F000000)
        stack_size = kwargs.get('stack_size', 0x100000)

        uc.mem_map(code_base, code_size)
        uc.mem_write(code_base, binary_data)
        uc.mem_map(stack_base, stack_size)
        uc.reg_write(UC_ARM64_REG_SP, stack_base + stack_size // 2)

        trace = []
        def hook(uc_inst, address, size, user_data):
            if address == csel_addr:
                set_nzcv(uc_inst, force_val)
            code_bytes = uc_inst.mem_read(address, size)
            insns = list(cs.disasm(bytes(code_bytes), address))
            if insns and insns[0].mnemonic == 'ret':
                uc_inst.emu_stop()
                return
            if insns and insns[0].mnemonic in ('bl', 'blr'):
                uc_inst.reg_write(UC_ARM64_REG_PC, address + size)
                return
            trace.append(address)

        uc.hook_add(UC_HOOK_CODE, hook)
        try:
            uc.emu_start(func_addr, func_end, timeout=0, count=500000)
        except UcError:
            pass
        return trace

    force_true, force_false = COND_NZCV[cond]
    true_trace = do_trace(force_true)
    false_trace = do_trace(force_false)
    return true_trace, false_trace

# Usage:
# with open('libtarget.so', 'rb') as f:
#     data = f.read()
# trace = trace_function(data, 0x0, 0x19000, 0x1A000)
# Or for CSEL forking:
# tt, ft = trace_with_csel_fork(data, 0x0, 0x19000, 0x1A000,
#                                csel_addr=0x191A0, cond="EQ",
#                                true_val=0x40000000, false_val=0x0)
