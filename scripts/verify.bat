@echo off
chcp 65001 >nul 2>&1
echo.
echo   cc-unlock v2.0-stable - Verify / 验证
echo.
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\cc-unlock-files\deploy.ps1" -Verify
echo.
pause
