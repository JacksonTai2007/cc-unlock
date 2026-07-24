thread_id: 01901a47-81b3-772d-a363-889ac6f8d055
updated_at: 2026-06-01T21:44:48+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\02\rollout-2026-06-02T05-30-48-01901a47-81b3-772d-a363-889ac6f8d055.jsonl
cwd: \\?\C:\Workspace\binary-workbench

# Recovered a VMProtect 3.x handler table for a CTF study binary and lifted the vip-stream of one hot function into readable C.

Rollout context: cwd was `C:\Workspace\binary-workbench`, Windows + PowerShell. Target was a x64 PE from a public CTF challenge with VMP 3.5 mutation + virtualization on the licensing routine only; the surrounding code was untouched, which made anchoring easy.

## Task 1: Rebuild the handler table and lift one virtualized function

Outcome: success

Preference signals:
- The user wanted the lifter output shaped as C, not IR, so the recovered algorithm could be diffed against the pre-VMP reference published with the challenge.
- Chinese-preferred narration, with instruction mnemonics and register names kept in English.
- The user explicitly asked for the extraction script to be independent of any specific VMP version — parametric over "vip stride" and "context register".

Key steps:
- Located the vm-entry stub by fingerprinting the `push imm32; call rel32; ...; jmp` intro; walked forward to the first indirect branch through a base+index dispatch.
- Extracted the handler table by following the base register back to a `lea` against `rip`; validated by counting handlers (came out to 118, matches VMP 3.5 typical).
- For each handler, ran a short Triton symbolic session initialised with a symbolic vip and context state, and canonicalised the resulting expression tree.
- Emitted a `handler_id -> semantics` map, then translated the target function's vip-stream by replaying the map.
- Hand-cleaned the resulting C: folded compare-then-conditional-jmp pairs, promoted repeated locals to named variables, removed the deliberate opaque predicates.

Failures and how to do differently:
- Initial handler enumeration missed 6 handlers because they were reached only through a secondary dispatch inside a "polymorphic" handler. Added a second pass that re-seeded exploration from any indirect branch inside a handler.
- The lifter's C output at first used uint64_t for every local; readability improved a lot after promoting known-boolean locals to bool based on downstream use.

Reusable knowledge:
- VMP 3.5's handler count is a good sanity gauge — a full table with mutation off is close to 110-120 handlers; substantially fewer usually means the enumerator missed a dispatch branch.
- Triton is fine as a semantics extractor for individual handlers even if it is too heavy for whole-program symbolic execution.
- Keep the lifter's post-processing (constant folding, boolean promotion) in a separate pass so lifter output stays diff-friendly across binary versions.

References:
- [1] Script: `tools/vmp_lifter.py` (uses Triton 1.0.1)
- [2] Handler map dump: `out/handlers_3.5.json`
- [3] Lifted C: `out/license_check.c`
