@echo off
chcp 65001 >nul 2>&1
echo.
echo   cc-unlock v5.0 - Install / 安装
echo.
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\cc-unlock-files\deploy.ps1" -GUI
echo.
pause
