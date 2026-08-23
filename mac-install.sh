#!/bin/bash
# cc-unlock v8.0.7 — macOS install
# Memory-based cybersecurity academy tutoring for Claude Code + Codex
#
# 用法 | Usage:
#   ./mac-install.sh                      交互菜单 | interactive menu
#   ./mac-install.sh /path/to/workspace   部署到指定工作区 | deploy to a workspace
#   ./mac-install.sh --all                部署到所有工作区 | deploy to all
#   ./mac-install.sh --codex              仅部署 Codex | Codex only
#   ./mac-install.sh --list               列出工作区 | list workspaces
#   ./mac-install.sh --verify             验证部署 | verify deployment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MEMORY_BUNDLE="$SCRIPT_DIR/cc-unlock-files/memory-bundle"
CONFIG_BUNDLE="$SCRIPT_DIR/cc-unlock-files/config-bundle"
SKILL_BUNDLE="$SCRIPT_DIR/cc-unlock-files/skill-bundle"
CODEX_BUNDLE="$SCRIPT_DIR/codex-files/codex-config-bundle"
CODEX_MEMORY_BUNDLE="$SCRIPT_DIR/codex-files/codex-memory-bundle"
CODEX_ROLLOUT_BUNDLE="$SCRIPT_DIR/codex-files/codex-rollout-bundle/rollout_summaries"

. "$SCRIPT_DIR/cc-unlock-files/lib-deploy.sh"

cc_dispatch install "$@"
