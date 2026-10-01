Unicode true
!include "MUI2.nsh"

Name "cc-unlock"
OutFile "cc-unlock-Setup-v3.0.1-stable.exe"
InstallDir "$LOCALAPPDATA\Programs\cc-unlock"
InstallDirRegKey HKCU "Software\cc-unlock" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
BrandingText "cc-unlock v3.0.1-stable"

Icon "..\..\assets\cc-unlock.ico"
UninstallIcon "..\..\assets\cc-unlock.ico"
!define MUI_ICON "..\..\assets\cc-unlock.ico"
!define MUI_UNICON "..\..\assets\cc-unlock.ico"
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
Function RequireClosedWorkstation
  check_again:
    nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "if(Get-Process -Name $\'cc-unlock-claude$\',$\'cc-unlock-codex$\' -ErrorAction SilentlyContinue){exit 1}else{exit 0}"'
    Pop $2
    Pop $3
    StrCmp $2 "0" ready
    IfSilent silent_stop
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "cc-unlock 部署工具仍在运行，暂时不能替换程序文件。请退出旧 cc-unlock 后选择重试。原版 Codex 和 Claude 无需退出。" IDRETRY check_again
    Abort
  silent_stop:
    SetErrorLevel 1
    Abort
  ready:
FunctionEnd

Function .onInit
  Call RequireClosedWorkstation
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "UninstallString"
  ReadRegStr $1 HKCU "Software\cc-unlock" "InstallDir"
  StrCmp $0 "" done
    DetailPrint "检测到旧版本，正在卸载..."
    ExecWait '"$0" /S _?=$1'
    Delete "$1\Uninstall.exe"
  done:
FunctionEnd

Section "cc-unlock for Claude Code" SEC_CLAUDE
  SetOutPath "$INSTDIR\claude"
  File /r "..\..\cc-unlock-claude\dist\cc-unlock-claude-win32-x64\*"
  CreateDirectory "$SMPROGRAMS\cc-unlock"
  CreateShortCut "$SMPROGRAMS\cc-unlock\cc-unlock for Claude Code.lnk" "$INSTDIR\claude\cc-unlock-claude.exe"
  CreateShortCut "$DESKTOP\cc-unlock for Claude Code.lnk" "$INSTDIR\claude\cc-unlock-claude.exe"
  WriteRegDWORD HKCU "Software\cc-unlock" "Claude" 1
SectionEnd

Section "cc-unlock for Codex" SEC_CODEX
  SetOutPath "$INSTDIR\codex"
  File /r "..\..\cc-unlock-codex\dist\cc-unlock-codex-win32-x64\*"
  CreateDirectory "$SMPROGRAMS\cc-unlock"
  CreateShortCut "$SMPROGRAMS\cc-unlock\cc-unlock for Codex.lnk" "$INSTDIR\codex\cc-unlock-codex.exe"
  CreateShortCut "$DESKTOP\cc-unlock for Codex.lnk" "$INSTDIR\codex\cc-unlock-codex.exe"
  WriteRegDWORD HKCU "Software\cc-unlock" "Codex" 1
SectionEnd

Section "-post"
  SetOutPath "$INSTDIR"
  File "..\..\assets\cc-unlock.ico"
  WriteRegStr HKCU "Software\cc-unlock" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "DisplayName" "cc-unlock"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "DisplayIcon" "$INSTDIR\cc-unlock.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "DisplayVersion" "3.0.1"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "Publisher" "JacksonTai"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "URLInfoAbout" "https://github.com/JacksonTai2007/cc-unlock"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock" "NoRepair" 1
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CLAUDE} "Claude Code 版：仅部署工作区 CLAUDE.md + sec-forge；保留原版 Claude 客户端。"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC_CODEX} "Codex 版：部署 system-prompt + AGENTS + config + skills 到全局 ~/.codex。"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  Delete "$DESKTOP\cc-unlock for Claude Code.lnk"
  Delete "$DESKTOP\cc-unlock for Codex.lnk"
  RMDir /r "$SMPROGRAMS\cc-unlock"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\cc-unlock"
  DeleteRegKey HKCU "Software\cc-unlock"
SectionEnd
