@echo off
chcp 65001 >nul 2>&1
echo.
echo ============================================
echo   cc-unlock - Uninstall
echo ============================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1" -Uninstall
