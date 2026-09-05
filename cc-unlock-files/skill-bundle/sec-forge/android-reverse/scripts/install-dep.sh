#!/usr/bin/env bash
# install-dep.sh — Install a single Android reverse engineering dependency
# Usage: bash install-dep.sh <dep-name>
# Exit codes: 0=success, 1=failed, 2=manual action needed
set -euo pipefail

DEP="${1:-}"
if [ -z "$DEP" ]; then echo "Usage: install-dep.sh <java|jadx|fernflower|dex2jar|apktool|adb>"; exit 1; fi

detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then echo "macos"
    elif command -v apt-get &>/dev/null; then echo "debian"
    elif command -v dnf &>/dev/null; then echo "fedora"
    elif command -v pacman &>/dev/null; then echo "arch"
    else echo "unknown"
    fi
}

OS=$(detect_os)
LOCAL_BIN="${HOME}/.local/bin"
mkdir -p "$LOCAL_BIN"

install_java() {
    case "$OS" in
        macos)  brew install openjdk@17 ;;
        debian) sudo apt-get update && sudo apt-get install -y openjdk-17-jdk ;;
        fedora) sudo dnf install -y java-17-openjdk-devel ;;
        arch)   sudo pacman -S --noconfirm jdk-openjdk ;;
        *)
            echo "MANUAL: Install Java 17+ from https://adoptium.net/"
            return 2
            ;;
    esac
}

install_jadx() {
    echo "Finding latest jadx release..."
    local api_url="https://api.github.com/repos/skylot/jadx/releases/latest"
    local version
    version=$(curl -sL "$api_url" | sed -n 's/.*"tag_name":\s*"\([^"]*\)".*/\1/p' | head -1 | sed 's/^v//')
    if [ -z "$version" ]; then
        echo "WARN: Could not detect latest version, falling back to 1.5.1"
        version="1.5.1"
    fi
    local url="https://github.com/skylot/jadx/releases/download/v${version}/jadx-${version}.zip"
    local dest="${HOME}/.local/share/jadx"
    mkdir -p "$dest"
    echo "Downloading jadx v${version}..."
    local http_code
    http_code=$(curl -sL -o /tmp/jadx.zip -w '%{http_code}' "$url")
    if [ "$http_code" != "200" ]; then
        rm -f /tmp/jadx.zip
        echo "ERROR: Download failed (HTTP $http_code). Install manually from https://github.com/skylot/jadx/releases"
        return 1
    fi
    unzip -qo /tmp/jadx.zip -d "$dest" && rm /tmp/jadx.zip
    ln -sf "$dest/bin/jadx" "$LOCAL_BIN/jadx"
    ln -sf "$dest/bin/jadx-gui" "$LOCAL_BIN/jadx-gui"
    chmod +x "$dest/bin/jadx" "$dest/bin/jadx-gui"
    echo "OK: jadx v${version} installed to $dest"
}

install_fernflower() {
    echo "Finding latest vineflower release..."
    local api_url="https://api.github.com/repos/Vineflower/vineflower/releases/latest"
    local jar_url
    jar_url=$(curl -sL "$api_url" | sed -n 's/.*"browser_download_url":\s*"\([^"]*\.jar\)".*/\1/p' | head -1)
    if [ -z "$jar_url" ]; then
        echo "MANUAL: Download vineflower from https://github.com/Vineflower/vineflower/releases"
        return 2
    fi
    echo "Downloading: $jar_url"
    local http_code
    http_code=$(curl -sL -o "$LOCAL_BIN/vineflower.jar" -w '%{http_code}' "$jar_url")
    if [ "$http_code" != "200" ]; then
        rm -f "$LOCAL_BIN/vineflower.jar"
        echo "ERROR: Download failed (HTTP $http_code)"
        return 1
    fi
    cat > "$LOCAL_BIN/vineflower" << 'SCRIPT'
#!/usr/bin/env bash
exec java -jar "$HOME/.local/bin/vineflower.jar" "$@"
SCRIPT
    chmod +x "$LOCAL_BIN/vineflower"
    echo "OK: vineflower installed"
}

install_dex2jar() {
    case "$OS" in
        macos)  brew install dex2jar ;;
        *)
            echo "MANUAL: Download dex2jar from https://github.com/pxb1988/dex2jar/releases"
            return 2
            ;;
    esac
}

install_apktool() {
    case "$OS" in
        macos)  brew install apktool ;;
        debian|fedora|arch)
            local url="https://bitbucket.org/APerezAppworksLLC/apktool/downloads/apktool_2.9.3.jar"
            local http_code
            http_code=$(curl -sL -o "$LOCAL_BIN/apktool.jar" -w '%{http_code}' "$url")
            if [ "$http_code" != "200" ]; then
                rm -f "$LOCAL_BIN/apktool.jar"
                echo "ERROR: Download failed (HTTP $http_code). Install manually from https://apktool.org/"
                return 1
            fi
            cat > "$LOCAL_BIN/apktool" << 'SCRIPT'
#!/usr/bin/env bash
exec java -jar "$HOME/.local/bin/apktool.jar" "$@"
SCRIPT
            chmod +x "$LOCAL_BIN/apktool"
            echo "OK: apktool installed"
            ;;
        *)
            echo "MANUAL: Download from https://apktool.org/"
            return 2
            ;;
    esac
}

install_adb() {
    case "$OS" in
        macos)  brew install android-platform-tools ;;
        debian) sudo apt-get install -y adb ;;
        fedora) sudo dnf install -y adb ;;
        arch)   sudo pacman -S --noconfirm android-tools ;;
        *)
            echo "MANUAL: Install Android Platform Tools from https://developer.android.com/studio/releases/platform-tools"
            return 2
            ;;
    esac
}

case "$DEP" in
    java)        install_java ;;
    jadx)        install_jadx ;;
    fernflower)  install_fernflower ;;
    dex2jar)     install_dex2jar ;;
    apktool)     install_apktool ;;
    adb)         install_adb ;;
    *)           echo "ERROR: Unknown dependency: $DEP"; exit 1 ;;
esac
