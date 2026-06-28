#!/bin/bash
set -e

CLAUDE_DIR="$HOME/.claude"

echo ""
echo "============================================"
echo "  cc-unlock Uninstall"
echo "============================================"
echo ""

# Remove config files
for f in CLAUDE.md system-prompt.md config.toml; do
    if [ -f "$CLAUDE_DIR/$f" ]; then
        rm -f "$CLAUDE_DIR/$f"
        echo "  Removed $f"
    else
        echo "  $f not found"
    fi
done

# Restore from latest backup
BACKUP_BASE="$CLAUDE_DIR/backups"
if [ -d "$BACKUP_BASE" ]; then
    LATEST=$(ls -1d "$BACKUP_BASE"/cc-unlock-* 2>/dev/null | sort -r | head -1)
    if [ -n "$LATEST" ] && [ -d "$LATEST" ]; then
        echo ""
        echo "  Restoring from: $(basename "$LATEST")"
        for f in CLAUDE.md system-prompt.md config.toml settings.json; do
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
        for f in CLAUDE.md system-prompt.md config.toml; do
            rm -f "$dir/$f" 2>/dev/null
        done
        echo "  Cleaned $dir"
    fi
done

echo ""
echo "Uninstall complete. Restart Claude Code."
echo ""
read -p "Press Enter to exit ..."
