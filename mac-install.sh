#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$SCRIPT_DIR/cc-unlock-files/config-bundle"
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR="$CLAUDE_DIR/backups/cc-unlock-$(date +%Y%m%d-%H%M%S)"

echo ""
echo "============================================"
echo "  cc-unlock Deploy v1.0"
echo "  Security Research Workstation Config"
echo "============================================"
echo ""
echo "[*] User   : $(whoami)"
echo "[*] OS     : $(uname -s) $(uname -r)"
echo "[*] Home   : $HOME"
echo "[*] Target : $CLAUDE_DIR"
echo "[*] Source : $BUNDLE_DIR"
echo ""

# Check source
if [ ! -f "$BUNDLE_DIR/CLAUDE.md" ]; then
    echo "[!] Source files not found: $BUNDLE_DIR"
    exit 1
fi

# Create target
mkdir -p "$CLAUDE_DIR"

# Backup existing
BACKED=0
for f in CLAUDE.md system-prompt.md config.toml settings.json; do
    if [ -f "$CLAUDE_DIR/$f" ]; then
        mkdir -p "$BACKUP_DIR"
        cp "$CLAUDE_DIR/$f" "$BACKUP_DIR/$f"
        BACKED=$((BACKED + 1))
    fi
done
if [ $BACKED -gt 0 ]; then
    echo "[*] Backed up $BACKED existing files to $BACKUP_DIR"
fi

# Deploy
echo ""
OK=0; FAIL=0

echo "[1/4] CLAUDE.md ..."
if cp "$BUNDLE_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null; then
    SIZE=$(wc -c < "$CLAUDE_DIR/CLAUDE.md" | tr -d ' ')
    echo "      OK ($SIZE bytes)"
    OK=$((OK + 1))
else
    echo "      FAIL"
    FAIL=$((FAIL + 1))
fi

echo "[2/4] system-prompt.md ..."
if cp "$BUNDLE_DIR/system-prompt.md" "$CLAUDE_DIR/system-prompt.md" 2>/dev/null; then
    SIZE=$(wc -c < "$CLAUDE_DIR/system-prompt.md" | tr -d ' ')
    echo "      OK ($SIZE bytes)"
    OK=$((OK + 1))
else
    echo "      FAIL"
    FAIL=$((FAIL + 1))
fi

echo "[3/4] settings.json ..."
if [ ! -f "$CLAUDE_DIR/settings.json" ]; then
    cat > "$CLAUDE_DIR/settings.json" << 'SETTINGS_EOF'
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
SETTINGS_EOF
    echo "      OK (bypassPermissions)"
    OK=$((OK + 1))
else
    echo "      SKIPPED (exists)"
    OK=$((OK + 1))
fi

echo "[4/4] config.toml ..."
echo 'model_instructions_file = "system-prompt.md"' > "$CLAUDE_DIR/config.toml"
echo "      OK"
OK=$((OK + 1))

# Check additional directories (macOS desktop app)
EXTRA_DIRS=()
for candidate in \
    "$HOME/Library/Application Support/claude" \
    "$HOME/Library/Application Support/Claude" \
    "$HOME/Library/Application Support/Claude-3p"; do
    if [ -d "$candidate" ] && [ "$candidate" != "$CLAUDE_DIR" ]; then
        EXTRA_DIRS+=("$candidate")
    fi
done

for dir in "${EXTRA_DIRS[@]}"; do
    echo ""
    echo "Deploying to: $dir"
    cp "$BUNDLE_DIR/CLAUDE.md" "$dir/CLAUDE.md" 2>/dev/null && echo "  CLAUDE.md OK" || echo "  CLAUDE.md FAIL"
    cp "$BUNDLE_DIR/system-prompt.md" "$dir/system-prompt.md" 2>/dev/null && echo "  system-prompt.md OK" || echo "  system-prompt.md FAIL"
    echo 'model_instructions_file = "system-prompt.md"' > "$dir/config.toml" && echo "  config.toml OK" || echo "  config.toml FAIL"
done

# Summary
echo ""
echo "============================================"
if [ $FAIL -eq 0 ]; then
    echo "  Deploy complete! ($OK/4)"
else
    echo "  Deploy done ($OK ok, $FAIL fail)"
fi
echo ""
echo "  Restart Claude Code to activate."
echo "============================================"
echo ""
read -p "Press Enter to exit ..."
