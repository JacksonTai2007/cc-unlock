thread_id: 01905b8c-4eea-7dbe-a8b4-b26eb3011876
updated_at: 2026-06-02T15:18:59+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\02\rollout-2026-06-02T22-45-59-01905b8c-4eea-7dbe-a8b4-b26eb3011876.jsonl
cwd: \\?\C:\Workspace\aosp-lab

# Studied Play Integrity's DEVICE_INTEGRITY on the test Android device with PIF + USNF installed, documented what each verdict means.

Rollout context: cwd was `C:\Workspace\aosp-lab`, Windows + PowerShell + Android test device. Purpose: understand the client-side integrity signal chain and what modifies each verdict.

## Task 1: Install PIF + USNF, run Play Integrity API check, document responses

Outcome: success

Preference signals:
- The user wanted a comparison table (before / after PIF, before / after USNF) rather than a walkthrough.
- Chinese narration; identifiers in English.

Key steps:
- Baseline: with just Magisk root and no PIF, DEVICE_INTEGRITY was `MEETS_DEVICE_INTEGRITY: false`.
- Installed PIF (osm0sis' Play Integrity Fix) via Magisk; DEVICE_INTEGRITY returned true.
- Installed Universal SafetyNet Fix; MEETS_BASIC_INTEGRITY stayed true even after certain hidden-app checks.
- STRONG_INTEGRITY: consistently false (requires hardware attestation the device can't produce with an unlocked bootloader).
- Table logged with attestation output.

Failures and how to do differently:
- PIF module needed a fresh `fingerprint` prop matching an approved OEM+model; used one from the public PIF-props JSON.
- First test app cached a previous verdict; cleared Play Services data before re-checking.

Reusable knowledge:
- DEVICE_INTEGRITY passes with PIF + a good fingerprint; STRONG_INTEGRITY requires hardware key attestation.
- Cache invalidation: Play Services caches integrity verdicts; clear its data between test runs.

References:
- [1] Comparison table: `docs/play_integrity_comparison.md`
- [2] PIF version: latest (June 2026)
- [3] Device: Android test device (personal)
