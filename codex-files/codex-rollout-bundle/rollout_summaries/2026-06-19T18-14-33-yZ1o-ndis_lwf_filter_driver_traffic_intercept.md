thread_id: 019061e9-5e93-70b4-9e63-e0eb50fbde58
updated_at: 2026-06-19T10:41:33+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\19\rollout-2026-06-19T18-14-33-019061e9-5e93-70b4-9e63-e0eb50fbde58.jsonl
cwd: \\?\C:\Workspace\kernel-lab

# Wrote an NDIS lightweight filter (LWF) driver that logs `NetBufferList` metadata for a chosen VLAN, verified with `ndiscap`.

Rollout context: cwd was `C:\Workspace\kernel-lab`, Win11 23H2 test VM. Purpose was an early-stage traffic-inspection primitive as a baseline for later network-layer exercises.

## Task 1: NDIS LWF with `FilterReceiveNetBufferLists` callback + WPP trace

Outcome: success

Preference signals:
- The user wanted a text log per NBL: source MAC, dest MAC, size, protocol; no payload dump yet.
- Chinese narration; identifiers in English.

Key steps:
- Started from the WDK `ndislwf` sample; kept `FilterAttach` + `FilterReceiveNetBufferLists`.
- Added a helper that walks the NBL chain, extracts Ethernet header, dumps the tuple to WPP.
- Scoped to VLAN 10 by inspecting the Ethernet II tag prior to dumping.
- Loaded via `.\install.cmd`; verified attach with `netcfg -q`.
- Sent test traffic (`ping` from a peer on VLAN 10); WPP hits captured with `logman start` + a small `TMF` file.

Failures and how to do differently:
- Initial install fatal-errored because the sample's `.inf` referenced a non-existent CAT file entry; rebuilt CAT with `signtool`.
- Payload dump added later exceeded a stack frame; moved buffer to `ExAllocatePool2`.

Reusable knowledge:
- LWFs attach at the miniport-protocol boundary; capture happens at receive time, before OS delivery to protocols.
- WPP + TMF is much better than `DbgPrint` for high-rate NBL logging.

References:
- [1] Driver: `lab0-ndis-lwf/`
- [2] WDK 10.0.22621
- [3] Test VM: Win11 23H2
