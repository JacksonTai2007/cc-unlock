#!/usr/bin/env bash
# check-deps.sh — Verify Android reverse engineering tool dependencies
# Exit 0 if all required deps available, 1 if any required dep missing
set -euo pipefail

REQUIRED_DEPS=("java" "jadx")
OPTIONAL_DEPS=("fernflower" "dex2jar" "apktool" "adb" "frida")

missing_required=0

log() { echo "[$1] $2"; }

check_java() {
    if command -v java &>/dev/null; then
        version=$(java -version 2>&1 | head -1 | sed -n 's/.*"\([0-9]*\).*/\1/p' | head -1)
        if [ "$version" -ge 17 ]; then
            log "OK" "Java $version found"
            return 0
        else
            log "WARN" "Java $version found, but 17+ required"
            return 1
        fi
    fi
    return 1
}

check_jadx() {
    if command -v jadx &>/dev/null; then
        log "OK" "jadx found: $(jadx --version 2>/dev/null || echo 'version unknown')"
        return 0
    fi
    return 1
}

check_fernflower() {
    if command -v fernflower &>/dev/null || command -v vineflower &>/dev/null; then
        log "OK" "Fernflower/Vineflower found"
        return 0
    elif [ -f "${HOME}/.local/bin/fernflower" ] || [ -f "${HOME}/.local/bin/vineflower" ]; then
        log "OK" "Fernflower/Vineflower found in ~/.local/bin"
        return 0
    fi
    return 1
}

check_generic() {
    command -v "$1" &>/dev/null
}

# Check required
for dep in "${REQUIRED_DEPS[@]}"; do
    case "$dep" in
        java)
            if ! check_java; then
                echo "INSTALL_REQUIRED:java"
                missing_required=1
            fi
            ;;
        jadx)
            if ! check_jadx; then
                echo "INSTALL_REQUIRED:jadx"
                missing_required=1
            fi
            ;;
        *)
            if ! check_generic "$dep"; then
                echo "INSTALL_REQUIRED:$dep"
                missing_required=1
            fi
            ;;
    esac
done

# Check optional
for dep in "${OPTIONAL_DEPS[@]}"; do
    case "$dep" in
        fernflower)
            if ! check_fernflower; then
                echo "INSTALL_OPTIONAL:fernflower"
            fi
            ;;
        *)
            if ! check_generic "$dep"; then
                echo "INSTALL_OPTIONAL:$dep"
            fi
            ;;
    esac
done

exit $missing_required
