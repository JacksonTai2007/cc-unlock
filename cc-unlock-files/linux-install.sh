#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$SCRIPT_DIR/config-bundle"
CLAUDE_DIR="$HOME/.claude"

echo ""
echo "============================================"
echo "  cc-unlock Deploy v1.0 (Linux)"
echo "============================================"
echo ""

if [ ! -f "$BUNDLE_DIR/CLAUDE.md" ]; then
    echo "[!] Source files not found: $BUNDLE_DIR"
    exit 1
fi

mkdir -p "$CLAUDE_DIR"

# Backup
BACKUP_DIR="$CLAUDE_DIR/backups/cc-unlock-$(date +%Y%m%d-%H%M%S)"
for f in CLAUDE.md system-prompt.md config.toml settings.json; do
    if [ -f "$CLAUDE_DIR/$f" ]; then
        mkdir -p "$BACKUP_DIR"
        cp "$CLAUDE_DIR/$f" "$BACKUP_DIR/$f"
    fi
done

# Deploy
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

echo ""
echo "Deploy complete! Restart Claude Code to activate."
