#!/bin/bash
# cc-unlock v5.0 — Verify deployment
set -e

CLAUDE_DIR="$HOME/.claude"
CLAUDE_PROJECTS="$CLAUDE_DIR/projects"
CODEX_DIR="$HOME/.codex"
MEMORY_FILE="security-research-lab.md"

echo ""
echo "============================================"
echo "  cc-unlock v5.0 - Verify Deployment"
echo "============================================"
echo ""

echo "[1/3] Claude Code memory deployments..."
if [ -d "$CLAUDE_PROJECTS" ]; then
    found=0
    for d in "$CLAUDE_PROJECTS"/*/; do
        [ -d "$d" ] || continue
        mem_dir="$d/memory"
        project_name=$(basename "$d")
        if [ -f "$mem_dir/$MEMORY_FILE" ]; then
            SIZE=$(wc -c < "$mem_dir/$MEMORY_FILE" | tr -d ' ')
            echo "  [*] $project_name ($SIZE bytes)"
            found=$((found + 1))
        fi
    done
    if [ $found -eq 0 ]; then
        echo "  No deployments found"
    else
        echo "  $found workspace(s) deployed"
    fi
else
    echo "  No Claude projects found"
fi

echo ""
echo "[2/3] Global settings..."
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    echo "  [ok] settings.json"
else
    echo "  [--] settings.json (not deployed)"
fi

echo ""
echo "[3/3] Codex..."
if [ -d "$CODEX_DIR" ]; then
    for f in system-prompt.md config.toml; do
        if [ -f "$CODEX_DIR/$f" ]; then
            SIZE=$(wc -c < "$CODEX_DIR/$f" | tr -d ' ')
            echo "  [ok] $f ($SIZE bytes)"
        else
            echo "  [--] $f (not deployed)"
        fi
    done
else
    echo "  Codex not deployed"
fi

echo ""
echo "============================================"
echo ""
