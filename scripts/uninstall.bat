@echo off
chcp 65001 >nul 2>&1
echo.
echo   cc-unlock - Uninstall
echo.
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\cc-unlock-files\deploy.ps1" -Mode uninstall
echo.
pause
