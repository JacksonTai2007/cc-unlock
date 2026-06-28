#!/bin/bash
# Generic install wrapper — detects platform and calls the right script
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OS="$(uname -s)"
case "$OS" in
    Darwin) exec "$SCRIPT_DIR/../mac-install.sh" ;;
    Linux)  exec "$SCRIPT_DIR/linux-install.sh" ;;
    *)      echo "Unsupported OS: $OS. Use Windows deploy.ps1."; exit 1 ;;
esac
