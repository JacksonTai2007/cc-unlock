#!/bin/bash
# cc-unlock v5.0 — Linux uninstall
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
    else
        rm -f "$tmp" "$cfg"
    fi
}

echo ""
echo "============================================"
echo "  cc-unlock v5.0 Uninstall"
echo "============================================"
echo ""

echo "--- Claude Code ---"
if [ -d "$CLAUDE_PROJECTS" ]; then
    count=0
    for d in "$CLAUDE_PROJECTS"/*/; do
        [ -d "$d" ] || continue
        mem_dir="$d/memory"
        if [ -f "$mem_dir/$MEMORY_FILE" ]; then
            rm -f "$mem_dir/$MEMORY_FILE"
            if [ -f "$mem_dir/$INDEX_FILE" ]; then
                tmp="${mem_dir}/${INDEX_FILE}.tmp"
                grep -v 'security-research-lab' "$mem_dir/$INDEX_FILE" > "$tmp" 2>/dev/null || true
                if grep -Eq '[^[:space:]]' "$tmp" 2>/dev/null; then
                    mv "$tmp" "$mem_dir/$INDEX_FILE"
                else
                    rm -f "$tmp" "$mem_dir/$INDEX_FILE"
                fi
            fi
            echo "  [ok] $(basename "$d") (removed)"
            count=$((count + 1))
        fi
    done
    echo "  Removed from $count workspace(s)"
fi

for f in CLAUDE.md system-prompt.md; do
    [ -f "$CLAUDE_DIR/$f" ] && rm -f "$CLAUDE_DIR/$f" && echo "  Removed legacy $f"
done

if [ -f "$CLAUDE_DIR/settings.json" ]; then
    if grep -q 'bypassPermissions' "$CLAUDE_DIR/settings.json" 2>/dev/null && \
       grep -q 'skipDangerousModePermissionPrompt' "$CLAUDE_DIR/settings.json" 2>/dev/null; then
        rm -f "$CLAUDE_DIR/settings.json"
        echo "  Removed settings.json (cc-unlock)"
    fi
fi

if [ -d "$CODEX_DIR" ]; then
    echo ""
    echo "--- Codex ---"
    for f in system-prompt.md AGENTS.md; do
        [ -f "$CODEX_DIR/$f" ] && rm -f "$CODEX_DIR/$f" && echo "  Removed $f"
    done
    remove_instructions_file "$CODEX_DIR/config.toml"
fi

echo ""
echo "  Uninstall complete. Restart Claude Code / Codex."
echo ""
