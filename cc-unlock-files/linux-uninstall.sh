#!/bin/bash
set -e

CLAUDE_DIR="$HOME/.claude"
CODEX_DIR="$HOME/.codex"

# Strip only the `model_instructions_file` line we added, preserving any other
# config.toml content (e.g. cc-switch's provider/base_url/key). If nothing
# meaningful remains, remove the file. config.toml is shared, so we never delete
# it wholesale and never restore a stale backup over the live file.
remove_instructions_file() {
    local cfg="$1"
    [ -f "$cfg" ] || { echo "  config.toml not found"; return 0; }
    local tmp="${cfg}.cc-unlock.tmp"
    grep -Ev '^[[:space:]]*model_instructions_file[[:space:]]*=' "$cfg" > "$tmp" 2>/dev/null || true
    if grep -Eq '[^[:space:]]' "$tmp" 2>/dev/null; then
        mv "$tmp" "$cfg"
        echo "  config.toml (kept other settings)"
    else
        rm -f "$tmp" "$cfg"
        echo "  Removed config.toml"
    fi
}

# The installer only writes settings.json when none exists and never overwrites an
# existing one, so a file carrying our bypassPermissions signature was created by
# cc-unlock — remove it (else uninstall silently leaves Claude Code in bypass mode).
# Removing it returns the user to their original state (they had no settings.json).
# A file without our signature is the user's own and is left untouched.
handle_settings_json() {
    local f="$1/settings.json"
    [ -f "$f" ] || return 0
    if grep -q 'bypassPermissions' "$f" 2>/dev/null && grep -q 'skipDangerousModePermissionPrompt' "$f" 2>/dev/null; then
        rm -f "$f"
        echo "  Removed settings.json (cc-unlock)"
    else
        echo "  settings.json kept (user's own)"
    fi
}

echo ""
echo "  cc-unlock Uninstall (Linux)"
echo ""

# Claude Code
echo "  --- Claude Code ---"
for f in CLAUDE.md system-prompt.md; do
    if [ -f "$CLAUDE_DIR/$f" ]; then
        rm -f "$CLAUDE_DIR/$f"
        echo "  Removed $f"
    fi
done
remove_instructions_file "$CLAUDE_DIR/config.toml"

# settings.json: remove the bypassPermissions file we created; keep the user's own
handle_settings_json "$CLAUDE_DIR"

# Codex
if [ -d "$CODEX_DIR" ]; then
    echo ""
    echo "  --- Codex ---"
    for f in system-prompt.md AGENTS.md; do
        if [ -f "$CODEX_DIR/$f" ]; then
            rm -f "$CODEX_DIR/$f"
            echo "  Removed $f"
        fi
    done
    remove_instructions_file "$CODEX_DIR/config.toml"
fi

echo ""
echo "Uninstall complete. Restart Claude Code / Codex."
