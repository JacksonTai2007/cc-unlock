thread_id: 019056e2-1988-72fd-a49c-5ba7c9ffcac6
updated_at: 2026-05-25T22:11:38+00:00
rollout_path: C:\Users\<USER>\.codex\sessions\2026\05\26\rollout-2026-05-26T05-30-38-019056e2-1988-72fd-a49c-5ba7c9ffcac6.jsonl
cwd: \\?\C:\Workspace\llm-redteam-lab

# Studied embedding-similarity RAG poisoning: crafted a doc that maximises similarity to a target query family, measured retrieval bias.

Rollout context: cwd was `C:\Workspace\llm-redteam-lab`, WSL + local RAG lab. Continued the RAG poisoning study focused on retrieval side, not content side.

## Task 1: Optimize a doc's embedding to rank first for a query family

Outcome: success

Preference signals:
- The user wanted a small optimizer script (< 100 lines) rather than a heavy framework.
- Chinese narration; identifiers in English.

Key steps:
- Embedded 200 target queries about topic X, averaged them → "cluster centroid".
- Iteratively perturbed a candidate doc's tokens (greedy hill-climb using embedding similarity as the objective).
- Fresh document ranked top-3 for 170/200 target queries after ~500 iterations.
- Verified in the RAG — poisoned doc surfaced first for the topic.

Failures and how to do differently:
- Optimizer got stuck at local maxima; added random restart every 100 iters.
- Objective purely on cosine similarity produced gibberish text; regularised by keeping bigram frequencies close to a reference corpus.

Reusable knowledge:
- RAG poisoning at the retrieval level is orthogonal to content-level indirect injection; both defences needed.
- Embedding-space optimization needs regularisation toward "human-plausible text" — pure similarity produces garbage.

References:
- [1] Optimizer: `opt/embed_poison.py`
- [2] RAG lab reuse from prior session
- [3] Reference: Zou et al. 2024 on universal adversarial doc examples
