#!/bin/bash
# cc-unlock v5.0 — Linux uninstall
#
# 用法 | Usage:
#   ./linux-uninstall.sh                      交互菜单 | interactive menu
#   ./linux-uninstall.sh /path/to/workspace   从指定工作区移除 | remove from a workspace
#   ./linux-uninstall.sh --all                从所有工作区移除 | remove from all
#   ./linux-uninstall.sh --codex              仅移除 Codex | Codex only
#   ./linux-uninstall.sh --list               列出工作区 | list workspaces

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEMORY_BUNDLE="$SCRIPT_DIR/memory-bundle"
CONFIG_BUNDLE="$SCRIPT_DIR/config-bundle"
CODEX_BUNDLE="$SCRIPT_DIR/../codex-files/codex-config-bundle"

. "$SCRIPT_DIR/lib-deploy.sh"

cc_dispatch uninstall "$@"
