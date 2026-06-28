#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OS="$(uname -s)"
case "$OS" in
    Darwin) exec "$SCRIPT_DIR/../mac-uninstall.sh" ;;
    Linux)  exec "$SCRIPT_DIR/../cc-unlock-files/linux-uninstall.sh" ;;
    *)      echo "Unsupported OS: $OS. Use Windows uninstall.bat."; exit 1 ;;
esac
