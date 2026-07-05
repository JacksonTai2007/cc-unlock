#!/bin/bash
# cc-unlock v5.0 — shared deploy/uninstall library for macOS & Linux
# 与 Windows deploy.ps1 功能对齐的共享实现，供 mac/linux 的 install/uninstall 封装脚本调用。
# Shared implementation mirroring Windows deploy.ps1, sourced by the mac/linux wrappers.
#
# 调用方在 source 本文件前必须设置 | Caller must set before sourcing:
#   MEMORY_BUNDLE   memory-bundle 目录
#   CONFIG_BUNDLE   config-bundle 目录
#   CODEX_BUNDLE    codex-config-bundle 目录
# 然后调用 | Then call:
#   cc_dispatch install|uninstall "$@"
#
# 注意：不使用 set -e。所有失败路径显式处理，避免单个非零返回值导致 Codex 段被跳过。
# Note: deliberately no `set -e`. Every failure is handled explicitly so a single
# non-zero return never skips the Codex deployment step (the v5.0.x bug).

CLAUDE_DIR="$HOME/.claude"
CLAUDE_PROJECTS="$CLAUDE_DIR/projects"
CODEX_DIR="$HOME/.codex"
MEMORY_FILE="security-research-lab.md"
INDEX_FILE="MEMORY.md"
CLAUDE_MD="CLAUDE.md"
MARKER="Security Research Workstation"
SETTINGS_MARKER1="bypassPermissions"
SETTINGS_MARKER2="skipDangerousModePermissionPrompt"

# 工作区路径 -> Claude 项目目录名 | Workspace path -> Claude projects dir name
# 与 deploy.ps1 的 ConvertTo-ClaudeProjectPath 一致：/ : 空格 -> -
encode_path() {
    local p="$1"
    p="${p%/}"
    printf '%s\n' "$p" | sed 's|/|-|g; s|:|-|g; s| |-|g'
}

banner() {
    echo ""
    echo "============================================"
    echo "  cc-unlock v5.0"
    echo "  Memory-based security research authorization"
    echo "  基于 memory 的安全研究授权配置"
    echo "============================================"
    echo ""
}

footer() {
    echo ""
    echo "============================================"
    echo "  [OK] Complete! / 完成！"
    echo "  Restart Claude Code / Codex. / 重启生效。"
    echo "============================================"
    echo ""
}

# 从模板 MEMORY.md 取出索引行，避免在脚本里硬编码中文
# Extract index entry from template so Chinese isn't hardcoded in the script
index_entry() {
    [ -f "$MEMORY_BUNDLE/$INDEX_FILE" ] || return 0
    grep 'security-research-lab' "$MEMORY_BUNDLE/$INDEX_FILE" 2>/dev/null | head -n 1
}

# --- 部署到单个工作区 memory 目录 | Deploy to one workspace memory dir ---
# args: mem_dir  label  [workspace_path]
deploy_memory() {
    local mem_dir="$1" label="$2" ws="$3"
    mkdir -p "$mem_dir"

    # 1. security-research-lab.md -> memory/
    if cp "$MEMORY_BUNDLE/$MEMORY_FILE" "$mem_dir/$MEMORY_FILE" 2>/dev/null; then
        echo "    [ok] $MEMORY_FILE"
    else
        echo "    [FAIL] $MEMORY_FILE"
    fi

    # 2. MEMORY.md 索引（合并，不覆盖用户已有条目）| MEMORY.md index (merge)
    if [ -f "$mem_dir/$INDEX_FILE" ]; then
        if ! grep -q 'security-research-lab' "$mem_dir/$INDEX_FILE" 2>/dev/null; then
            local entry
            entry="$(index_entry)"
            if [ -n "$entry" ]; then
                # 追加前确保文件以换行结尾 | ensure trailing newline before append
                if [ -n "$(tail -c 1 "$mem_dir/$INDEX_FILE" 2>/dev/null)" ]; then
                    printf '\n' >> "$mem_dir/$INDEX_FILE"
                fi
                printf '%s\n' "$entry" >> "$mem_dir/$INDEX_FILE"
            fi
        fi
        echo "    [ok] $INDEX_FILE (merged)"
    else
        if cp "$MEMORY_BUNDLE/$INDEX_FILE" "$mem_dir/$INDEX_FILE" 2>/dev/null; then
            echo "    [ok] $INDEX_FILE"
        else
            echo "    [FAIL] $INDEX_FILE"
        fi
    fi

    # 3. CLAUDE.md -> 工作区根目录（仅当已知真实路径）| CLAUDE.md -> workspace root
    if [ -n "$ws" ] && [ -d "$ws" ] && [ -f "$MEMORY_BUNDLE/$CLAUDE_MD" ]; then
        if cp "$MEMORY_BUNDLE/$CLAUDE_MD" "$ws/$CLAUDE_MD" 2>/dev/null; then
            echo "    [ok] $CLAUDE_MD -> workspace"
        else
            echo "    [FAIL] $CLAUDE_MD"
        fi
    fi

    echo "  [OK] $label"
}

