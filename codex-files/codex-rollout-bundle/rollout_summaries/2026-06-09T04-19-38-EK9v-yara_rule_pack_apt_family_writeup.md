thread_id: 019067d5-30bf-77a7-a51f-c7b8cbc123fa
updated_at: 2026-06-08T20:52:38+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\09\rollout-2026-06-09T04-19-38-019067d5-30bf-77a7-a51f-c7b8cbc123fa.jsonl
cwd: \\?\C:\Workspace\malware-lab

# Wrote a YARA rule pack for a publicly-documented sample family, verified against MalwareBazaar samples and clean corpus.

Rollout context: cwd was `C:\Workspace\malware-lab`, WSL + a set of hashes pulled from MalwareBazaar (all public). Purpose was YARA rule-writing practice from a public writeup.

## Task 1: Rule pack: 4 rules per family variant, verified TP + FP rate

Outcome: success

Preference signals:
- The user wanted each rule to include a `condition` that combined at least two independent signals so single-signal FPs don't fire.
- Chinese narration; YARA identifiers in English.

Key steps:
- Downloaded the sample set + a clean corpus (goodware from public repos).
- Wrote 4 rules per variant: one on hex string, one on section characteristics, one on import hash pattern, one composite.
- Ran `yara` across both sets; measured TP / FP counts.
- Refined the hex string rule after one FP was traced to a common packer prologue.

Failures and how to do differently:
- First composite rule required all 4 to match — dropped TP to 60%. Loosened to any-2-of-4.
- Imphash was too fragile across builds; kept it as a hint rather than a signal.

Reusable knowledge:
- YARA rules should combine at least two orthogonal signal families; single-family rules are the FP nightmare.
- Any-2-of-N composite is a good default when signals are noisy per-signal.

References:
- [1] Rules: `rules/*.yar`
- [2] Sample set: MalwareBazaar public hashes
- [3] Clean corpus: public goodware repos
