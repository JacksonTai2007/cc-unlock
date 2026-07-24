#!/bin/bash
# cc-unlock v8.0.6 — Linux install
# Memory-based security research authorization for Claude Code + Codex
#
# 用法 | Usage:
#   ./linux-install.sh                      交互菜单 | interactive menu
#   ./linux-install.sh /path/to/workspace   部署到指定工作区 | deploy to a workspace
#   ./linux-install.sh --all                部署到所有工作区 | deploy to all
#   ./linux-install.sh --codex              仅部署 Codex | Codex only
#   ./linux-install.sh --list               列出工作区 | list workspaces
#   ./linux-install.sh --verify             验证部署 | verify deployment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEMORY_BUNDLE="$SCRIPT_DIR/memory-bundle"
CONFIG_BUNDLE="$SCRIPT_DIR/config-bundle"
SKILL_BUNDLE="$SCRIPT_DIR/skill-bundle"
CODEX_BUNDLE="$SCRIPT_DIR/../codex-files/codex-config-bundle"
CODEX_MEMORY_BUNDLE="$SCRIPT_DIR/../codex-files/codex-memory-bundle"
CODEX_ROLLOUT_BUNDLE="$SCRIPT_DIR/../codex-files/codex-rollout-bundle/rollout_summaries"

. "$SCRIPT_DIR/lib-deploy.sh"

cc_dispatch install "$@"
