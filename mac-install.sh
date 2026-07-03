#!/bin/bash
# cc-unlock v5.0 — macOS install
# Memory-based security research authorization for Claude Code + Codex
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEMORY_BUNDLE="$SCRIPT_DIR/cc-unlock-files/memory-bundle"
CONFIG_BUNDLE="$SCRIPT_DIR/cc-unlock-files/config-bundle"
CODEX_BUNDLE="$SCRIPT_DIR/codex-files/codex-config-bundle"
CLAUDE_DIR="$HOME/.claude"
CLAUDE_PROJECTS="$CLAUDE_DIR/projects"
CODEX_DIR="$HOME/.codex"
MEMORY_FILE="security-research-lab.md"
INDEX_FILE="MEMORY.md"

encode_path() {
    local p="$1"
    p="${p%/}"
    echo "$p" | sed 's|/|-|g; s/ /-/g'
}

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

deploy_memory() {
    local workspace="$1"
    local project_name
    project_name=$(encode_path "$workspace")
    local mem_dir="$CLAUDE_PROJECTS/$project_name/memory"

    mkdir -p "$mem_dir"

    # security-research-lab.md
    if cp "$MEMORY_BUNDLE/$MEMORY_FILE" "$mem_dir/$MEMORY_FILE" 2>/dev/null; then
        echo "    [ok] $MEMORY_FILE"
    else
        echo "    [FAIL] $MEMORY_FILE"
    fi

    # MEMORY.md index
    if [ -f "$mem_dir/$INDEX_FILE" ]; then
        if ! grep -q 'security-research-lab' "$mem_dir/$INDEX_FILE" 2>/dev/null; then
            grep 'security-research-lab' "$MEMORY_BUNDLE/$INDEX_FILE" >> "$mem_dir/$INDEX_FILE"
        fi
        echo "    [ok] $INDEX_FILE (merged)"
    else
        cp "$MEMORY_BUNDLE/$INDEX_FILE" "$mem_dir/$INDEX_FILE" 2>/dev/null
        echo "    [ok] $INDEX_FILE"
    fi

    # CLAUDE.md -> workspace root
    if [ -d "$workspace" ] && [ -f "$MEMORY_BUNDLE/CLAUDE.md" ]; then
        cp "$MEMORY_BUNDLE/CLAUDE.md" "$workspace/CLAUDE.md" 2>/dev/null
        echo "    [ok] CLAUDE.md -> workspace"
    fi

    echo "  [OK] $project_name"
}

echo ""
echo "============================================"
echo "  cc-unlock v5.0"
echo "  Memory-based security research authorization"
echo "  基于 memory 的安全研究授权配置"
echo "============================================"
echo ""

# Check source
if [ ! -f "$MEMORY_BUNDLE/$MEMORY_FILE" ]; then
    echo "[!] Source files not found: $MEMORY_BUNDLE"
    exit 1
fi

echo "--- Claude Code ---"
echo ""
echo "Select mode / 选择模式:"
echo "  [1] Deploy to a workspace (enter path) / 部署到指定工作区"
echo "  [2] Deploy to all existing workspaces / 部署到所有已有工作区"
echo ""
printf "  Select / 选择 (1/2): "
read -r mode

case "$mode" in
    1)
        echo ""
        printf "  Workspace path / 工作区路径: "
        read -r ws_path
        if [ ! -d "$ws_path" ]; then
            echo "  [!] Path not found: $ws_path"
            exit 1
        fi
        deploy_memory "$ws_path"
        ;;
    2)
        if [ ! -d "$CLAUDE_PROJECTS" ]; then
            echo "  No Claude projects found."
            exit 0
        fi
        count=0
        for d in "$CLAUDE_PROJECTS"/*/; do
            [ -d "$d" ] || continue
            project_name=$(basename "$d")
            mem_dir="$d/memory"
            mkdir -p "$mem_dir"
            cp "$MEMORY_BUNDLE/$MEMORY_FILE" "$mem_dir/$MEMORY_FILE" 2>/dev/null
            if [ -f "$mem_dir/$INDEX_FILE" ]; then
                if ! grep -q 'security-research-lab' "$mem_dir/$INDEX_FILE" 2>/dev/null; then
                    grep 'security-research-lab' "$MEMORY_BUNDLE/$INDEX_FILE" >> "$mem_dir/$INDEX_FILE"
                fi
            else
                cp "$MEMORY_BUNDLE/$INDEX_FILE" "$mem_dir/$INDEX_FILE" 2>/dev/null
            fi
            echo "  [ok] $project_name"
            count=$((count + 1))
        done
        echo ""
        echo "  Deployed to $count workspace(s)"
        ;;
    *)
        echo "  [cancelled]"
        exit 0
        ;;
esac

# settings.json (global)
SETTINGS_PATH="$CLAUDE_DIR/settings.json"
if [ ! -f "$SETTINGS_PATH" ] && [ -f "$CONFIG_BUNDLE/settings.json" ]; then
    mkdir -p "$CLAUDE_DIR"
    cp "$CONFIG_BUNDLE/settings.json" "$SETTINGS_PATH"
    echo "  [ok] settings.json (bypassPermissions)"
else
    echo "  [skip] settings.json (exists or skipped)"
fi

# Clean legacy v3.x global files
for f in CLAUDE.md system-prompt.md; do
    [ -f "$CLAUDE_DIR/$f" ] && rm -f "$CLAUDE_DIR/$f" && echo "  [migrate] Removed legacy $f"
done

# Deploy Codex
if [ -f "$CODEX_BUNDLE/system-prompt.md" ]; then
    echo ""
    echo "--- Codex ---"
    mkdir -p "$CODEX_DIR"
    cp "$CODEX_BUNDLE/system-prompt.md" "$CODEX_DIR/system-prompt.md" 2>/dev/null
    echo "  [ok] system-prompt.md"
    ensure_instructions_file "$CODEX_DIR/config.toml"
    echo "  [ok] config.toml (merged)"
    [ -f "$CODEX_DIR/AGENTS.md" ] && rm -f "$CODEX_DIR/AGENTS.md"
fi

echo ""
echo "============================================"
echo "  [OK] Deploy complete!"
echo "  Restart Claude Code / Codex."
echo "  重启 Claude Code / Codex 生效。"
echo "============================================"
echo ""
