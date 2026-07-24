thread_id: 01905e46-3fef-7c4d-b0c1-f22a20b7a1d5
updated_at: 2026-06-15T20:56:30+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\16\rollout-2026-06-16T04-22-30-01905e46-3fef-7c4d-b0c1-f22a20b7a1d5.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Wrote a minifilter driver that intercepts `IRP_MJ_CREATE` for a specific path prefix and logs to WPP, verified via `fltmc`.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 23H2 test VM + WDK. Baseline minifilter for future evasion / detection experiments.

## Task 1: Minifilter with `IRP_MJ_CREATE` callback + WPP tracing + fltmc registration

Outcome: success

Preference signals:
- Follow the WDK template but strip anything the exercise doesn't need.
- Chinese narration; identifiers in English.

Key steps:
- Started from the `FileFilter` sample; kept `FltRegisterFilter` + `FltStartFiltering`; removed the sample's example altitude reservation and used a lab-assigned altitude.
- Registered `PreCreate` callback that examines `Data->Iopb->TargetFileObject->FileName`; matches on a `\??\C:\Workspace\test` prefix and logs.
- Loaded via `fltmc load lab0-minifilter`; verified with `fltmc filters` showing the module + altitude.
- Test-touched a file under `C:\Workspace\test\a.txt` — WPP trace showed the hit.

Failures and how to do differently:
- First altitude collided with WD's default; picked a fresh one from the lab-assigned range.
- Forgot to add `FLT_REGISTRATION_VERSION` update after WDK version bump; compiled but failed at `FltRegisterFilter`.

Reusable knowledge:
- Altitude collisions are a common early-driver gotcha; use lab-assigned altitudes for internal work.
- `Data->Iopb->TargetFileObject->FileName` is unicode; match with `RtlPrefixUnicodeString` rather than a wide C-string compare.

References:
- [1] Driver: `lab0-minifilter/`
- [2] WDK 10.0.22621.2428
- [3] Test VM: Win11 23H2
