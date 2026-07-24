thread_id: 019074b6-3711-7cf9-bc3d-01e7a99228b1
updated_at: 2026-06-11T14:57:49+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\11\rollout-2026-06-11T22-33-49-019074b6-3711-7cf9-bc3d-01e7a99228b1.jsonl
cwd: \\?\C:\Workspace\game-re-notes

# Ran UE4SS's SDK dumper against an open-source UE game project build, verified the dumped SDK against the source.

Rollout context: cwd was `C:\Workspace\game-re-notes`, Windows + UE4SS. Target was a locally-built UE 5.3 packaged project from the UE community sample directory.

## Task 1: UE4SS SDK dump + verification round-trip

Outcome: success

Preference signals:
- The user wanted the SDK dump plus a small script that diffs the header against the original UE source headers, so drift is visible.
- Chinese narration; C++ identifiers preserved verbatim.

Key steps:
- Placed UE4SS's binaries + `UE4SS-settings.ini` into the packaged game's `<Game>/Binaries/Win64/`.
- Launched the game; UE4SS attached, dumped SDK into `Mods/BPModLoaderMod/Dumps/CXXHeaderDump/`.
- Wrote a diff script comparing the dumped `AActor.h` against `Engine/Source/Runtime/Engine/Classes/GameFramework/Actor.h` — 3 offsets differed as expected for a packaged build with editor-only fields stripped.

Failures and how to do differently:
- First launch UE4SS reported "GNames not found"; the offset autoscanner didn't match this UE minor version — bumped to UE4SS 3.0.1 which had 5.3 pattern support.
- Diff script initially compared line-by-line; UE headers have generated code interleaved with hand-written; switched to a structural comparison of `UPROPERTY` and `UFUNCTION` markers.

Reusable knowledge:
- UE4SS scans `GUObjectArray`/`GNames`/`FNamePool` by pattern; UE minor bumps break patterns, so keep UE4SS pinned to a version that matches.
- Diffing SDK dumps against source is only meaningful at the struct-member level; textual diff drowns in generated glue.

References:
- [1] Dump output: `CXXHeaderDump/`
- [2] UE4SS version: 3.0.1
- [3] UE version: 5.3
