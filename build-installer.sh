#!/usr/bin/env bash
# Build ONE unified NSIS installer for cc-unlock.
# User picks components on a checkbox page: Claude Code edition, Codex edition, or both.
# Per-user install (no admin), custom icon, Desktop + Start Menu shortcuts, uninstaller, Add/Remove entry.
set -e

ROOT="C:/Users/JacksonTai/Desktop/cc work skill/cc-unlock"
MAKENSIS="$ROOT/.build-tools/nsis/Bin/makensis.exe"
OUTDIR="$ROOT/release"
NSI="$ROOT/.build-tools/nsi/cc-unlock-unified.nsi"
mkdir -p "$OUTDIR" "$(dirname "$NSI")"

bs() { echo "$1" | sed 's|/|\\|g'; }
ICON=$(bs "$ROOT/assets/cc-unlock.ico")
OUT=$(bs "$OUTDIR/cc-unlock-Setup-v2.0-stable.exe")
CLAUDE_SRC=$(bs "$ROOT/cc-unlock-claude/dist/cc-unlock-claude-win32-x64")
CODEX_SRC=$(bs "$ROOT/cc-unlock-codex/dist/cc-unlock-codex-win32-x64")

printf '\xEF\xBB\xBF' > "$NSI"   # UTF-8 BOM so makensis reads CJK correctly
cat >> "$NSI" <<NSI
Unicode true
!include "MUI2.nsh"

Name "cc-unlock"
OutFile "$OUT"
InstallDir "\$LOCALAPPDATA\\Programs\\cc-unlock"
InstallDirRegKey HKCU "Software\\cc-unlock" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
BrandingText "cc-unlock v2.0-stable"

Icon "$ICON"
UninstallIcon "$ICON"
!define MUI_ICON "$ICON"
!define MUI_UNICON "$ICON"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; 升级：装新版前先静默卸掉已装的旧版，避免残留 / 卸载项重复
Function .onInit
  ReadRegStr \$0 HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "UninstallString"
  ReadRegStr \$1 HKCU "Software\\cc-unlock" "InstallDir"
  StrCmp \$0 "" done
    DetailPrint "检测到旧版本，正在卸载..."
    ExecWait '"\$0" /S _?=\$1'
    Delete "\$1\\Uninstall.exe"
  done:
FunctionEnd

Section "cc-unlock for Claude Code" SEC_CLAUDE
  SetOutPath "\$INSTDIR\\claude"
  File /r "$CLAUDE_SRC\\*"
  CreateDirectory "\$SMPROGRAMS\\cc-unlock"
  CreateShortCut "\$SMPROGRAMS\\cc-unlock\\cc-unlock for Claude Code.lnk" "\$INSTDIR\\claude\\cc-unlock-claude.exe"
  CreateShortCut "\$DESKTOP\\cc-unlock for Claude Code.lnk" "\$INSTDIR\\claude\\cc-unlock-claude.exe"
  WriteRegDWORD HKCU "Software\\cc-unlock" "Claude" 1
SectionEnd

Section "cc-unlock for Codex" SEC_CODEX
  SetOutPath "\$INSTDIR\\codex"
  File /r "$CODEX_SRC\\*"
  CreateDirectory "\$SMPROGRAMS\\cc-unlock"
  CreateShortCut "\$SMPROGRAMS\\cc-unlock\\cc-unlock for Codex.lnk" "\$INSTDIR\\codex\\cc-unlock-codex.exe"
  CreateShortCut "\$DESKTOP\\cc-unlock for Codex.lnk" "\$INSTDIR\\codex\\cc-unlock-codex.exe"
  WriteRegDWORD HKCU "Software\\cc-unlock" "Codex" 1
SectionEnd

Section "-post"
  SetOutPath "\$INSTDIR"
  File "$ICON"
  WriteRegStr HKCU "Software\\cc-unlock" "InstallDir" "\$INSTDIR"
  WriteUninstaller "\$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "DisplayName" "cc-unlock"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "UninstallString" "\$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "DisplayIcon" "\$INSTDIR\\cc-unlock.ico"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "DisplayVersion" "2.0.0"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "Publisher" "JacksonTai"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "URLInfoAbout" "https://github.com/JacksonTai2007/cc-unlock"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock" "NoRepair" 1
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT \${SEC_CLAUDE} "Claude Code 版：部署记忆 + CLAUDE.md + 技能 + 子agent覆盖到工作区。"
  !insertmacro MUI_DESCRIPTION_TEXT \${SEC_CODEX} "Codex 版：部署 system-prompt + AGENTS + memories + skills 到全局 ~/.codex。"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  Delete "\$DESKTOP\\cc-unlock for Claude Code.lnk"
  Delete "\$DESKTOP\\cc-unlock for Codex.lnk"
  RMDir /r "\$SMPROGRAMS\\cc-unlock"
  RMDir /r "\$INSTDIR"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\cc-unlock"
  DeleteRegKey HKCU "Software\\cc-unlock"
SectionEnd
NSI

echo "--- compiling unified installer ---"
"$MAKENSIS" "$NSI" 2>&1 | tail -5
echo "=== installer ==="
ls -la "$OUTDIR/cc-unlock-Setup-v2.0-stable.exe" 2>/dev/null | awk '{printf "%.0f MB  %s\n", $5/1048576, $NF}'
