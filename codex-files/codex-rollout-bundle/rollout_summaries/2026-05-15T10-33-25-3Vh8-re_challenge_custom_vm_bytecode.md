thread_id: 018fd551-d1f4-7c94-b4e2-fdda17f10c85
updated_at: 2026-05-15T03:16:25+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\15\rollout-2026-05-15T10-33-25-018fd551-d1f4-7c94-b4e2-fdda17f10c85.jsonl
cwd: \\?\C:\Workspace\ctf-notes

# Reversed a custom-VM CTF challenge: reversed the interpreter, wrote a disassembler for its bytecode, recovered the flag algorithm.

Rollout context: cwd was `C:\Workspace\ctf-notes`, Windows + IDA. Standard "custom VM" RE challenge.

## Task 1: Reverse VM opcode table → write disassembler → solve

Outcome: success

Preference signals:
- The user wanted the disassembler script reusable; future custom-VM challenges start from this template.
- Chinese narration; Python identifiers in English.

Key steps:
- Identified the interpreter loop by the dispatch pattern (`switch` on `bytecode[ip]`).
- Enumerated 18 opcodes; documented each in a table.
- Wrote a Python disassembler that turns the embedded bytecode blob into text.
- Read the disassembly; the algorithm was a per-char XOR with a rolling seed. Wrote the inverse; got the flag.

Failures and how to do differently:
- Missed one opcode (a shift-only variant) on first pass; disassembly stumbled on unknown byte. Filled in and re-ran.

Reusable knowledge:
- Custom VMs almost always have a dispatch-loop pattern; find it, enumerate opcodes, write a disassembler. Skip trying to "trace with a debugger" — the disassembler is faster.

References:
- [1] Disassembler: `dis.py`
- [2] Bytecode blob offset: from the challenge binary
