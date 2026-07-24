thread_id: 019030a2-4c98-70d3-902a-b57c3f8813d1
updated_at: 2026-06-01T07:16:11+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\01\rollout-2026-06-01T14-32-11-019030a2-4c98-70d3-902a-b57c3f8813d1.jsonl
cwd: \\?\C:\Workspace\mobile-re-lab

# Wrote a Theos .xm tweak for a study iOS app, hooked a specific `UIView` method to log its callers.

Rollout context: cwd was `C:\Workspace\mobile-re-lab`, macOS VM + Theos + jailbroken iOS test device (personal). Sample app was a public RE study target from a Cydia-era tutorial.

## Task 1: Theos-based .xm tweak with a logos-style hook + install to device

Outcome: success

Preference signals:
- The user wanted the tweak project structured with `Makefile` + `Tweak.x` + `.plist`, standard Theos layout.
- Chinese narration; ObjC identifiers in English.

Key steps:
- `$THEOS/bin/nic.pl` to scaffold the tweak (`Tweak` template); set `TARGET := iphone:latest:14.0`, `ARCHS := arm64`.
- Wrote a `%hook UIView` + `%orig` block for the target method; added an `NSLog` of `[NSThread callStackSymbols]` inside the hook so we see the caller chain.
- Configured the filter list (`.plist`) to scope the tweak to the sample app's bundle id.
- `make package install THEOS_DEVICE_IP=<ip>` — deployed via SSH.
- Launched app, tailed `idevicesyslog | grep <TweakName>` — hook fired on the expected UI events.

Failures and how to do differently:
- First build failed due to a mismatched SDK version — bumped `TARGET`; the default SDK on the current Theos install was too old.
- The filter plist initially matched by bundle-name substring; caused the tweak to also load in a system app. Switched to exact bundle-id match.

Reusable knowledge:
- Theos on modern iOS (14+) needs an explicit `TARGET` — the default falls behind and produces mysterious link errors.
- Filter plists match by bundle id substring by default; be explicit if two apps share a prefix.

References:
- [1] Tweak: `Tweak.x`, `Makefile`, `<TweakName>.plist`
- [2] Theos version: latest master (early June 2026)
- [3] Test device: iPhone (jailbroken, personal test device)
