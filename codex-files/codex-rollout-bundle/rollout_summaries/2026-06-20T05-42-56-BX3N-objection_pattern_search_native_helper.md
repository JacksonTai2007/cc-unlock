thread_id: 01905e7d-9ac0-7a71-b48f-cc0a319d3f81
updated_at: 2026-06-19T22:15:56+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\20\rollout-2026-06-20T05-42-56-01905e7d-9ac0-7a71-b48f-cc0a319d3f81.jsonl
cwd: \\?\C:\Workspace\mobile-re-lab

# Extended objection with a small pattern-search plugin for native memory, checked in as a reusable helper.

Rollout context: cwd was `C:\Workspace\mobile-re-lab`, Windows + PowerShell + Pixel test device. objection's built-in memory search was ASCII-only; the user wanted binary pattern search callable from the objection REPL.

## Task 1: objection plugin: `memory search-pattern <hex>` command

Outcome: success

Preference signals:
- The user wanted the plugin loaded from a `plugins/` dir so objection picks it up on start.
- Chinese narration; Python + Frida-JS identifiers in English.

Key steps:
- Followed objection's plugin API pattern (`objection_plugin`), registered `memory search-pattern` command.
- The Python side accepted a `hex` argument, forwarded to a small Frida-JS agent that iterates `Process.enumerateRanges({protection: 'r--', coalesce: true})` and calls `Memory.scanSync`.
- Returned hits (module base + offset) back to the objection REPL for display.

Failures and how to do differently:
- Initial JS agent scanned all ranges including guard pages — Frida threw. Filtered to `r--` and `rw-` only.
- Hex input with spaces vs. no-spaces was inconsistent; normalised on the Python side before sending.

Reusable knowledge:
- objection plugins are Python + optional Frida-JS agent — the API is short and stable.
- `Process.enumerateRanges` should be filtered to accessible pages before `Memory.scanSync`; scanning guard pages crashes.

References:
- [1] Plugin: `plugins/mem_search.py` + `plugins/mem_search.js`
- [2] objection version: 1.11.0
- [3] Test device: Android test device (personal)
