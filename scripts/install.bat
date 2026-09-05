@echo off
chcp 65001 >nul 2>&1
echo.
echo   cc-unlock v2.0-stable - Install / 安装
echo.
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\cc-unlock-files\deploy.ps1" -GUI
echo.
pause
