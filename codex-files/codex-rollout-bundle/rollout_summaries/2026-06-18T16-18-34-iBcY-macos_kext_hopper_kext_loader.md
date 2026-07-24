thread_id: 01901171-6955-7c95-964d-f2936e540db6
updated_at: 2026-06-18T08:33:34+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\18\rollout-2026-06-18T16-18-34-01901171-6955-7c95-964d-f2936e540db6.jsonl
cwd: \\?\C:\Workspace\re-lab

# Loaded a macOS kext in Hopper via the kext-loader helper, annotated dispatch and IOKit registration boilerplate.

Rollout context: cwd was `C:\Workspace\re-lab`, macOS VM + Hopper 5. Target was an open-source signed kext bundle from a public RE writeup.

## Task 1: kext load + dispatch annotation in Hopper

Outcome: success

Preference signals:
- The user wanted the Hopper session saved and every IOKit entry point annotated with the corresponding driver class method.
- Chinese narration; C++ identifiers in English.

Key steps:
- Extracted the Mach-O from the kext bundle (`Contents/MacOS/<name>`); loaded in Hopper with kext-loader plugin.
- Identified `MetaClass` init blocks — each block ties a class name (visible in the Info.plist reference) to a vtable start.
- Named vtable slots after the IOKit lifecycle methods (`start`, `stop`, `probe`, `willTerminate`, `handleOpen`).
- For the driver's `IOUserClient` subclass, annotated the `externalMethod` dispatch by matching each method index to a symbol from the header included in the source release.

Failures and how to do differently:
- Hopper's default Objective-C metadata detector fought the C++ IOKit metadata; disabled the ObjC pass before the kext load.
- Named the wrong class first (the abstract parent instead of the concrete subclass); fixed after cross-checking Info.plist.

Reusable knowledge:
- IOKit's `MetaClass` init at kext load registers `ClassName` strings; matching these to Info.plist gives you class→vtable ties immediately.
- Disable Hopper's ObjC metadata pass before loading a C++ kext; the two disagree on section handling.

References:
- [1] Hopper session: `sample_kext.hop`
- [2] Kext source: public open-source project
- [3] macOS SDK reference: `IOUserClient.h` from `MacOSX14.4.sdk`
