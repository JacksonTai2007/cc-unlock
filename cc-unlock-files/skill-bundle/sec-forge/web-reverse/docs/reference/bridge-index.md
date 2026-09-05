# Bridge Index

Bridge documents are compatibility pointers only. They are allowed only when a stable legacy path must keep working while the canonical source has already moved.

Operating rules:

- Canonical content must live under `docs/reference/`.
- Bridge files must live under `references/`.
- A bridge file may only point to one canonical target.
- New bridge files must be added here in the same change; otherwise they are considered drift.

## Current Bridges

| Bridge Path | Canonical Target |
|---|---|
| `references/env-patching.md` | `docs/reference/env-patching.md` |
| `references/output-contract.md` | `docs/reference/output-contract.md` |
| `references/tool-defaults.md` | `docs/reference/tool-defaults.md` |
