#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$SCRIPT_DIR/config-bundle"
CODEX_BUNDLE_DIR="$SCRIPT_DIR/../codex-files/codex-config-bundle"
CLAUDE_DIR="$HOME/.claude"
CODEX_DIR="$HOME/.codex"

echo ""
echo "============================================"
echo "  cc-unlock Deploy v2.0 (Linux)"
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
echo 'model_instructions_file = "system-prompt.md"' > "$CLAUDE_DIR/config.toml"
echo "[+] config.toml"

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

# Deploy Codex
echo ""
if [ -f "$CODEX_BUNDLE_DIR/AGENTS.md" ]; then
    echo "--- Codex ---"
    mkdir -p "$CODEX_DIR"
    # Backup Codex
    if [ -f "$CODEX_DIR/AGENTS.md" ] || [ -f "$CODEX_DIR/config.toml" ]; then
        CODEX_BACKUP="$CODEX_DIR/backups/cc-unlock-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$CODEX_BACKUP"
        for f in AGENTS.md config.toml; do
            [ -f "$CODEX_DIR/$f" ] && cp "$CODEX_DIR/$f" "$CODEX_BACKUP/$f"
        done
    fi
    cp "$CODEX_BUNDLE_DIR/AGENTS.md" "$CODEX_DIR/AGENTS.md"
    echo "[+] AGENTS.md"
    cp "$CODEX_BUNDLE_DIR/config.toml" "$CODEX_DIR/config.toml"
    echo "[+] config.toml"
else
    echo "Codex bundle not found, skipping Codex deploy."
fi

echo ""
echo "Deploy complete! Restart Claude Code / Codex to activate."
