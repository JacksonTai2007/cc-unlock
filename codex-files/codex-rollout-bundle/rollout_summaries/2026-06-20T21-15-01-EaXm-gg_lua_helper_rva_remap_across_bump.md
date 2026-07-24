thread_id: 01903e52-abca-749b-baa3-c61c27727db6
updated_at: 2026-06-20T13:32:01+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\20\rollout-2026-06-20T21-15-01-01903e52-abca-749b-baa3-c61c27727db6.jsonl
cwd: \\?\C:\Workspace\game-re-notes

# Ported a GameGuardian Lua helper script across a version bump for the user's own copy of an Android IL2CPP game, remapped all RVAs from the new dump.cs.

Rollout context: cwd was `C:\Workspace\game-re-notes`, Windows + PowerShell + a bootloader-unlocked test device. The user has a Lua helper script they wrote for their own copy of an Android IL2CPP game and needed to port it forward one build. Both the old and new `dump.cs` were checked in for diff.

## Task 1: Port an owner-maintained GG Lua script across an IL2CPP build bump

Outcome: success

Preference signals:
- The user asked to keep the Lua structure and comments intact — only RVA constants and any renamed method signatures should change.
- The user cared about diff readability so future bumps could compare 1:1.
- Chinese narration; Lua identifiers in English matching the original file.

Key steps:
- Wrote a small Python side-tool that diff-matched class + method signatures between old and new `dump.cs`, produced an `old_rva -> new_rva` table for every symbol the Lua script referenced.
- For methods whose signature drifted (parameter type change), flagged them as `MANUAL_REVIEW` in the table rather than auto-remapping.
- Ran the table through a sed-like Lua rewriter that walked every `gg.setValues({...})` block and swapped the `address = <old_rva> + il2cpp_base` literal for the new RVA.
- Hand-audited the 4 `MANUAL_REVIEW` methods with the user — 3 were compatible signature-widening (a new default parameter appended) and one required a small offset change in a struct field access; the user made the call on which reading was correct.
- Verified the ported script loaded cleanly in GameGuardian on the test device without any "address 0" complaints.

Failures and how to do differently:
- Initial signature-diff considered generic type parameters as significant; that flagged too many methods as "changed" because the dumper reordered generic parameter names. Switched the comparison to compare method arity + non-generic parameter shape.
- First run rewrote a `.disabled = true` block that had been commented out in the Lua source; taught the rewriter to skip lines that were already Lua comments.

Reusable knowledge:
- For IL2CPP RVA drift across versions, matching by (class, method_name, arity, non-generic-param-shape) is much more stable than string signature match.
- GameGuardian's `gg.setValues` addressing convention is `il2cpp_base + rva`; if the script uses that directly, RVA-swap is enough — no code-path changes.
- Keeping the manual-review flag in the mapping table (rather than silently accepting) prevents the "quiet drift" bug that shows up much later as game misbehaviour.

References:
- [1] Diff tool: `tools/rva_diff.py`
- [2] Old / new dumps: `dump-v1.cs`, `dump-v2.cs`
- [3] Ported script: `scripts/game_lua_v2.lua`
