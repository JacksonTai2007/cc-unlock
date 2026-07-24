thread_id: 019022f4-88a6-7099-bb22-6824ac4ab2e4
updated_at: 2026-05-28T11:46:13+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\28\rollout-2026-05-28T19-06-13-019022f4-88a6-7099-bb22-6824ac4ab2e4.jsonl
cwd: \\?\C:\Workspace\re-lab

# Recovered function names from a stripped Go 1.22 ELF by parsing `.gopclntab` directly, wrote an IDA helper that renames all funcs in one pass.

Rollout context: cwd was `C:\Workspace\re-lab`, Windows + IDA Pro 8.4. Target was a Linux x86_64 Go 1.22 binary, stripped. Existing IDAGolangHelper plugin worked partially; wanted a from-scratch understanding for future bumps.

## Task 1: `.gopclntab` parser + IDA rename pass for a Go 1.22 binary

Outcome: success

Preference signals:
- The user wanted a from-scratch parser as a learning exercise even though IDAGolangHelper exists.
- Emit results as an IDC script the user can re-run without re-parsing, so slow parses run once.
- Chinese narration; Python identifiers in English.

Key steps:
- Located `.gopclntab` via its magic (Go 1.22 uses 0xFFFFFFF1 header magic; earlier Go versions differ) — verified with IDA's `find_bytes`.
- Parsed the header to extract `nfunc`, `funcnameOffset`, `funcdataOffset`; walked the `pctab` per function to get name string offsets.
- Emitted `set_name(pc_start, name)` calls into `rename_pass.idc`.
- Ran the IDC in a fresh IDB — from ~0 named functions to 5,214.
- Sanity-checked five random renames against `go tool objdump -s` on a Linux box; matched.

Failures and how to do differently:
- First pass assumed Go 1.20 layout (`funcnameOffset` was in a different table) — parser silently produced empty names. Added a version probe via the header magic.
- IDA's `set_name` returned `False` on ~40 addresses that had already been named as `sub_XXX`; wrapped in a `del_items` + `set_name` idempotent helper.

Reusable knowledge:
- Go 1.22's `.gopclntab` header magic is 0xFFFFFFF1; 1.20 was 0xFFFFFFFA; 1.18 was 0xFFFFFFF0. Always probe the magic before parsing.
- IDAGolangHelper is fine and battle-tested; writing your own parser is only worth it if you need Go-version-agnostic tooling or a headless CI pass.
- IDC scripts are the right output format for "many named renames" — they re-run in a fresh IDB in seconds vs re-parsing minutes.

References:
- [1] Parser: `tools/gopclntab_parse.py`
- [2] Rename script: `rename_pass.idc`
- [3] Go version: 1.22 (as decoded from the .gopclntab header)
