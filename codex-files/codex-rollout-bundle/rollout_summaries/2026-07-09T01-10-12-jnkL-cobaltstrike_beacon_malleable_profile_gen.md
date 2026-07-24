thread_id: 01903c1c-8511-7a8f-a2ce-cf5604f85875
updated_at: 2026-07-08T17:43:12+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\07\09\rollout-2026-07-09T01-10-12-01903c1c-8511-7a8f-a2ce-cf5604f85875.jsonl
cwd: \\?\C:\Workspace\pentest-lab

# Built a Cobalt Strike malleable C2 profile mimicking common CDN traffic for a lab red-team exercise, verified beacon check-in with correct fingerprint.

Rollout context: cwd was `C:\Workspace\pentest-lab`, licensed CS 4.9 teamserver in the training network + a lab Windows target. Purpose was to walk through the malleable profile design + beacon lifecycle for the exercise.

## Task 1: Malleable profile → teamserver → beacon → verify traffic shape

Outcome: success

Preference signals:
- Chinese narration; profile syntax in English.
- The user wanted the profile modeled after a common CDN (jsdelivr) so its traffic blends in the lab's baseline.

Key steps:
- Cloned a public jsdelivr-flavored profile from `threatexpress/malleable-c2` as the base.
- Adjusted: `set jitter "37"`, `set sleeptime "60000"` (60s beacon interval), `set spawnto_x64 "%windir%\\sysnative\\gpupdate.exe"`, `set useragent "Mozilla/5.0 ... Chrome/125"`.
- HTTP transaction shape: GET `/npm/package/dist/index.min.js`, headers `Accept: */*`, `Referer: https://cdn.jsdelivr.net/`, response `Content-Type: application/javascript`.
- Ran `c2lint profile.profile` — pass, no warnings.
- Started teamserver with the profile; generated a stageless x64 EXE beacon; ran on target.
- Beacon checked in; Wireshark on the C2 network confirmed the HTTP traffic matched the profile shape.

Failures and how to do differently:
- First profile had a Content-Type mismatch between the beacon's callback and the profile's `set post-uri` — beacon failed to check in. c2lint caught it on the second pass.
- Sleep of 5s was noisy in the lab's SIEM — bumped to 60s + 37% jitter for realistic pacing.

Reusable knowledge:
- Malleable C2 profile lifecycle: start from a public template → adjust to blend with target environment's baseline traffic → c2lint → dry-run beacon → verify wire shape in Wireshark.
- Key knobs for stealth: `sleeptime`/`jitter` control beacon cadence; `spawnto_x64` controls the child process the beacon uses for post-ex; `useragent` + `Referer` match the modeled service.
- CS's built-in AV/AMSI evasion has been well-documented since ~2020; for the exercise, keep the payload simple and rely on the profile shape.

References:
- [1] Profile: `jsdelivr.profile`
- [2] Base template: threatexpress/malleable-c2 public repo
- [3] CS 4.9 teamserver
