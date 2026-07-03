@echo off
echo.
echo   cc-unlock v5.0
echo.
echo   [1] Deploy to workspace (select folder)
echo   [2] Deploy to all workspaces
echo   [3] Deploy Codex only
echo   [4] List workspaces
echo   [0] Exit
echo.
set /p "choice=  Select: "
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
