# FLA angr Deflattening Template
# Requires: angr, Python 3.8+
# Purpose: Symbolic execution-based FLA restoration for non-standard/magic FLA

import angr
import claripy

def deflat_single_block(proj, block_addr, next_real_addrs, csel_info=None):
    """Process a single real block to find its successor via symbolic execution.

    Args:
        proj: angr Project
        block_addr: start address of the real block
        next_real_addrs: set of possible next real block addresses
        csel_info: dict {addr: (cond, true_reg, true_val, false_val)} for CSEL handling
    """
    state = proj.factory.blank_state(
        addr=block_addr,
        add_options={angr.options.CALLLESS, angr.options.ZERO_FILL_UNCONSTRAINED_MEMORY}
    )

    # If this block has a CSEL, fork the state to explore both branches
    if csel_info and block_addr in csel_info:
        cond, true_reg, true_val, false_val = csel_info[block_addr]
        results = {}
        for branch, val in [("true", true_val), ("false", false_val)]:
            forked = state.copy()
            reg = getattr(forked.regs, true_reg)
            forked.regs.write(true_reg, claripy.BVV(val, 64 if proj.arch.bits == 64 else 32))
            simgr = proj.factory.simulation_manager(forked)
            simgr.explore(find=list(next_real_addrs))
            if simgr.found:
                results[branch] = simgr.found[0].addr
        return results
    else:
        simgr = proj.factory.simulation_manager(state)
        simgr.explore(find=list(next_real_addrs))
        if simgr.found:
            return {"next": simgr.found[0].addr}
    return {}

def deflat_function(so_path, func_addr, real_block_addrs, dispatcher_addr):
    """Main entry: restore FLA for a function using angr.

    Args:
        so_path: path to the target SO file
        func_addr: start address of the obfuscated function
        real_block_addrs: list of real block start addresses (pre-identified)
        dispatcher_addr: address of the FLA dispatcher
    """
    proj = angr.Project(so_path, auto_load_libs=False)

    # Hook the dispatcher to prevent angr from exploring it
    @proj.hook(dispatcher_addr)
    def hook_dispatcher(state):
        # Skip dispatcher logic, let angr continue
        state.step()

    block_graph = {}  # block_addr -> {"true": addr, "false": addr} or {"next": addr}

    real_set = set(real_block_addrs)
    for block_addr in real_block_addrs:
        print(f"[angr] Processing block 0x{block_addr:X}...")
        result = deflat_single_block(proj, block_addr, real_set)
        if result:
            block_graph[block_addr] = result
            print(f"  -> {result}")
        else:
            print(f"  -> No successor found (may be return block)")

    return block_graph

# Usage:
# real_blocks = [0x1A2B0, 0x1A340, 0x1A410, ...]  # Pre-identified real blocks
# graph = deflat_function('libtarget.so', 0x19000, real_blocks, 0x19100)
# Then use block_graph to generate IDA patches
