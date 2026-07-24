thread_id: 01905194-bd06-7576-9bea-4c87bb9b7744
updated_at: 2026-06-15T00:09:13+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\15\rollout-2026-06-15T07-59-13-01905194-bd06-7576-9bea-4c87bb9b7744.jsonl
cwd: \\?\C:\Workspace\re-lab

# Reversed a .NET NativeAOT binary by pairing ILSpy metadata with an IDA native pass, produced a readable hybrid view.

Rollout context: cwd was `C:\Workspace\re-lab`, Windows + ILSpy + IDA. Target was a Windows x64 NativeAOT publish of a small tool from a public RE tutorial.

## Task 1: NativeAOT metadata → IDA symbol pass → hybrid IL/native view

Outcome: success

Preference signals:
- The user wanted both the IL-level view (ILSpy) and the native view (IDA) side-by-side; not a "just decompile IL" pass.
- Chinese narration; identifiers in English.

Key steps:
- Loaded the binary in ILSpy — NativeAOT still ships a stripped-down metadata blob that ILSpy can read, giving class + method names.
- Extracted method-name → RVA mapping from the ILSpy inspection panel (via a small ILSpy plugin script).
- Fed the mapping into IDA to rename native functions.
- Cross-checked five renames against decompiled IL — matched.

Failures and how to do differently:
- Some generic instantiations produced multiple RVAs for the "same" method name; disambiguated by appending the type-argument hash.
- ILSpy 8.4 initially refused to open NativeAOT because it detected "no CLR header"; enabled the "single-file / AOT" mode in Settings.

Reusable knowledge:
- NativeAOT keeps enough metadata for ILSpy to name types and methods; combine with IDA for the native side. Neither is sufficient alone.
- Enable ILSpy's "single-file / AOT" mode before loading NativeAOT publishes — the default mode assumes classic CLR PE.

References:
- [1] ILSpy version: 8.4
- [2] Mapping script: `tools/aot_symbol_dump.ilspyscript`
- [3] Sample source: NativeAOT tutorial by the .NET team (public)
