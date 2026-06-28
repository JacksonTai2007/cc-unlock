#!/bin/bash
set -e

CLAUDE_DIR="$HOME/.claude"
PASS=0
TOTAL=0

echo ""
echo "============================================"
echo "  cc-unlock - Verify Deployment"
echo "============================================"
echo ""

echo "[1/3] Checking config directory..."
if [ -d "$CLAUDE_DIR" ]; then
    echo "  OK: $CLAUDE_DIR exists"
else
    echo "  FAIL: $CLAUDE_DIR not found"
    exit 1
fi

echo ""
echo "[2/3] Checking core files..."
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
echo "[3/3] Checking backups..."
if [ -d "$CLAUDE_DIR/backups" ]; then
    COUNT=$(ls -1d "$CLAUDE_DIR/backups"/cc-unlock-* 2>/dev/null | wc -l | tr -d ' ')
    echo "  Backups: $COUNT"
else
    echo "  No backups directory"
fi

echo ""
echo "============================================"
echo "  Result: $PASS/$TOTAL core files present"
echo "============================================"
echo ""
