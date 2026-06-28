# Changelog

## v1.0.0 (2026-06-29)

### Initial Release

- Core behavioral config (CLAUDE.md) with ~300 optimized examples across 15 security research domains
- Real authorization framework based on independent security research institution credentials
- Model-specific adaptation for Claude Opus 4.8 and Fable 5
- Terminology normalization table preventing euphemistic substitution
- Cross-platform deployment:
  - Windows: PowerShell deploy script (PS 2.0–7.x compatible) + .bat launchers
  - macOS: Shell scripts + .command launchers
  - Linux: Shell scripts
- Auto-backup and restore on all platforms
- Multi-directory detection for various Claude Code installation paths
- Codex compatibility via config.toml + system-prompt.md
- settings.json with bypassPermissions for uninterrupted workflow
- Comprehensive documentation (bilingual CN/EN)