# --- 从工作区移除 | Remove from workspace ---
# args: mem_dir  label  [workspace_path]
remove_memory() {
    local mem_dir="$1" label="$2" ws="$3"

    if [ -f "$mem_dir/$MEMORY_FILE" ]; then
        rm -f "$mem_dir/$MEMORY_FILE"
        echo "    [ok] Removed $MEMORY_FILE"
    fi

    if [ -f "$mem_dir/$INDEX_FILE" ]; then
        local tmp="$mem_dir/$INDEX_FILE.cc-unlock.tmp"
        grep -v 'security-research-lab' "$mem_dir/$INDEX_FILE" > "$tmp" 2>/dev/null
        if grep -q '[^[:space:]]' "$tmp" 2>/dev/null; then
            mv "$tmp" "$mem_dir/$INDEX_FILE"
            echo "    [ok] $INDEX_FILE (cleaned entry)"
        else
            rm -f "$tmp" "$mem_dir/$INDEX_FILE"
            echo "    [ok] Removed $INDEX_FILE"
        fi
    fi

    # 工作区 CLAUDE.md —— 仅当是我们部署的（含标记）| workspace CLAUDE.md (only if ours)
    if [ -n "$ws" ] && [ -f "$ws/$CLAUDE_MD" ]; then
        if grep -q "$MARKER" "$ws/$CLAUDE_MD" 2>/dev/null; then
            rm -f "$ws/$CLAUDE_MD"
            echo "    [ok] Removed $CLAUDE_MD from workspace"
        fi
    fi

    echo "  [OK] $label (removed)"
}

# --- 验证单个工作区 | Verify one workspace ---
verify_memory() {
    local mem_dir="$1" label="$2" ws="$3" sz
    if [ -f "$mem_dir/$MEMORY_FILE" ]; then
        sz=$(wc -c < "$mem_dir/$MEMORY_FILE" 2>/dev/null | tr -d ' ')
        echo "    $MEMORY_FILE - OK ($sz bytes)"
    else
        echo "    $MEMORY_FILE - MISSING"
    fi
    if [ -f "$mem_dir/$INDEX_FILE" ]; then
        if grep -q 'security-research-lab' "$mem_dir/$INDEX_FILE" 2>/dev/null; then
            echo "    $INDEX_FILE - OK"
        else
            echo "    $INDEX_FILE - ENTRY MISSING"
        fi
    else
        echo "    $INDEX_FILE - MISSING"
    fi
    if [ -n "$ws" ] && [ -f "$ws/$CLAUDE_MD" ]; then
        sz=$(wc -c < "$ws/$CLAUDE_MD" 2>/dev/null | tr -d ' ')
        echo "    $CLAUDE_MD (workspace) - OK ($sz bytes)"
    fi
}

# --- settings.json (全局 ~/.claude/) ---
deploy_settings() {
    local sp="$CLAUDE_DIR/settings.json"
    if [ "$SKIP_SETTINGS" = "1" ]; then
        echo "  [skip] settings.json (SkipSettings)"
        return 0
    fi
    if [ -f "$sp" ]; then
        echo "  [skip] settings.json (exists)"
        return 0
    fi
    if [ -f "$CONFIG_BUNDLE/settings.json" ]; then
        mkdir -p "$CLAUDE_DIR"
        if cp "$CONFIG_BUNDLE/settings.json" "$sp" 2>/dev/null; then
            echo "  [ok] settings.json (bypassPermissions)"
        else
            echo "  [FAIL] settings.json"
        fi
    fi
}

