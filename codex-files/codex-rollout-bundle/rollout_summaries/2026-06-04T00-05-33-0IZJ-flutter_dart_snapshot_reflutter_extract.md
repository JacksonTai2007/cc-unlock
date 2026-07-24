thread_id: 019070e4-299b-7150-80c8-f6debe506825
updated_at: 2026-06-03T16:49:33+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\04\rollout-2026-06-04T00-05-33-019070e4-299b-7150-80c8-f6debe506825.jsonl
cwd: \\?\C:\Workspace\mobile-re-lab

# Extracted Dart snapshot classes and hot function bodies from a Flutter APK using reFlutter, produced a readable IDA project.

Rollout context: cwd was `C:\Workspace\mobile-re-lab`, WSL Ubuntu + reFlutter + IDA. Target was a Flutter APK from a public RE writeup; the app packaged Dart AOT snapshot inside `libapp.so`.

## Task 1: Dart snapshot extraction and hot-path annotation

Outcome: success

Preference signals:
- The user wanted the pipeline reproducible from `apk in` to `IDB out` with a single script.
- Chinese narration; Dart identifiers preserved verbatim.

Key steps:
- Ran `reFlutter` against the APK, produced a patched `libapp.so` with class names embedded as strings.
- Parsed the reFlutter output to a `class_offset -> name` mapping; wrote an idapython pass that renamed functions accordingly.
- Located a hot function by matching a known UI string constant; walked from the string xref back to the Dart function that referenced it.
- Annotated the Dart calling convention: `x0` = closure context, `x1..` = args.

Failures and how to do differently:
- reFlutter's patch pass added an extra `.so` section that IDA loaded as data; excluded it via a segment mask before analysis.
- First IDA analysis missed the Dart JIT stubs; forced code-flow analysis on the entry range.

Reusable knowledge:
- Flutter AOT snapshots ship as raw arm64 inside `libapp.so`; reFlutter is the standard extractor.
- Dart calling convention on arm64: `x0` is the closure/context pointer for closures, not the first arg. Getting this wrong makes every function look broken.

References:
- [1] Script: `tools/reflutter_pass.sh`
- [2] reFlutter version: 1.9.0
- [3] Flutter version markers: 3.22 (from the snapshot header)
