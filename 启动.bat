@echo off
chcp 65001 >nul 2>&1
echo.
echo ============================================
echo   cc-unlock - Security Research Config Deployer
echo ============================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0cc-unlock-files\deploy.ps1"
