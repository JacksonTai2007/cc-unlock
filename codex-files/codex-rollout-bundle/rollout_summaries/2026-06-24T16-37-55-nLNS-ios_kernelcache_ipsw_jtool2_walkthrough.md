thread_id: 01905ff9-3e3e-7b7b-9f6c-15a7e2fadcbb
updated_at: 2026-06-24T09:12:55+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\24\rollout-2026-06-24T16-37-55-01905ff9-3e3e-7b7b-9f6c-15a7e2fadcbb.jsonl
cwd: \\?\C:\Workspace\re-lab

# Extracted an iOS kernelcache from a public IPSW using ipsw + jtool2, loaded into IDA with public symbol map.

Rollout context: cwd was `C:\Workspace\re-lab`, macOS VM + `ipsw` (blacktop) + `jtool2` + IDA. Target was a publicly-downloadable IPSW from Apple.

## Task 1: iOS kernelcache extract → IDA load with named subsystems

Outcome: success

Preference signals:
- The user wanted a shell-only extract path (no GUI), then IDA on the resulting kernelcache.
- Chinese narration; command lines in English.

Key steps:
- `ipsw download ipsw --device iPhone14,4 --version 17.5.1` to pull the IPSW from Apple's CDN.
- `ipsw extract --kernel <ipsw>` produced the kernelcache; `jtool2 --extract-fileset <kc>` split subsystems.
- Loaded main kernelcache into IDA; used the public symbol-map from ellisapps/iOS-symbol-maps to name known subsystems.
- Verified a symbol (`IOKit`'s `IORegistryEntry::attachToParent`) by cross-checking a known xref pattern.

Failures and how to do differently:
- First IDA load choked on the fileset structure until segmented per-subsystem load was enabled.
- Symbol map version didn't match 17.5.1 exactly (only 17.5.0 available); ~5% of symbols were slightly off — flagged with a "verify" comment in the IDB.

Reusable knowledge:
- `ipsw` + `jtool2` is the standard iOS kernelcache extract pipeline; both are free and battle-tested.
- iOS kernelcache is a Mach-O fileset — IDA needs the per-subsystem load option, not the default single-image mode.
- Public symbol maps drift by minor version; treat as scaffolding, not ground truth.

References:
- [1] Tools: `ipsw` 3.1.485, `jtool2` 1.1
- [2] IPSW: `iPhone14,4_17.5.1_21F90_Restore.ipsw` (public)
- [3] Symbol map: ellisapps/iOS-symbol-maps
