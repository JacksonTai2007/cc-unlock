#!/bin/bash
# cc-unlock v2.4-alpha — native Claude Desktop + workspace CLAUDE.md.
# Wrappers may supply SKILL_BUNDLE and CODEX_BUNDLE. Legacy MEMORY_BUNDLE,
# SUBAGENT and agent/rule bundles are intentionally ignored, never executed.
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
: "${CLAUDE_BUNDLE:=$_LIB_DIR/claude-config-bundle}"
: "${SKILL_BUNDLE:=$_LIB_DIR/skill-bundle}"
: "${CODEX_BUNDLE:=$_LIB_DIR/../codex-files/codex-config-bundle}"
CLAUDE_DIR="$HOME/.claude"
CLAUDE_PROJECTS="$CLAUDE_DIR/projects"
CODEX_DIR="$HOME/.codex"
SKILL_DIRS="sec-forge"
banner() { echo 'cc-unlock v2.4-alpha | CLAUDE.md + sec-forge | no Desktop patch'; }
footer() { echo '[OK] Complete. Start a new native Claude Code session to test loading.'; }
no_link_path() {
    local p="$1" parent
    while [ -n "$p" ] && [ "$p" != '/' ] && [ "$p" != '.' ]; do
        [ ! -L "$p" ] || { echo "[FAIL] Refusing linked target: $p" >&2; return 1; }
        parent=$(dirname "$p")
        [ "$parent" != "$p" ] || break
        p="$parent"
    done
}
copy_skill_tree() {
    local src="$1" dst="$2"
    [ -d "$src" ] || { echo "[FAIL] Missing skill bundle: $src" >&2; return 1; }
    no_link_path "$dst" || return 1
    if [ -d "$dst" ] && [ -n "$(find "$dst" -type l -print -quit 2>/dev/null)" ]; then
        echo "[FAIL] Linked content in skill target: $dst" >&2; return 1
    fi
    mkdir -p "$dst" && cp -R "$src/." "$dst/"
}
remove_matching_tree() {
    local src="$1" dst="$2" f rel target failed=0
    [ -d "$src" ] && [ -d "$dst" ] || return 0
    no_link_path "$dst" || return 1
    while IFS= read -r -d '' f; do
        rel=${f#"$src/"}; target="$dst/$rel"
        no_link_path "$target" || { failed=1; continue; }
        if [ -f "$target" ] && cmp -s "$f" "$target"; then rm -f "$target" || failed=1; fi
    done < <(find "$src" -type f -print0)
    return "$failed"
}
deploy_claude() {
    local ws="$1" src="$CLAUDE_BUNDLE/CLAUDE.md" dst="$1/CLAUDE.md"
    [ -f "$src" ] || { echo "[FAIL] Missing bundle: $src" >&2; return 1; }
    no_link_path "$dst" || return 1
    if [ -e "$dst" ] && ! cmp -s "$src" "$dst" && [ "${CC_UNLOCK_OVERWRITE:-0}" != '1' ]; then
        echo '[FAIL] Existing CLAUDE.md differs. Inspect it; set CC_UNLOCK_OVERWRITE=1 to replace explicitly.' >&2
        return 1
    fi
    cp "$src" "$dst" || return 1
    if [ "${SKIP_SKILL:-0}" != '1' ]; then copy_skill_tree "$SKILL_BUNDLE/sec-forge" "$ws/.claude/skills/sec-forge" || return 1; fi
    echo "[OK] $dst + sec-forge; memory/subagent/global settings unchanged"
}
uninstall_claude() {
    local ws="$1" src="$CLAUDE_BUNDLE/CLAUDE.md" dst="$1/CLAUDE.md"
    no_link_path "$dst" || return 1
    if [ -f "$dst" ] && cmp -s "$src" "$dst"; then rm -f "$dst" || return 1
    else echo '[KEEP] CLAUDE.md absent or user-modified'; fi
    remove_matching_tree "$SKILL_BUNDLE/sec-forge" "$ws/.claude/skills/sec-forge" || return 1
    echo '[KEEP] Personal memory, agents, rules, agent-memory and global settings untouched'
}
verify_claude() {
    local ws="$1" f rel
    cmp -s "$CLAUDE_BUNDLE/CLAUDE.md" "$ws/CLAUDE.md" || { echo '[FAIL] CLAUDE.md missing or different'; return 1; }
    if [ "${SKIP_SKILL:-0}" != '1' ]; then
        while IFS= read -r -d '' f; do
            rel=${f#"$SKILL_BUNDLE/sec-forge/"}
            cmp -s "$f" "$ws/.claude/skills/sec-forge/$rel" || { echo "[FAIL] Skill mismatch: $rel"; return 1; }
        done < <(find "$SKILL_BUNDLE/sec-forge" -type f -print0)
    fi
    echo '[OK] CLAUDE.md + sec-forge; no memory/subagent deployment'
}
list_workspaces() {
    echo 'Historical project IDs (not deployment destinations):'
    local d
    for d in "$CLAUDE_PROJECTS"/*/; do [ -d "$d" ] && basename "$d"; done
    return 0
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
    # AGENTS.md — 叠加在 base 之上的冗余人格层（v2.0-stable 部署它，不再删除）
    if [ -f "$CODEX_BUNDLE/AGENTS.md" ]; then
        if cp "$CODEX_BUNDLE/AGENTS.md" "$CODEX_DIR/AGENTS.md" 2>/dev/null; then
            local asz
            asz=$(wc -c < "$CODEX_DIR/AGENTS.md" 2>/dev/null | tr -d ' ')
            echo "  [ok] AGENTS.md ($asz bytes) — 冗余人格层"
        else
            echo "  [FAIL] AGENTS.md"
        fi
    fi
    ensure_instructions_file "$CODEX_DIR/config.toml"
    echo "  [ok] config.toml — model_instructions_file (merged)"


    deploy_codex_skills
    return 0
}

# --- Codex skills -> ~/.codex/skills/ ---
deploy_codex_skills() {
    [ -d "$SKILL_BUNDLE" ] || return 0
    echo ""
    echo "--- Codex Skills ---"
    local skills_dir="$CODEX_DIR/skills" d n
    mkdir -p "$skills_dir"
    for d in $SKILL_DIRS; do
        if [ -d "$SKILL_BUNDLE/$d" ]; then
            if copy_skill_tree "$SKILL_BUNDLE/$d" "$skills_dir/$d"; then
                n=$(find "$skills_dir/$d" -type f 2>/dev/null | wc -l | tr -d ' ')
                echo "  [ok] skills/$d/ ($n files)"
            else
                echo "  [FAIL] skills/$d"
            fi
        fi
    done
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


    local d rmn=0
    for d in $SKILL_DIRS; do
        if [ -d "$CODEX_DIR/skills/$d" ]; then remove_matching_tree "$SKILL_BUNDLE/$d" "$CODEX_DIR/skills/$d" && rmn=$((rmn+1)); fi
    done
    [ "$rmn" -gt 0 ] && echo "  [ok] Removed $rmn skill(s) from ~/.codex/skills"
    rmdir "$CODEX_DIR/skills" 2>/dev/null
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
    if [ -f "$CODEX_DIR/AGENTS.md" ]; then
        sz=$(wc -c < "$CODEX_DIR/AGENTS.md" 2>/dev/null | tr -d ' ')
        echo "  AGENTS.md - OK ($sz bytes)"
    else
        echo "  AGENTS.md - MISSING"
    fi
    local d sok=0 stot=0
    for d in $SKILL_DIRS; do stot=$((stot+1)); [ -d "$CODEX_DIR/skills/$d" ] && sok=$((sok+1)); done
    if [ "$sok" = "$stot" ]; then echo "  skills - OK ($sok/$stot)"; else echo "  skills - PARTIAL ($sok/$stot)"; fi
}


# cc_dispatch install|uninstall [workspace|--verify workspace|--codex|--list]
cc_dispatch() {
    local op="$1" arg ws
    shift
    case "$op" in install|uninstall) ;; *) echo "[FAIL] Unknown operation: $op" >&2; return 1;; esac
    banner
    arg="${1:-}"
    case "$arg" in
        --list|-l|list) list_workspaces ;;
        --all|-a|all)
            echo '[FAIL] --all disabled: encoded project names are not reliable workspace paths. Supply an explicit workspace.' >&2
            return 1 ;;
        --codex|-c|codex)
            if [ "$op" = 'uninstall' ]; then uninstall_codex; else deploy_codex; fi ;;
        --verify|-v|verify)
            ws="${2:-}"
            [ -n "$ws" ] && [ -d "$ws" ] || { echo '[FAIL] --verify requires a workspace path' >&2; return 1; }
            verify_claude "$(cd "$ws" && pwd -P)" ;;
        '')
            echo 'Usage: install.sh WORKSPACE | --verify WORKSPACE | --codex | --list'
            echo 'Claude deploys only CLAUDE.md + sec-forge; Codex is separate.' ;;
        --*) echo "[FAIL] Unsupported or removed option: $arg" >&2; return 1 ;;
        *)
            [ -d "$arg" ] || { echo "[FAIL] Workspace not found: $arg" >&2; return 1; }
            no_link_path "$arg" || return 1
            ws="$(cd "$arg" && pwd -P)" || return 1
            if [ "$op" = 'uninstall' ]; then uninstall_claude "$ws" || return 1
            else deploy_claude "$ws" || return 1; fi
            footer ;;
    esac
}
