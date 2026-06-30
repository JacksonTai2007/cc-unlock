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

echo ""
echo "============================================"
echo "  cc-unlock Uninstall"
echo "============================================"
echo ""

# Remove Claude Code config files
echo "--- Claude Code ---"
for f in CLAUDE.md system-prompt.md; do
    if [ -f "$CLAUDE_DIR/$f" ]; then
        rm -f "$CLAUDE_DIR/$f"
        echo "  Removed $f"
    else
        echo "  $f not found"
    fi
done
remove_instructions_file "$CLAUDE_DIR/config.toml"

# Restore from latest backup
BACKUP_BASE="$CLAUDE_DIR/backups"
if [ -d "$BACKUP_BASE" ]; then
    LATEST=$(ls -1d "$BACKUP_BASE"/cc-unlock-* 2>/dev/null | sort -r | head -1)
    if [ -n "$LATEST" ] && [ -d "$LATEST" ]; then
        echo ""
        echo "  Restoring from: $(basename "$LATEST")"
        for f in CLAUDE.md system-prompt.md settings.json; do
            if [ -f "$LATEST/$f" ]; then
                cp "$LATEST/$f" "$CLAUDE_DIR/$f"
                echo "    Restored $f"
            fi
        done
    fi
fi

# Clean additional directories
for dir in \
    "$HOME/Library/Application Support/claude" \
    "$HOME/Library/Application Support/Claude" \
    "$HOME/Library/Application Support/Claude-3p"; do
    if [ -d "$dir" ]; then
        for f in CLAUDE.md system-prompt.md; do
            rm -f "$dir/$f" 2>/dev/null
        done
        remove_instructions_file "$dir/config.toml" >/dev/null
        echo "  Cleaned $dir"
    fi
done

# Remove Codex config
if [ -d "$CODEX_DIR" ]; then
    echo ""
    echo "--- Codex ---"
    for f in system-prompt.md AGENTS.md; do
        if [ -f "$CODEX_DIR/$f" ]; then
            rm -f "$CODEX_DIR/$f"
            echo "  Removed $f"
        fi
    done
    remove_instructions_file "$CODEX_DIR/config.toml"
    # Restore Codex backup
    CODEX_BACKUP_BASE="$CODEX_DIR/backups"
    if [ -d "$CODEX_BACKUP_BASE" ]; then
        LATEST=$(ls -1d "$CODEX_BACKUP_BASE"/cc-unlock-* 2>/dev/null | sort -r | head -1)
        if [ -n "$LATEST" ] && [ -d "$LATEST" ]; then
            echo "  Restoring from: $(basename "$LATEST")"
            for f in system-prompt.md; do
                [ -f "$LATEST/$f" ] && cp "$LATEST/$f" "$CODEX_DIR/$f" && echo "    Restored $f"
            done
        fi
    fi
fi

echo ""
echo "Uninstall complete. Restart Claude Code / Codex."
echo ""
read -p "Press Enter to exit ..."
