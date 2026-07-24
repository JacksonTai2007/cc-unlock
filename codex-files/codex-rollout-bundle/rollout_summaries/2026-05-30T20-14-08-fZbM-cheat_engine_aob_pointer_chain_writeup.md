thread_id: 019034a2-c7de-7cf1-a5b7-e5a4f83c3e4b
updated_at: 2026-05-30T12:52:08+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\30\rollout-2026-05-30T20-14-08-019034a2-c7de-7cf1-a5b7-e5a4f83c3e4b.jsonl
cwd: \\?\C:\Workspace\game-re-notes

# Wrote a Cheat Engine table with AOB scan + 3-level pointer chain that resolves a stable in-game value across restarts.

Rollout context: cwd was `C:\Workspace\game-re-notes`, Windows + Cheat Engine 7.5. Target was the user's own Steam copy of a single-player game (offline mode).

## Task 1: AOB signature + pointer-chain that survives game restart

Outcome: success

Preference signals:
- The user wanted a `.CT` table that others in the same study group can load and re-run without further scanning.
- Chinese narration; CE AA / Lua identifiers in English.

Key steps:
- Value-scanned in CE to find the transient address, then "Find what accesses this address" to find the accessor instruction.
- Read the base register + offset chain; walked pointer-chain backwards until landing at a static in-module offset (`game.exe+0x1D3A400`).
- Generated the AOB signature (14 bytes around the accessor instruction) via CE's "Generate scan code (Auto assembler)".
- Wrote a `.CT` script that does the AOB scan on load, resolves the pointer chain, adds the resulting address to the address list with the right type.

Failures and how to do differently:
- First AOB signature included addressing operands that shifted between builds; masked those bytes with `??`.
- The pointer chain worked in the current session but broke after game restart because the third-level offset differed; the fourth level was the actual stable base.

Reusable knowledge:
- AOB signatures: always mask displacement bytes (`??`) on instructions that use RIP-relative or offset-encoded operands; else the signature invalidates every patch.
- Pointer-chain length is not "wrong when long" — the stability property matters; keep walking until landing at an in-module static.

References:
- [1] Table: `game.CT`
- [2] Cheat Engine version: 7.5
- [3] Game: single-player Steam title (user's own copy, offline mode)
