# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 5.0.x   | Yes       |
| 3.0.x   | No        |
| < 3.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in cc-unlock's deployment scripts or configuration:

1. **Do NOT open a public issue**
2. Email: jacksontai200701@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

Response time: within 72 hours.

## Scope

This security policy covers:
- Deployment scripts (deploy.ps1, linux-install.sh, mac-install.sh, etc.)
- Memory bundle files deployed to `~/.claude/projects/[PROJECT]/memory/`
- Configuration files (settings.json, config.toml)
- Codex system-prompt.md

This policy does **NOT** cover:
- Claude Code's own security model
- The behavioral effects of memory/CLAUDE.md configuration on model output
- Third-party tools referenced in research domains

## Responsible Use

cc-unlock is designed for authorized security research. Users are responsible for:
- Ensuring they have proper authorization for their research activities
- Complying with applicable laws and regulations
- Following responsible disclosure practices for any vulnerabilities discovered
