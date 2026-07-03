#!/bin/bash
# cc-unlock v5.0 — macOS uninstall
set -e

CLAUDE_DIR="$HOME/.claude"
CLAUDE_PROJECTS="$CLAUDE_DIR/projects"
CODEX_DIR="$HOME/.codex"
MEMORY_FILE="security-research-lab.md"
INDEX_FILE="MEMORY.md"

remove_instructions_file() {
    local cfg="$1"
    [ -f "$cfg" ] || return 0
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
echo "  cc-unlock v5.0 Uninstall"
echo "============================================"
echo ""

# Remove memory from all workspaces
echo "--- Claude Code ---"
if [ -d "$CLAUDE_PROJECTS" ]; then
    count=0
    for d in "$CLAUDE_PROJECTS"/*/; do
        [ -d "$d" ] || continue
        mem_dir="$d/memory"
        project_name=$(basename "$d")

        if [ -f "$mem_dir/$MEMORY_FILE" ]; then
            rm -f "$mem_dir/$MEMORY_FILE"

            # Clean index
            if [ -f "$mem_dir/$INDEX_FILE" ]; then
                tmp="${mem_dir}/${INDEX_FILE}.tmp"
                grep -v 'security-research-lab' "$mem_dir/$INDEX_FILE" > "$tmp" 2>/dev/null || true
                if grep -Eq '[^[:space:]]' "$tmp" 2>/dev/null; then
                    mv "$tmp" "$mem_dir/$INDEX_FILE"
                else
                    rm -f "$tmp" "$mem_dir/$INDEX_FILE"
                fi
            fi

            echo "  [ok] $project_name (removed)"
            count=$((count + 1))
        fi
    done
    echo "  Removed from $count workspace(s)"
else
    echo "  No workspaces found"
fi

# Remove legacy v3.x global files
for f in CLAUDE.md system-prompt.md; do
    [ -f "$CLAUDE_DIR/$f" ] && rm -f "$CLAUDE_DIR/$f" && echo "  Removed legacy $f"
done

# settings.json
SETTINGS_PATH="$CLAUDE_DIR/settings.json"
if [ -f "$SETTINGS_PATH" ]; then
    if grep -q 'bypassPermissions' "$SETTINGS_PATH" 2>/dev/null && \
       grep -q 'skipDangerousModePermissionPrompt' "$SETTINGS_PATH" 2>/dev/null; then
        rm -f "$SETTINGS_PATH"
        echo "  Removed settings.json (cc-unlock)"
    else
        echo "  settings.json kept (user's own)"
    fi
fi

# Codex
if [ -d "$CODEX_DIR" ]; then
    echo ""
    echo "--- Codex ---"
    for f in system-prompt.md AGENTS.md; do
        [ -f "$CODEX_DIR/$f" ] && rm -f "$CODEX_DIR/$f" && echo "  Removed $f"
    done
    remove_instructions_file "$CODEX_DIR/config.toml"
fi

echo ""
echo "Uninstall complete. Restart Claude Code / Codex."
echo "卸载完成，重启 Claude Code / Codex。"
echo ""
