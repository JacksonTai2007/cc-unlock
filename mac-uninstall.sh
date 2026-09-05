#!/bin/bash
# cc-unlock v2.0-stable — macOS uninstall
#
# 用法 | Usage:
#   ./mac-uninstall.sh                      交互菜单 | interactive menu
#   ./mac-uninstall.sh /path/to/workspace   从指定工作区移除 | remove from a workspace
#   ./mac-uninstall.sh --all                从所有工作区移除 | remove from all
#   ./mac-uninstall.sh --codex              仅移除 Codex | Codex only
#   ./mac-uninstall.sh --list               列出工作区 | list workspaces

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEMORY_BUNDLE="$SCRIPT_DIR/cc-unlock-files/memory-bundle"
CONFIG_BUNDLE="$SCRIPT_DIR/cc-unlock-files/config-bundle"
SKILL_BUNDLE="$SCRIPT_DIR/cc-unlock-files/skill-bundle"
CODEX_BUNDLE="$SCRIPT_DIR/codex-files/codex-config-bundle"
CODEX_MEMORY_BUNDLE="$SCRIPT_DIR/codex-files/codex-memory-bundle"
CODEX_ROLLOUT_BUNDLE="$SCRIPT_DIR/codex-files/codex-rollout-bundle/rollout_summaries"

. "$SCRIPT_DIR/cc-unlock-files/lib-deploy.sh"

cc_dispatch uninstall "$@"
