@echo off
echo.
echo   cc-unlock v5.0
echo.
echo   [1] Deploy to workspace (select folder) / 部署到指定工作区
echo   [2] Deploy to all workspaces / 部署到所有工作区
echo   [3] Deploy Codex only / 仅部署 Codex
echo   [4] List workspaces / 列出工作区
echo   [0] Exit / 退出
echo.
set /p "choice=  Select / 选择: "
if "%choice%"=="1" (
    powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -GUI
) else if "%choice%"=="2" (
    powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -All
) else if "%choice%"=="3" (
    powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -Codex
) else if "%choice%"=="4" (
    powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -List
) else (
    exit /b 0
)
pause