remove_settings() {
    local sp="$CLAUDE_DIR/settings.json"
    [ -f "$sp" ] || return 0
    if grep -q "$SETTINGS_MARKER1" "$sp" 2>/dev/null && grep -q "$SETTINGS_MARKER2" "$sp" 2>/dev/null; then
        rm -f "$sp"
        echo "  [ok] Removed settings.json (cc-unlock)"
    else
        echo "  [skip] settings.json (user customized)"
    fi
}

# --- Codex config.toml 合并式写入/剥离 | merge/strip the instructions line ---
ensure_instructions_file() {
    local cfg="$1"
    local line='model_instructions_file = "system-prompt.md"'
    if [ ! -f "$cfg" ]; then
        printf '%s\n' "$line" > "$cfg"
        return 0
    fi
    local tmp="$cfg.cc-unlock.tmp"
    {
        printf '%s\n' "$line"
        grep -Ev '^[[:space:]]*model_instructions_file[[:space:]]*=' "$cfg" 2>/dev/null
    } > "$tmp"
    mv "$tmp" "$cfg"
}

# echo: absent | kept | removed
remove_instructions_file() {
    local cfg="$1"
    [ -f "$cfg" ] || { echo "absent"; return 0; }
    local tmp="$cfg.cc-unlock.tmp"
    grep -Ev '^[[:space:]]*model_instructions_file[[:space:]]*=' "$cfg" > "$tmp" 2>/dev/null
    if grep -q '[^[:space:]]' "$tmp" 2>/dev/null; then
        mv "$tmp" "$cfg"
        echo "kept"
    else
        rm -f "$tmp" "$cfg"
        echo "removed"
    fi
}

deploy_codex() {
    echo ""
    echo "--- Codex ---"
    if [ ! -f "$CODEX_BUNDLE/system-prompt.md" ]; then
        echo "  [skip] Codex bundle not found: $CODEX_BUNDLE"
        return 0
    fi
    mkdir -p "$CODEX_DIR"
    if cp "$CODEX_BUNDLE/system-prompt.md" "$CODEX_DIR/system-prompt.md" 2>/dev/null; then
        local sz
        sz=$(wc -c < "$CODEX_DIR/system-prompt.md" 2>/dev/null | tr -d ' ')
        echo "  [ok] system-prompt.md ($sz bytes)"
    else
        echo "  [FAIL] system-prompt.md"
    fi
    ensure_instructions_file "$CODEX_DIR/config.toml"
    echo "  [ok] config.toml (merged)"
    if [ -f "$CODEX_DIR/AGENTS.md" ]; then
        rm -f "$CODEX_DIR/AGENTS.md"
        echo "  [ok] Cleaned old AGENTS.md"
    fi
    return 0
}

uninstall_codex() {
    [ -d "$CODEX_DIR" ] || return 0
    echo ""
    echo "--- Codex ---"
    local f
    for f in system-prompt.md AGENTS.md; do
        if [ -f "$CODEX_DIR/$f" ]; then
            rm -f "$CODEX_DIR/$f"
            echo "  [ok] Removed $f"
        fi
    done
    local r
    r=$(remove_instructions_file "$CODEX_DIR/config.toml")
    case "$r" in
        removed) echo "  [ok] Removed config.toml" ;;
        kept)    echo "  [ok] config.toml (kept other settings)" ;;
    esac
    return 0
}

