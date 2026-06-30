#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE_DIR="$SCRIPT_DIR/cc-unlock-files/config-bundle"
CODEX_BUNDLE_DIR="$SCRIPT_DIR/codex-files/codex-config-bundle"
CLAUDE_DIR="$HOME/.claude"
CODEX_DIR="$HOME/.codex"
BACKUP_DIR="$CLAUDE_DIR/backups/cc-unlock-$(date +%Y%m%d-%H%M%S)"

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
echo "  cc-unlock Deploy v3.0.2"
echo "  Claude Code + Codex Dual-CLI Config"
echo "============================================"
echo ""
echo "[*] User   : $(whoami)"
echo "[*] OS     : $(uname -s) $(uname -r)"
echo "[*] Home   : $HOME"
echo "[*] Claude : $CLAUDE_DIR"
echo "[*] Codex  : $CODEX_DIR"
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
    echo "[*] Backed up $BACKED existing Claude Code files"
fi

# Deploy Claude Code
echo ""
echo "--- Claude Code ---"
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
ensure_instructions_file "$CLAUDE_DIR/config.toml"
echo "      OK (merged)"
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
    ensure_instructions_file "$dir/config.toml" && echo "  config.toml OK (merged)" || echo "  config.toml FAIL"
done

# Deploy Codex (uses system-prompt.md + config.toml, not AGENTS.md)
CODEX_OK=0
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
    echo "[1/2] system-prompt.md ..."
    if cp "$CODEX_BUNDLE_DIR/system-prompt.md" "$CODEX_DIR/system-prompt.md" 2>/dev/null; then
        SIZE=$(wc -c < "$CODEX_DIR/system-prompt.md" | tr -d ' ')
        echo "      OK ($SIZE bytes)"
        CODEX_OK=$((CODEX_OK + 1))
    else
        echo "      FAIL"
        FAIL=$((FAIL + 1))
    fi
    echo "[2/2] config.toml ..."
    if ensure_instructions_file "$CODEX_DIR/config.toml"; then
        SIZE=$(wc -c < "$CODEX_DIR/config.toml" | tr -d ' ')
        echo "      OK ($SIZE bytes, merged)"
        CODEX_OK=$((CODEX_OK + 1))
    else
        echo "      FAIL"
        FAIL=$((FAIL + 1))
    fi
    # Clean up old AGENTS.md
    [ -f "$CODEX_DIR/AGENTS.md" ] && rm -f "$CODEX_DIR/AGENTS.md" && echo "      Cleaned up old AGENTS.md"
else
    echo "Codex bundle not found, skipping Codex deploy."
fi

# Summary
echo ""
echo "============================================"
if [ $FAIL -eq 0 ]; then
    echo "  Deploy complete!"
    echo "    Claude Code: $OK/4"
    if [ $CODEX_OK -gt 0 ]; then
        echo "    Codex:       $CODEX_OK/2"
    fi
else
    echo "  Deploy done ($((OK + CODEX_OK)) ok, $FAIL fail)"
fi
echo ""
echo "  Restart Claude Code / Codex to activate."
echo "============================================"
echo ""
read -p "Press Enter to exit ..."
