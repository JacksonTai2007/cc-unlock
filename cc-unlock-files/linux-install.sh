#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$SCRIPT_DIR/config-bundle"
CODEX_BUNDLE_DIR="$SCRIPT_DIR/../codex-files/codex-config-bundle"
CLAUDE_DIR="$HOME/.claude"
CODEX_DIR="$HOME/.codex"

# Inject / refresh `model_instructions_file = "system-prompt.md"` as a TOML root
# key WITHOUT clobbering the rest of config.toml. Other tools (e.g. cc-switch)
# write the active provider / base_url / key into the same file; we must keep
# those. Re-added at the top so it stays a root key (root keys must precede the
# first [table] header). Idempotent.
ensure_instructions_file() {
    local cfg="$1"
    local line='model_instructions_file = "system-prompt.md"'
    if [ ! -f "$cfg" ]; then
        printf '%s\n' "$line" > "$cfg"
        return 0
    fi
    local tmp="${cfg}.cc-unlock.tmp"
    {
        printf '%s\n' "$line"
        grep -Ev '^[[:space:]]*model_instructions_file[[:space:]]*=' "$cfg" || true
    } > "$tmp"
    mv "$tmp" "$cfg"
}

echo ""
echo "============================================"
echo "  cc-unlock Deploy v2.1 (Linux)"
echo "  Claude Code + Codex Dual-CLI Config"
echo "============================================"
echo ""

if [ ! -f "$BUNDLE_DIR/CLAUDE.md" ]; then
    echo "[!] Source files not found: $BUNDLE_DIR"
    exit 1
fi

mkdir -p "$CLAUDE_DIR"

# Backup Claude Code
BACKUP_DIR="$CLAUDE_DIR/backups/cc-unlock-$(date +%Y%m%d-%H%M%S)"
for f in CLAUDE.md system-prompt.md config.toml settings.json; do
    if [ -f "$CLAUDE_DIR/$f" ]; then
        mkdir -p "$BACKUP_DIR"
        cp "$CLAUDE_DIR/$f" "$BACKUP_DIR/$f"
    fi
done

# Deploy Claude Code
echo "--- Claude Code ---"
cp "$BUNDLE_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md"
echo "[+] CLAUDE.md"
cp "$BUNDLE_DIR/system-prompt.md" "$CLAUDE_DIR/system-prompt.md"
echo "[+] system-prompt.md"
ensure_instructions_file "$CLAUDE_DIR/config.toml"
echo "[+] config.toml (merged)"

if [ ! -f "$CLAUDE_DIR/settings.json" ]; then
    cat > "$CLAUDE_DIR/settings.json" << 'EOF'
{
  "effortLevel": "xhigh",
  "env": {
    "CLAUDE_CODE_EFFORT_LEVEL": "max",
    "DISABLE_AUTOUPDATER": "1"
  },
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "skipDangerousModePermissionPrompt": true
}
EOF
    echo "[+] settings.json"
else
    echo "[=] settings.json (exists, skipped)"
fi

# Deploy Codex (uses system-prompt.md + config.toml, not AGENTS.md)
echo ""
if [ -f "$CODEX_BUNDLE_DIR/system-prompt.md" ]; then
    echo "--- Codex ---"
    mkdir -p "$CODEX_DIR"
    # Backup Codex
    for f in system-prompt.md config.toml AGENTS.md; do
        if [ -f "$CODEX_DIR/$f" ]; then
            CODEX_BACKUP="$CODEX_DIR/backups/cc-unlock-$(date +%Y%m%d-%H%M%S)"
            mkdir -p "$CODEX_BACKUP"
            cp "$CODEX_DIR/$f" "$CODEX_BACKUP/$f"
        fi
    done
    cp "$CODEX_BUNDLE_DIR/system-prompt.md" "$CODEX_DIR/system-prompt.md"
    echo "[+] system-prompt.md"
    ensure_instructions_file "$CODEX_DIR/config.toml"
    echo "[+] config.toml (merged)"
    # Clean up old AGENTS.md
    [ -f "$CODEX_DIR/AGENTS.md" ] && rm -f "$CODEX_DIR/AGENTS.md" && echo "[~] Cleaned up old AGENTS.md"
else
    echo "Codex bundle not found, skipping Codex deploy."
fi

echo ""
echo "Deploy complete! Restart Claude Code / Codex to activate."