verify_codex() {
    if [ ! -d "$CODEX_DIR" ]; then
        echo "  [skip] Codex not deployed"
        return 0
    fi
    echo ""
    echo "--- Codex ---"
    local sz
    if [ -f "$CODEX_DIR/system-prompt.md" ]; then
        sz=$(wc -c < "$CODEX_DIR/system-prompt.md" 2>/dev/null | tr -d ' ')
        if grep -q 'cc-unlock' "$CODEX_DIR/system-prompt.md" 2>/dev/null; then
            echo "  system-prompt.md - OK ($sz bytes)"
        else
            echo "  system-prompt.md - CONTENT MISMATCH"
        fi
    else
        echo "  system-prompt.md - MISSING"
    fi
    if [ -f "$CODEX_DIR/config.toml" ]; then
        sz=$(wc -c < "$CODEX_DIR/config.toml" 2>/dev/null | tr -d ' ')
        if grep -q 'system-prompt.md' "$CODEX_DIR/config.toml" 2>/dev/null; then
            echo "  config.toml - OK ($sz bytes)"
        else
            echo "  config.toml - CONTENT MISMATCH"
        fi
    else
        echo "  config.toml - MISSING"
    fi
}

# --- 清理 v3.x 全局遗留 | Clean legacy v3.x global deployment ---
clean_legacy() {
    local f
    for f in CLAUDE.md system-prompt.md; do
        if [ -f "$CLAUDE_DIR/$f" ]; then
            rm -f "$CLAUDE_DIR/$f"
            echo "  [migrate] Removed legacy $f from ~/.claude/"
        fi
    done
    if [ -f "$CLAUDE_DIR/config.toml" ]; then
        local r
        r=$(remove_instructions_file "$CLAUDE_DIR/config.toml")
        [ "$r" = "removed" ] && echo "  [migrate] Removed legacy config.toml from ~/.claude/"
    fi
}

list_workspaces() {
    echo "  Workspaces / 工作区:"
    echo ""
    if [ ! -d "$CLAUDE_PROJECTS" ]; then
        echo "  No Claude projects found."
        echo ""
        return 0
    fi
    local d name
    for d in "$CLAUDE_PROJECTS"/*/; do
        [ -d "$d" ] || continue
        name=$(basename "$d")
        if [ -f "$d/memory/$MEMORY_FILE" ]; then
            echo "  [*] $name"
        else
            echo "  [ ] $name"
        fi
    done
    echo ""
    echo "  [*] = memory deployed"
    echo ""
}

do_verify() {
    echo "  Verifying deployment / 验证部署..."
    echo ""
    echo "  --- Claude Code ---"
    if [ -d "$CLAUDE_PROJECTS" ]; then
        local d name
        for d in "$CLAUDE_PROJECTS"/*/; do
            [ -d "$d" ] || continue
            name=$(basename "$d")
            if [ -f "$d/memory/$MEMORY_FILE" ]; then
                echo "  $name"
                verify_memory "$d/memory" "$name" ""
            fi
        done
    fi
    [ -f "$CLAUDE_DIR/settings.json" ] && echo "    settings.json - OK"
    verify_codex
    echo ""
}

# --- 安装动作 | Install actions ---
do_install_path() {
    local ws="$1"
    if [ ! -d "$ws" ]; then
        echo "  [!] Path not found: $ws"
        return 1
    fi
    local name mem_dir
    name=$(encode_path "$ws")
    mem_dir="$CLAUDE_PROJECTS/$name/memory"
    echo "--- Claude Code ---"
    echo "  Workspace: $ws"
    echo "  Project:   $name"
    echo ""
    deploy_memory "$mem_dir" "$name" "$ws"
    deploy_settings
    clean_legacy
    deploy_codex
}

