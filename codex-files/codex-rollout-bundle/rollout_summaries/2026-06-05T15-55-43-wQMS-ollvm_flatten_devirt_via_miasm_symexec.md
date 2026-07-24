thread_id: 01901543-abab-7989-b8d8-23a7287fc05c
updated_at: 2026-06-05T08:36:43+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\05\rollout-2026-06-05T15-55-43-01901543-abab-7989-b8d8-23a7287fc05c.jsonl
cwd: \\?\C:\Workspace\re-lab

# Reversed control-flow flattening on an OLLVM-protected function using miasm symbolic exploration, produced a clean CFG.

Rollout context: cwd was `C:\Workspace\re-lab`, Windows + PowerShell. Target was a Linux x86_64 ELF from a public reverse-engineering challenge; only the license-checking function was flattened. The user wanted the reconstructed CFG in a form loadable by IDA (a .py script that adds edges).

## Task 1: Rebuild a readable CFG from an OLLVM-flattened function

Outcome: success

Preference signals:
- The user asked for the tool to run headless with no IDA-side interaction until the last step, so the pass could run on a CI box that had no IDA GUI.
- Preferred script layout: one file, arguments via argparse, all miasm imports gated behind a lazy import so `--help` stays snappy.
- Chinese-preferred discussion; source code with English identifiers.

Key steps:
- Identified the dispatcher block by the classic pattern of "load state_var -> compare against several immediate constants -> jmp to next block". Anchored on the `cmp eax, 0x...; je 0x...` sequence around the top of the flattened region.
- Enumerated all "real" basic blocks by walking backwards from every jump into the dispatcher and collecting the block reached before the assignment to the state variable.
- Ran miasm sandbox in symbolic mode seeded with each real block's entry state; when the exit state included a new state-var value, mapped `entry_block -> next_state_var` and thus `entry_block -> target_block`.
- Emitted an IDA Python script that added the reconstructed edges and colored dispatcher blocks so they were visually collapsed away from the interesting flow.

Failures and how to do differently:
- First run confused two blocks that had identical state-var updates for different predecessors (a merge). Fixed by carrying the predecessor identity into miasm's initial state so the exit distinguishes them.
- The symbolic exploration timed out on one block because a `movsx` on a symbolic byte blew up the constraint tree; solved by capping symbolic byte ranges to the 0..127 seen in the actual state-var table.

Reusable knowledge:
- OLLVM flatten's dispatcher assigns the state variable through one of a small set of instructions immediately before jumping; anchoring on that pair is more robust than pattern-matching the dispatcher body.
- When two real blocks share the same successor state, treat the predecessor as part of the state so miasm can distinguish them.
- Emitting IDA edges via `idc.add_cref(..., XREF_USER)` avoids fighting the auto-analysis when reloading the IDB.

References:
- [1] Script: `tools/ollvm_deflatten.py`
- [2] IDA edge script: `out/edges_license_check.py`
- [3] miasm reference: `miasm/analysis/sandbox.py`
