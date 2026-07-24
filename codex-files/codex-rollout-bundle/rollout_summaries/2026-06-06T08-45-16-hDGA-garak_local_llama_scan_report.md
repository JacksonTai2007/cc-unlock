thread_id: 019059b6-b13a-71a3-a4fe-4b4b19c5f5da
updated_at: 2026-06-06T01:17:16+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\06\06\rollout-2026-06-06T08-45-16-019059b6-b13a-71a3-a4fe-4b4b19c5f5da.jsonl
cwd: \\?\C:\Workspace\llm-redteam-lab

# Ran Garak against a locally-hosted Llama-3-8B, produced a probe report on encoding + promptinject modules.

Rollout context: cwd was `C:\Workspace\llm-redteam-lab`, WSL + a local Llama-3-8B via `text-generation-inference`. Purpose was the Garak reading-list exercise.

## Task 1: Garak `--generator huggingface --probes encoding,promptinject` scan

Outcome: success

Preference signals:
- The user wanted the report saved to HTML and the raw JSONL both.
- Chinese narration; identifiers in English.

Key steps:
- Installed Garak (`pip install garak`); pointed generator at the local endpoint.
- Ran with `--probes encoding,promptinject --generations 5` — 45 minutes on the local GPU.
- Report showed base64 encoding module produced two hits; promptinject module produced one indirect-injection template flagged.
- Reviewed each hit manually — one encoding hit was a false-positive scorer edge case; documented in the report notes.

Failures and how to do differently:
- First run failed to load the model — `text-generation-inference` container wasn't exposing on the port Garak expected; corrected via `--url` flag.
- Report HTML rendering broke on markdown inside model output; escaped before render.

Reusable knowledge:
- Garak is easier to get running than PyRIT for a first pass; PyRIT wins for custom scenarios.
- Manual review of Garak hits is essential; the automated scorers have known FP patterns documented in the Garak repo.

References:
- [1] Report: `runs/garak_2026-06-06.html`
- [2] Garak version: 0.10.1
- [3] Model: local Llama-3-8B-Instruct
