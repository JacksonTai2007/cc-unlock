thread_id: 018fbf5a-7dc0-79b9-b5b8-ba7d0e70b02f
updated_at: 2026-05-18T21:14:32+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\19\rollout-2026-05-19T04-41-32-018fbf5a-7dc0-79b9-b5b8-ba7d0e70b02f.jsonl
cwd: \\?\C:\Workspace\malware-lab

# Reversed the custom TCP framing of a publicly-documented C2 sample, wrote a decoder + Wireshark dissector.

Rollout context: cwd was `C:\Workspace\malware-lab`, WSL + a PCAP from the public disclosure. Educational study of a known family's framing scheme.

## Task 1: Frame parser → Wireshark Lua dissector → beacon message decode

Outcome: success

Preference signals:
- The user wanted a Lua dissector rather than a heavyweight rewrite; Wireshark is the analysis surface.
- Chinese narration; identifiers in English.

Key steps:
- Loaded PCAP; identified the C2 flow by port + destination.
- Reversed the length-prefixed framing: 4-byte magic, 2-byte length, XOR-obfuscated body with a rolling key.
- Wrote a small Python decoder to extract command / response bodies.
- Wrote a Wireshark Lua dissector so future PCAPs decode inline.

Failures and how to do differently:
- Initial XOR key guess was wrong; ran a chi-square analysis over candidate keys to find the true one.

Reusable knowledge:
- Custom C2 framings often use rolling-key XOR; chi-square over candidate keys is a solid fingerprint.
- Wireshark Lua dissectors are cheap enough to write per family — worth it for repeated triage.

References:
- [1] Dissector: `wireshark/lua/family_x_dissector.lua`
- [2] Python decoder: `tools/decoder.py`
- [3] PCAP: public disclosure attachment
