thread_id: 01901142-5d41-7151-bc3c-1f3011691980
updated_at: 2026-05-26T12:31:38+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\26\rollout-2026-05-26T19-46-38-01901142-5d41-7151-bc3c-1f3011691980.jsonl
cwd: \\?\C:\Workspace\binary-workbench

# Walked a Themida 3.x sample through anti-debug bypass, dumped with Scylla, rebuilt IAT, opened cleanly in IDA.

Rollout context: cwd was `C:\Workspace\binary-workbench`, Windows + x64dbg + ScyllaHide + Scylla + IDA. Target was a x64 PE from a public reverse-engineering challenge with Themida 3.x Ultra (no virtualization, only mutation + anti-debug + IAT redirection).

## Task 1: Themida 3.x manual unpack + IAT rebuild → clean IDB

Outcome: success

Preference signals:
- The user wanted the walk documented as a step list, not a video — future samples of the same protector share ~80% of the steps.
- Chinese narration; tool names / hotkeys in English.
- Prefer x64dbg over WinDbg for this stage; Scylla for the dump.

Key steps:
- Loaded target in x64dbg with ScyllaHide's "PhantOm x64" profile enabled (covers `NtQueryInformationProcess`, `NtSetInformationThread`, `IsDebuggerPresent`, timing checks).
- Set memory breakpoint on execute for `.themida` section boundary; ran; broke at OEP after the last section transition.
- With x64dbg paused at OEP, launched Scylla, `Attach → Pick DLL → Auto Search → Get Imports`, then `Fix Dump` against the raw dumped PE.
- Opened the fixed dump in IDA — analysis completed without the usual mass "unresolved import" red; function count came out to ~2100 (vs the unpacked reference).
- Diffed a spot function against the disclosed reference to sanity-check the dump.

Failures and how to do differently:
- Scylla's initial "Get Imports" produced 200+ invalid entries because it snagged the mutated IAT stubs. Solved by walking sections, restricting the import scan to the `.text` VA range only.
- IDA's auto-analysis stalled on a `jmp` into what was still a Themida stub because I dumped one instruction too early; re-broke, re-dumped.

Reusable knowledge:
- Themida 3.x Ultra without virtualization: reachable via memory-breakpoint on section boundary at OEP, then Scylla dump + IAT rebuild. Add virtualization and the flow changes entirely.
- ScyllaHide's "PhantOm x64" profile covers most 3.x anti-debug; if the sample uses a custom check, use x64dbg's ScyllaHide `Debug → Options` to add per-API hooks.
- Restrict Scylla's IAT scan to `.text` VA range on Themida dumps; the mutated stubs elsewhere produce many false positives.

References:
- [1] Tools: x64dbg + ScyllaHide 2024.03, Scylla x64 v0.9.8, IDA Pro 8.4
- [2] Dumped binary: `chall_dumped.exe`
- [3] Reference: `chall_ref.exe` (unpacked baseline provided with the challenge)