do_install_all() {
    echo "--- Claude Code ---"
    if [ ! -d "$CLAUDE_PROJECTS" ]; then
        echo "  No Claude projects found."
        echo "  Deploy to a workspace path or use --codex first."
        return 0
    fi
    local d name count=0
    for d in "$CLAUDE_PROJECTS"/*/; do
        [ -d "$d" ] || continue
        name=$(basename "$d")
        deploy_memory "$d/memory" "$name" ""
        count=$((count + 1))
    done
    deploy_settings
    clean_legacy
    deploy_codex
    echo ""
    echo "  [OK] Deployed to $count workspace(s)"
}

# --- 卸载动作 | Uninstall actions ---
do_uninstall_path() {
    local ws="$1"
    local name mem_dir
    name=$(encode_path "$ws")
    mem_dir="$CLAUDE_PROJECTS/$name/memory"
    echo "--- Claude Code ---"
    if [ -f "$mem_dir/$MEMORY_FILE" ]; then
        remove_memory "$mem_dir" "$name" "$ws"
    else
        echo "  [skip] Not deployed: $name"
        if [ -f "$ws/$CLAUDE_MD" ] && grep -q "$MARKER" "$ws/$CLAUDE_MD" 2>/dev/null; then
            rm -f "$ws/$CLAUDE_MD"
            echo "  [ok] Removed $CLAUDE_MD from workspace"
        fi
    fi
    remove_settings
    uninstall_codex
}

do_uninstall_all() {
    echo "--- Claude Code ---"
    local d name count=0
    if [ -d "$CLAUDE_PROJECTS" ]; then
        for d in "$CLAUDE_PROJECTS"/*/; do
            [ -d "$d" ] || continue
            name=$(basename "$d")
            if [ -f "$d/memory/$MEMORY_FILE" ]; then
                remove_memory "$d/memory" "$name" ""
                count=$((count + 1))
            fi
        done
    fi
    echo "  Removed from $count workspace(s)"
    remove_settings
    uninstall_codex
}

# --- 交互菜单 | Interactive menus ---
install_menu() {
    echo "Select mode / 选择模式:"
    echo "  [1] Deploy to a workspace (enter path) / 部署到指定工作区"
    echo "  [2] Deploy to all existing workspaces / 部署到所有已有工作区"
    echo "  [3] Deploy Codex only / 仅部署 Codex"
    echo "  [4] List workspaces / 列出工作区"
    echo "  [0] Exit / 退出"
    echo ""
    printf "  Select / 选择: "
    local mode ws
    read -r mode
    case "$mode" in
        1)
            echo ""
            printf "  Workspace path / 工作区路径: "
            read -r ws
            do_install_path "$ws" && footer
            ;;
        2) do_install_all; footer ;;
        3) deploy_codex; echo ""; echo "  Restart Codex. / 重启 Codex 生效。"; echo "" ;;
        4) list_workspaces ;;
        *) echo "  [cancelled]" ;;
    esac
}

uninstall_menu() {
    echo "Select mode / 选择模式:"
    echo "  [1] Remove from a workspace (enter path) / 从指定工作区移除"
    echo "  [2] Remove from all workspaces / 从全部工作区移除"
    echo "  [3] List workspaces / 列出工作区"
    echo "  [0] Exit / 退出"
    echo ""
    printf "  Select / 选择: "
    local mode ws
    read -r mode
    case "$mode" in
        1)
            echo ""
            printf "  Workspace path / 工作区路径: "
            read -r ws
            do_uninstall_path "$ws"; footer
            ;;
        2) do_uninstall_all; footer ;;
        3) list_workspaces ;;
        *) echo "  [cancelled]" ;;
    esac
}

# --- 主分发 | Main dispatcher ---
# cc_dispatch install|uninstall "$@"
cc_dispatch() {
    local op="$1"
    shift

    banner

    # 安装时校验源文件存在 | install requires source bundle
    if [ "$op" = "install" ] && [ ! -f "$MEMORY_BUNDLE/$MEMORY_FILE" ]; then
        echo "[!] Source files not found: $MEMORY_BUNDLE"
        exit 1
    fi

    local arg="${1:-}"
    case "$arg" in
        --list|-l|list)
            list_workspaces
            ;;
        --verify|-v|verify)
            do_verify
            ;;
        --codex|-c|codex)
            if [ "$op" = "uninstall" ]; then uninstall_codex; else deploy_codex; fi
            echo ""
            echo "  Restart Codex. / 重启 Codex 生效。"
            echo ""
            ;;
        --all|-a|all)
            if [ "$op" = "uninstall" ]; then do_uninstall_all; else do_install_all; fi
            footer
            ;;
        "")
            if [ "$op" = "uninstall" ]; then uninstall_menu; else install_menu; fi
            ;;
        *)
            # 视为工作区路径 | treat as workspace path
            if [ "$op" = "uninstall" ]; then
                do_uninstall_path "$arg"
            else
                do_install_path "$arg"
            fi
            footer
            ;;
    esac
}
