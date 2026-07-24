thread_id: 019053ff-1de4-701d-ab2d-9c5ac8f5aab0
updated_at: 2026-06-05T07:31:46+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\05\rollout-2026-06-05T15-04-46-019053ff-1de4-701d-ab2d-9c5ac8f5aab0.jsonl
cwd: \\?\C:\Workspace\ctf-notes

# Solved a Wiener-attack CTF crypto challenge: RSA with a small `d`, recovered private exponent via continued fractions.

Rollout context: cwd was `C:\Workspace\ctf-notes`, WSL + SageMath. Standard Wiener attack CTF challenge.

## Task 1: Continued-fraction expansion of `e/N` → find `d` → decrypt

Outcome: success

Preference signals:
- One-file SageMath script.
- Chinese narration; math notation in the writeup, Sage in English.

Key steps:
- Read `n, e, c` from the challenge.
- Wiener's attack works when `d < N^0.25 / 3`.
- Computed continued fraction of `e/n`; iterated convergents `k/d`; for each, computed `phi = (e*d - 1) / k` then solved the quadratic to check factorization.
- Found `d`; decrypted `c`.

Failures and how to do differently:
- Initial script only checked a few convergents; expanded the loop to cover them all up to bit-length.

Reusable knowledge:
- Wiener works only for small `d`; check with the criterion before firing.
- Continued fractions in Sage: `continued_fraction(e/n).convergents()`.

References:
- [1] Script: `wiener.sage`
- [2] SageMath 10.3
- [3] Reference: Wiener 1990
