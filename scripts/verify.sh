#!/bin/bash
set -e

CLAUDE_DIR="$HOME/.claude"
CODEX_DIR="$HOME/.codex"
PASS=0
TOTAL=0

echo ""
echo "============================================"
echo "  cc-unlock - Verify Deployment"
echo "============================================"
echo ""

echo "[1/3] Checking Claude Code directory..."
if [ -d "$CLAUDE_DIR" ]; then
    echo "  OK: $CLAUDE_DIR exists"
else
    echo "  FAIL: $CLAUDE_DIR not found"
    exit 1
fi

echo ""
echo "[2/3] Checking Claude Code files..."
for f in CLAUDE.md system-prompt.md config.toml; do
    TOTAL=$((TOTAL + 1))
    if [ -f "$CLAUDE_DIR/$f" ]; then
        SIZE=$(wc -c < "$CLAUDE_DIR/$f" | tr -d ' ')
        echo "  OK: $f ($SIZE bytes)"
        PASS=$((PASS + 1))
    else
        echo "  MISSING: $f"
    fi
done

# settings.json is optional
if [ -f "$CLAUDE_DIR/settings.json" ]; then
    echo "  OK: settings.json (optional)"
fi

echo ""
echo "[3/3] Checking Codex files..."
if [ -d "$CODEX_DIR" ]; then
    for f in system-prompt.md config.toml; do
        TOTAL=$((TOTAL + 1))
        if [ -f "$CODEX_DIR/$f" ]; then
            SIZE=$(wc -c < "$CODEX_DIR/$f" | tr -d ' ')
            echo "  OK: $f ($SIZE bytes)"
            PASS=$((PASS + 1))
        else
            echo "  MISSING: $f"
        fi
    done
else
    echo "  Codex dir not found (not deployed)"
fi

echo ""
echo "============================================"
echo "  Result: $PASS/$TOTAL core files present"
echo "============================================"
echo ""
