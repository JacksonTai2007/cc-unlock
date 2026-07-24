thread_id: 018fe3f5-a8ec-7cd7-b213-eec86bd3f8bc
updated_at: 2026-06-01T14:20:56+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\01\rollout-2026-06-01T21-49-56-018fe3f5-a8ec-7cd7-b213-eec86bd3f8bc.jsonl
cwd: \\?\C:\Workspace\evasion-lab

# Wrote a small reflective DLL loader following Stephen Fewer's original public reference, tested with a benign DLL in the test VM.

Rollout context: cwd was `C:\Workspace\evasion-lab`, Win11 23H2 test VM. Purpose: understand the reflective loader technique that shows up in nearly every technical writeup on in-memory PE loading.

## Task 1: Reflective loader + benign DLL payload; verify load without touching disk

Outcome: success

Preference signals:
- The user wanted the loader clean and heavily commented; a study reference, not an evasion product.
- Chinese narration; C identifiers in English.

Key steps:
- Followed Stephen Fewer's `ReflectiveLoader.c` as the reference; kept the layout for readability.
- Benign DLL: exports a single function that pops a message box.
- Loader: allocate RWX region → copy PE → walk relocations → resolve imports → set page protections → call `DllMain`.
- Ran; DLL loaded and executed without appearing in the module list.

Failures and how to do differently:
- Import resolution used the wrong hash algorithm variant initially; ntdll functions unresolved. Reverted to the exact algorithm from Fewer's reference.

Reusable knowledge:
- Reflective loading is a well-documented technique; the public reference is still the cleanest starting point.
- Modern EDRs detect the technique via multiple angles; this is a study exercise, not a working evasion.

References:
- [1] Loader: `reflective_loader.c`
- [2] Reference: Stephen Fewer's original public source
- [3] Test VM: Win11 23H2
