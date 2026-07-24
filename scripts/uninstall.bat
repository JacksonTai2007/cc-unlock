@echo off
chcp 65001 >nul 2>&1
echo.
echo   cc-unlock v8.0.6 - Uninstall / 卸载
echo.
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\cc-unlock-files\deploy.ps1" -Uninstall -All
echo.
pause
