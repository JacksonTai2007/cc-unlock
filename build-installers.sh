#!/usr/bin/env bash
# Build NSIS installers for both cc-unlock Electron apps.
# Produces a normal Windows installer: pick install dir -> extract -> Start Menu + Desktop shortcuts
# -> Add/Remove Programs entry -> uninstaller. Per-user install (no admin needed).
set -e

ROOT="C:/Users/JacksonTai/Desktop/cc work skill/cc-unlock"
MAKENSIS="$ROOT/.build-tools/nsis/Bin/makensis.exe"
OUTDIR="$ROOT/release"
NSI_DIR="$ROOT/.build-tools/nsi"
mkdir -p "$OUTDIR" "$NSI_DIR"

# gen_nsi <app_id> <app_name> <exe_name> <src_dir> <out_file>
gen_and_build() {
  local APP_ID="$1" APP_NAME="$2" EXE="$3" SRC="$4" OUT="$5"
  local NSI="$NSI_DIR/$APP_ID.nsi"
  # Backslash paths for NSIS
  local SRC_BS OUT_BS
  SRC_BS=$(echo "$SRC" | sed 's|/|\\|g')
  OUT_BS=$(echo "$OUT" | sed 's|/|\\|g')
  cat > "$NSI" <<NSI
Unicode true
!include "MUI2.nsh"

Name "$APP_NAME"
OutFile "$OUT_BS"
InstallDir "\$LOCALAPPDATA\\Programs\\$APP_ID"
InstallDirRegKey HKCU "Software\\$APP_ID" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
BrandingText "cc-unlock v1.0-stable"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "\$INSTDIR\\$EXE"
!define MUI_FINISHPAGE_RUN_TEXT "启动 $APP_NAME"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "\$INSTDIR"
  File /r "$SRC_BS\\*"
  CreateDirectory "\$SMPROGRAMS\\$APP_NAME"
  CreateShortCut "\$SMPROGRAMS\\$APP_NAME\\$APP_NAME.lnk" "\$INSTDIR\\$EXE"
  CreateShortCut "\$DESKTOP\\$APP_NAME.lnk" "\$INSTDIR\\$EXE"
  WriteRegStr HKCU "Software\\$APP_ID" "InstallDir" "\$INSTDIR"
  WriteUninstaller "\$INSTDIR\\Uninstall.exe"
  !define UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$APP_ID"
  WriteRegStr HKCU "\${UNINST_KEY}" "DisplayName" "$APP_NAME"
  WriteRegStr HKCU "\${UNINST_KEY}" "UninstallString" "\$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "\${UNINST_KEY}" "DisplayIcon" "\$INSTDIR\\$EXE"
  WriteRegStr HKCU "\${UNINST_KEY}" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "\${UNINST_KEY}" "Publisher" "JacksonTai"
  WriteRegStr HKCU "\${UNINST_KEY}" "URLInfoAbout" "https://github.com/JacksonTai2007/cc-unlock"
  WriteRegDWORD HKCU "\${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "\${UNINST_KEY}" "NoRepair" 1
  !undef UNINST_KEY
SectionEnd

Section "Uninstall"
  Delete "\$DESKTOP\\$APP_NAME.lnk"
  RMDir /r "\$SMPROGRAMS\\$APP_NAME"
  RMDir /r "\$INSTDIR"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\$APP_ID"
  DeleteRegKey HKCU "Software\\$APP_ID"
SectionEnd
NSI
  echo "--- compiling $APP_ID installer ---"
  "$MAKENSIS" "$NSI" | tail -4
  ls -la "$OUT" 2>/dev/null | awk '{printf "  -> %s  (%.0f MB)\n", $NF, $5/1048576}'
}

gen_and_build "cc-unlock-claude" "cc-unlock for Claude Code" "cc-unlock-claude.exe" \
  "$ROOT/cc-unlock-claude/dist/cc-unlock-claude-win32-x64" \
  "$OUTDIR/cc-unlock-claude-Setup-v1.0-stable.exe"

gen_and_build "cc-unlock-codex" "cc-unlock for Codex" "cc-unlock-codex.exe" \
  "$ROOT/cc-unlock-codex/dist/cc-unlock-codex-win32-x64" \
  "$OUTDIR/cc-unlock-codex-Setup-v1.0-stable.exe"

echo "=== installers ==="
ls -la "$OUTDIR"/*Setup*.exe 2>/dev/null | awk '{printf "%.0f MB  %s\n", $5/1048576, $NF}'
